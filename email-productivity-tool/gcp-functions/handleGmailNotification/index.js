// gcp-functions/handleGmailNotification/index.js
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { fetchEmailContent } = require('./cfGmailUtils');
const { Deepseek } = require('@ai-sdk/deepseek');
const { generateText } = require('ai');
const { decryptToken } = require('./cfCryptoUtils'); // Import decryptToken

const firestore = new Firestore();
const deepseek = new Deepseek();

exports.handleGmailNotification = async (pubSubEvent, context) => {
  const message = pubSubEvent.data
    ? Buffer.from(pubSubEvent.data, 'base64').toString()
    : null;

  if (!message) { 
    console.log('Received empty Pub/Sub message.');
    return;
  }
  console.log('Received Gmail notification raw message:', message);
  let notificationData;
  try {
    notificationData = JSON.parse(message);
  } catch (error) { 
    console.error('Error parsing Gmail notification message:', error);
    return;
  }
  
  const { emailAddress, historyId: notificationHistoryId } = notificationData; // Renamed historyId to avoid conflict
  if (!emailAddress || !notificationHistoryId) { 
    console.error('Missing emailAddress or historyId in notification.');
    return;
  }
  console.log(`Processing notification for ${emailAddress}, historyId: ${notificationHistoryId}`);

  try {
    const usersRef = firestore.collection('users');
    const userSnapshot = await usersRef.where('email', '==', emailAddress).limit(1).get();
    if (userSnapshot.empty) { 
        console.error(`User not found in Firestore for email: ${emailAddress}`);
        return;
    }
    const userDoc = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id; // This is the Google User ID (sub)
    
    const encryptedAccessToken = userDoc.accessToken;
    if (!encryptedAccessToken) { 
        console.error(`Encrypted access token not found for user ${userId} (email: ${emailAddress})`);
        return;
    }
    const userAccessToken = decryptToken(encryptedAccessToken);
    if (!userAccessToken) {
        console.error(`Failed to decrypt access token for user ${userId} (email: ${emailAddress}). Check TOKEN_ENCRYPTION_KEY.`);
        // Potentially, the token was not encrypted (e.g., older user record)
        // If TOKEN_ENCRYPTION_KEY is set, and this still fails, it might be a corrupted token or truly unencrypted.
        // For now, we treat decryption failure as critical.
        return;
    }
    console.log(`Found user ${userId} and successfully decrypted access token.`);

    // Using the logic from turn 47 which is more robust for historyId
    const startHistoryId = userDoc.gmailHistoryId && BigInt(userDoc.gmailHistoryId) > BigInt(notificationHistoryId) 
                           ? userDoc.gmailHistoryId 
                           : notificationHistoryId;
    
    console.log(`Using startHistoryId: ${startHistoryId} for user ${userId}. (Notification historyId: ${notificationHistoryId}, User stored: ${userDoc.gmailHistoryId || 'N/A'})`);

    const historyApiUrl = `https://www.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;
    const historyResponse = await fetch(historyApiUrl, { headers: { 'Authorization': `Bearer ${userAccessToken}` }});
    if (!historyResponse.ok) { 
        const errorData = await historyResponse.json();
        console.error(`Gmail API history error for user ${userId}: ${historyResponse.status}`, errorData);
        if (historyResponse.status === 401) {
            console.error(`Access token for user ${userId} might be expired or revoked.`);
        }
        return;
    }
    const historyData = await historyResponse.json();

    if (historyData.historyId) {
        await firestore.collection('users').doc(userId).update({ 
            gmailHistoryId: historyData.historyId,
            updatedAt: FieldValue.serverTimestamp() 
        });
        console.log(`Updated Firestore historyId for user ${userId} to ${historyData.historyId}`);
    }
        
    let newMessages = [];
    if (historyData.history) {
      for (const record of historyData.history) {
        if (record.messagesAdded) {
          record.messagesAdded.forEach(msgAdded => {
            if (msgAdded.message && msgAdded.message.id) {
              // Basic check to ensure it's an INBOX message (can be refined)
              if (msgAdded.message.labelIds && msgAdded.message.labelIds.includes('INBOX')) {
                newMessages.push(msgAdded.message.id);
              } else {
                console.log(`Skipping message ${msgAdded.message.id} for user ${userId} as it's not in INBOX or lacks labelIds.`);
              }
            }
          });
        }
      }
    }
    if (newMessages.length === 0) { 
        console.log(`No new INBOX messages found for user ${userId} since startHistoryId ${startHistoryId}.`);
        return;
    }
    newMessages = [...new Set(newMessages)]; // Remove duplicates
    
    if (newMessages.length > 0) {
        console.log(`Found ${newMessages.length} new INBOX message(s) for user ${userId}. IDs: ${newMessages.join(', ')}. Processing all...`);
        let successCount = 0;
        let failureCount = 0;

        for (const messageId of newMessages) {
            try {
                console.log(`Processing message ${messageId} for user ${userId}...`);
                let emailDetails;
                try {
                    emailDetails = await fetchEmailContent(userAccessToken, messageId);
                } catch (fetchError) {
                    console.error(`Error fetching content for message ${messageId}:`, fetchError.message);
                    await firestore.collection('processedEmails').doc(messageId).set({
                        userId: userId,
                        messageId: messageId,
                        status: 'fetch_failed',
                        errorMessage: fetchError.message,
                        processedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                    failureCount++;
                    continue; // Skip to next message
                }

                if (!emailDetails) {
                    console.warn(`Could not fetch details for message ${messageId}. Skipping.`);
                    await firestore.collection('processedEmails').doc(messageId).set({
                        userId: userId,
                        messageId: messageId,
                        status: 'fetch_empty', // Or a more specific status
                        processedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                    failureCount++;
                    continue; 
                }
                console.log(`Successfully fetched content for message ${messageId}: Subject - "${emailDetails.subject}"`);

                let summaryText = null;
                let processingStatus = "content_fetched"; // Default status after successful fetch
                let llmErrorMessage = null; // To store potential LLM error message

                if (emailDetails.body) {
                    const maxBodyLength = 15000;
                    const truncatedBody = emailDetails.body.length > maxBodyLength 
                                       ? emailDetails.body.substring(0, maxBodyLength) + "..." 
                                       : emailDetails.body;
                    // Log placeholder for dynamic prompt loading
                    // TODO: Load summarization prompt dynamically from Firestore 'promptLibrary' collection (document ID: 'emailSummarization') instead of using this hardcoded version. Implement error handling for prompt fetching.
                    console.info(`[${context.eventId || 'N/A'}] INFO: Using hardcoded summarization prompt. Dynamic prompt loading from Firestore 'promptLibrary' collection (document ID: 'emailSummarization') is pending implementation.`);
                    const prompt = `Summarize the following email concisely:
From: ${emailDetails.from}
Subject: ${emailDetails.subject}
Body:
${truncatedBody}`;
                    console.log(`Sending prompt to DeepSeek for message ${messageId}...`);
                    try {
                        const { text: llmSummary } = await generateText({
                            model: deepseek.chat('deepseek-chat'), 
                            prompt: prompt,
                            temperature: 0.3
                        });
                        if (llmSummary) {
                            summaryText = llmSummary;
                            processingStatus = "summarized";
                            console.log(`Generated Summary for message ${messageId}: "${summaryText.substring(0,100)}..."`);
                        } else {
                            console.warn(`LLM returned an empty summary for message ${messageId}.`);
                            processingStatus = "summarization_empty";
                        }
                    } catch (llmError) {
                        console.error(`LLM summarization error for message ${messageId}:`, llmError.message);
                        processingStatus = "summarization_failed";
                        llmErrorMessage = llmError.message; // Store the error message
                    }
                } else {
                    console.warn(`No body found for message ${messageId}, skipping summarization.`);
                    processingStatus = "no_body_for_summary";
                }

                let finalProcessingStatus = processingStatus;
                const autoSendIsEnabled = userDoc.autoSendEnabled === true;

                if (autoSendIsEnabled && summaryText && processingStatus === "summarized") {
                    // TODO: Implement actual email sending via Gmail API using userAccessToken. This will require constructing a MIME message and using the gmail.users.messages.send API. Ensure 'gmail.send' scope is granted by users.
                    console.info(`[USER: ${userId}, MSG: ${messageId}] Auto-send enabled. Placeholder: Email to ${emailDetails.from} with subject "Re: ${emailDetails.subject}" would be sent here. Full send logic pending.`);
                    finalProcessingStatus = "summarized_auto_send_pending"; 

                    // TODO: Implement audit log entry creation in 'outboundAudits' Firestore collection after successful auto-send. Include details like userId, originalMessageId, sentMessageId (from Gmail API response), recipient, subject, and timestamp.
                    console.info(`[USER: ${userId}, MSG: ${messageId}] Placeholder: Audit log entry for auto-send to ${emailDetails.from} for original message ${messageId} would be created here. Full audit logic pending.`);
                }

                const processedEmailRef = firestore.collection('processedEmails').doc(messageId); 
                const dataToStore = {
                    userId: userId, 
                    messageId: messageId, 
                    threadId: emailDetails.rawPayload ? emailDetails.rawPayload.threadId : null,
                    subject: emailDetails.subject,
                    from: emailDetails.from,
                    date: emailDetails.date, 
                    snippet: emailDetails.snippet,
                    plainBody: emailDetails.body, 
                    summary: summaryText, 
                    processedAt: FieldValue.serverTimestamp(), 
                    status: finalProcessingStatus, // Use the potentially modified status
                };
                if (llmErrorMessage) { 
                    dataToStore.errorMessage = llmErrorMessage;
                } else if (finalProcessingStatus.includes("failed") && !llmErrorMessage) { // Ensure not to overwrite specific LLM error
                    dataToStore.errorMessage = `Processing failed with status: ${finalProcessingStatus}`; 
                }
                
                await processedEmailRef.set(dataToStore);
                console.log(`Successfully stored/updated processed email ${messageId} with status '${finalProcessingStatus}' to Firestore.`);
                
                // successCount should reflect successful summarization, even if auto-send is just pending
                if (processingStatus === "summarized" || finalProcessingStatus === "summarized_auto_send_pending") {
                     successCount++;
                } else {
                     failureCount++; 
                }

            } catch (error) { 
                console.error(`Unhandled error processing message ${messageId} for user ${userId}:`, error.message, error.stack);
                failureCount++;
                try {
                    await firestore.collection('processedEmails').doc(messageId).set({
                        userId: userId,
                        messageId: messageId,
                        status: 'processing_failed_uncaught',
                        errorMessage: error.message,
                        processedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (fsError) {
                    console.error(`Failed to even write error status for message ${messageId} to Firestore:`, fsError.message);
                }
            }
        }
        console.log(`Finished processing batch for user ${userId}. Total messages: ${newMessages.length}, Successfully summarized: ${successCount}, Failed/Skipped: ${failureCount}.`);
    } else {
        console.log(`No new INBOX messages found for user ${userId} since startHistoryId ${startHistoryId}.`);
    }

  } catch (error) {
    console.error(`Error processing notification for ${emailAddress}:`, error.message, error.stack);
  }
};
