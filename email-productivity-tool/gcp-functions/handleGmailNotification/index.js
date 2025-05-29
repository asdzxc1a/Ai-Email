// gcp-functions/handleGmailNotification/index.js
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { fetchEmailContent } = require('./cfGmailUtils');
const { Deepseek } = require('@ai-sdk/deepseek');
const { generateText } = require('ai');
const { decryptToken } = require('./cfCryptoUtils'); // Import decryptToken

const firestore = new Firestore();
const deepseek = new Deepseek();

// Helper function to encode a string to base64url
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper function to extract email address from "Name <email@example.com>" format
function extractEmailAddress(fullEmailAddress) {
    if (!fullEmailAddress) return null;
    const match = fullEmailAddress.match(/<([^>]+)>/);
    return match ? match[1] : fullEmailAddress;
}

const DEFAULT_SUMMARY_PROMPT_ID = 'defaultSummaryPrompt';

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

                    // Fetch summary prompt template from Firestore
                    let summaryPromptTemplateString;
                    try {
                      const promptDoc = await firestore.collection('promptLibrary').doc(DEFAULT_SUMMARY_PROMPT_ID).get();
                      if (promptDoc.exists && promptDoc.data().template) {
                        summaryPromptTemplateString = promptDoc.data().template;
                        console.log(`Successfully fetched summary prompt '${DEFAULT_SUMMARY_PROMPT_ID}' from Firestore for message ${messageId}.`);
                      } else {
                        console.warn(`Summary prompt document '${DEFAULT_SUMMARY_PROMPT_ID}' not found or template missing in 'promptLibrary' for message ${messageId}. Falling back to hardcoded default.`);
                        summaryPromptTemplateString = "Summarize this email concisely.\nOriginal Email From: {{originalFrom}}\nOriginal Email Subject: {{originalSubject}}\nOriginal Email Body:\n{{originalEmailBody}}";
                      }
                    } catch (error) {
                      console.error(`Error fetching summary prompt '${DEFAULT_SUMMARY_PROMPT_ID}' from Firestore for message ${messageId}:`, error.message);
                      console.warn(`Falling back to hardcoded default summary prompt for message ${messageId}.`);
                      summaryPromptTemplateString = "Summarize this email concisely.\nOriginal Email From: {{originalFrom}}\nOriginal Email Subject: {{originalSubject}}\nOriginal Email Body:\n{{originalEmailBody}}";
                    }

                    let finalSummaryPrompt = summaryPromptTemplateString;
                    finalSummaryPrompt = finalSummaryPrompt.replace(/{{originalEmailBody}}/g, truncatedBody || '');
                    finalSummaryPrompt = finalSummaryPrompt.replace(/{{originalFrom}}/g, emailDetails.from || '');
                    finalSummaryPrompt = finalSummaryPrompt.replace(/{{originalSubject}}/g, emailDetails.subject || '');
                    
                    console.log(`Sending prompt to DeepSeek for message ${messageId} (first 100 chars): ${finalSummaryPrompt.substring(0,100)}...`);
                    try {
                        const { text: llmSummary } = await generateText({
                            model: deepseek.chat('deepseek-chat'), 
                            prompt: finalSummaryPrompt, // Use dynamically constructed prompt
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
                let autoSentReplyBody = null; // To store the reply body if sent
                let sentMessageDetails = {}; // To store details of the sent message

                if (autoSendIsEnabled && summaryText && processingStatus === "summarized") {
                    console.log(`[USER: ${userId}, MSG: ${messageId}] Auto-send enabled. Proceeding to generate reply.`);
                    const originalEmailBody = emailDetails.body || "";
                    // TODO: Load reply generation prompt dynamically from Firestore 'promptLibrary' collection (document ID: 'emailReplyGeneration')
                    const replyPrompt = `You are an AI assistant. Generate a helpful and concise reply to the following email.
Only generate the body of the reply, do not include subject lines or any other headers.
Original Email From: ${emailDetails.from}
Original Email Subject: ${emailDetails.subject}
Original Email Body:
---
${originalEmailBody.substring(0, 5000)}
---
Generate a reply to this email:`;

                    let draftReplyText = null;
                    try {
                        console.log(`[USER: ${userId}, MSG: ${messageId}] Generating reply using LLM.`);
                        const { text: llmReply } = await generateText({
                            model: deepseek.chat('deepseek-chat'), // Or your preferred model
                            prompt: replyPrompt,
                            temperature: 0.7, // Adjust temperature as needed for replies
                        });
                        if (llmReply && llmReply.trim() !== "") {
                            draftReplyText = llmReply.trim();
                            autoSentReplyBody = draftReplyText; // Store for Firestore
                            console.log(`[USER: ${userId}, MSG: ${messageId}] Successfully generated draft reply: "${draftReplyText.substring(0, 100)}..."`);
                        } else {
                            console.warn(`[USER: ${userId}, MSG: ${messageId}] LLM returned an empty reply.`);
                            finalProcessingStatus = "auto_send_reply_generation_empty";
                            llmErrorMessage = "LLM returned empty reply content.";
                        }
                    } catch (replyLlmError) {
                        console.error(`[USER: ${userId}, MSG: ${messageId}] LLM reply generation error:`, replyLlmError.message);
                        finalProcessingStatus = "auto_send_reply_generation_failed";
                        llmErrorMessage = `Reply LLM Error: ${replyLlmError.message}`;
                    }

                    if (draftReplyText) {
                        const originalMessageIdHeader = emailDetails.rawPayload.headers.find(h => h.name.toLowerCase() === 'message-id')?.value;
                        const originalReferencesHeader = emailDetails.rawPayload.headers.find(h => h.name.toLowerCase() === 'references')?.value;

                        const recipientEmail = extractEmailAddress(emailDetails.from);
                        if (!recipientEmail) {
                            console.error(`[USER: ${userId}, MSG: ${messageId}] Could not extract recipient email from: ${emailDetails.from}`);
                            finalProcessingStatus = "auto_send_recipient_parse_failed";
                            llmErrorMessage = `Failed to parse recipient email from: ${emailDetails.from}`;
                        } else {
                            let mimeMessage = `To: ${recipientEmail}\r\n`;
                            mimeMessage += `From: ${emailAddress}\r\n`; // User's own email
                            mimeMessage += `Subject: Re: ${emailDetails.subject}\r\n`;
                            if (originalMessageIdHeader) {
                                mimeMessage += `In-Reply-To: ${originalMessageIdHeader}\r\n`;
                                if (originalReferencesHeader) {
                                    mimeMessage += `References: ${originalReferencesHeader} ${originalMessageIdHeader}\r\n`;
                                } else {
                                    mimeMessage += `References: ${originalMessageIdHeader}\r\n`;
                                }
                            }
                            mimeMessage += `Content-Type: text/plain; charset=utf-8\r\n`;
                            mimeMessage += `\r\n`; // Blank line before body
                            mimeMessage += `${draftReplyText}`;

                            const rawEmail = base64urlEncode(mimeMessage);

                            console.log(`[USER: ${userId}, MSG: ${messageId}] Attempting to send reply to ${recipientEmail}.`);
                            try {
                                const sendResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${userAccessToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ raw: rawEmail }),
                                });

                                const sendData = await sendResponse.json();
                                if (sendResponse.ok) {
                                    console.log(`[USER: ${userId}, MSG: ${messageId}] Successfully sent reply. Message ID: ${sendData.id}, Thread ID: ${sendData.threadId}`);
                                    finalProcessingStatus = "auto_sent";
                                    sentMessageDetails = {
                                        sentMessageId: sendData.id,
                                        sentMessageThreadId: sendData.threadId,
                                    };

                                    // Create Audit Log Entry
                                    const auditLogData = {
                                        userId: userId,
                                        originalMessageId: messageId,
                                        sentMessageId: sendData.id,
                                        sentMessageThreadId: sendData.threadId,
                                        recipientEmail: recipientEmail, // Already extracted
                                        subject: `Re: ${emailDetails.subject}`,
                                        replyBodySnippet: draftReplyText ? draftReplyText.substring(0, 250) : null,
                                        status: "sent_successfully",
                                        timestamp: FieldValue.serverTimestamp()
                                    };
                                    try {
                                        const auditLogRef = firestore.collection('outboundAudits').doc(); // Auto-generate ID
                                        await auditLogRef.set(auditLogData);
                                        console.log(`[USER: ${userId}, MSG: ${messageId}] Audit log created for auto-sent message ${sendData.id}. Audit ID: ${auditLogRef.id}`);
                                    } catch (auditError) {
                                        console.error(`[USER: ${userId}, MSG: ${messageId}] Failed to write audit log for sent message ${sendData.id}:`, auditError);
                                        // Do not change finalProcessingStatus; email was sent successfully.
                                    }
                                } else {
                                    console.error(`[USER: ${userId}, MSG: ${messageId}] Gmail API send error: ${sendResponse.status}`, sendData);
                                    finalProcessingStatus = "auto_send_failed";
                                    llmErrorMessage = `Gmail API Send Error: ${sendData.error?.message || sendResponse.statusText}`;
                                    sentMessageDetails.sendError = sendData.error || { status: sendResponse.status, statusText: sendResponse.statusText };
                                }
                            } catch (sendApiError) {
                                console.error(`[USER: ${userId}, MSG: ${messageId}] Fetch error during Gmail API send:`, sendApiError.message);
                                finalProcessingStatus = "auto_send_api_error";
                                llmErrorMessage = `Send API Fetch Error: ${sendApiError.message}`;
                                sentMessageDetails.sendError = { message: sendApiError.message };
                            }
                        }
                    }
                } else if (autoSendIsEnabled && (!summaryText || processingStatus !== "summarized")) {
                    console.log(`[USER: ${userId}, MSG: ${messageId}] Auto-send enabled but conditions not met (summaryText: ${!!summaryText}, processingStatus: ${processingStatus}). Skipping auto-send.`);
                    // Keep finalProcessingStatus as is (e.g., summarization_failed)
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
                    status: finalProcessingStatus, 
                };

                if (autoSentReplyBody) {
                    dataToStore.autoSentReplyBody = autoSentReplyBody;
                }
                if (sentMessageDetails.sentMessageId) {
                    dataToStore.sentMessageId = sentMessageDetails.sentMessageId;
                    dataToStore.sentMessageThreadId = sentMessageDetails.sentMessageThreadId;
                }
                if (sentMessageDetails.sendError) {
                    dataToStore.sendErrorMessage = JSON.stringify(sentMessageDetails.sendError); // Store the error object as string
                }
                
                if (llmErrorMessage) {
                    // If there's an error message specifically from LLM (summary or reply gen) or send, use it.
                    // Avoid overwriting a specific send error with a generic processing status message.
                    dataToStore.errorMessage = llmErrorMessage;
                } else if (finalProcessingStatus.includes("failed") && !dataToStore.errorMessage && !sentMessageDetails.sendError) {
                    dataToStore.errorMessage = `Processing failed with status: ${finalProcessingStatus}`;
                }
                
                await processedEmailRef.set(dataToStore, { merge: true }); // Use merge:true to avoid overwriting if document already exists partially
                console.log(`Successfully stored/updated processed email ${messageId} with status '${finalProcessingStatus}' to Firestore.`);
                
                if (finalProcessingStatus === "auto_sent" || finalProcessingStatus === "summarized") {
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
