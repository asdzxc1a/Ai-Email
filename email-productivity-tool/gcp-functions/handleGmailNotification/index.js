// gcp-functions/handleGmailNotification/index.js
const { Firestore, FieldValue } = require('@google-cloud/firestore'); // Import FieldValue
const { fetchEmailContent } = require('./cfGmailUtils');
const { Deepseek } = require('@ai-sdk/deepseek');
const { generateText } = require('ai');

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
    const userAccessToken = userDoc.accessToken;
    if (!userAccessToken) { 
        console.error(`Access token not found for user ${userId} (email: ${emailAddress})`);
        return;
    }
    console.log(`Found user ${userId} with access token.`);

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
    console.log(`Found ${newMessages.length} new INBOX message(s) for user ${userId}. IDs: ${newMessages.join(', ')}`);
    
    const firstNewMessageId = newMessages[0];
    console.log(`Fetching content for message ${firstNewMessageId} for user ${userId}...`);
    const emailDetails = await fetchEmailContent(userAccessToken, firstNewMessageId);
    console.log(`Successfully fetched content for message ${firstNewMessageId}: Subject - "${emailDetails.subject}"`);

    let summaryText = null;
    let processingStatus = "content_fetched"; // Default status

    if (emailDetails && emailDetails.body) {
      const maxBodyLength = 15000;
      const truncatedBody = emailDetails.body.length > maxBodyLength 
                           ? emailDetails.body.substring(0, maxBodyLength) + "..." 
                           : emailDetails.body;
      const prompt = `Summarize the following email concisely:
From: ${emailDetails.from}
Subject: ${emailDetails.subject}
Body:
${truncatedBody}`;
      console.log(`Sending prompt to DeepSeek for message ${firstNewMessageId}...`);
      try {
        const { text: llmSummary } = await generateText({
          model: deepseek.chat('deepseek-chat'),
          prompt: prompt,
        });
        if (llmSummary) {
          summaryText = llmSummary;
          processingStatus = "summarized"; // Update status if summarization is successful
          console.log(`Generated Summary for message ${firstNewMessageId}: "${summaryText.substring(0,100)}..."`);
        } else {
          console.warn(`LLM returned an empty summary for message ${firstNewMessageId}.`);
          processingStatus = "summarization_empty";
        }
      } catch (llmError) {
        console.error(`LLM summarization error for message ${firstNewMessageId}:`, llmError.message);
        processingStatus = "summarization_failed";
        // Optionally store llmError.message in Firestore as well
      }
    } else {
      console.warn(`No body found or emailDetails missing for message ${firstNewMessageId}, skipping summarization.`);
      processingStatus = "no_body_for_summary";
    }

    // **NEW: Store in Firestore**
    const processedEmailRef = firestore.collection('processedEmails').doc(emailDetails.id);
    const dataToStore = {
      userId: userId, // Google User ID (sub)
      messageId: emailDetails.id,
      threadId: emailDetails.rawPayload ? emailDetails.rawPayload.threadId : null,
      subject: emailDetails.subject,
      from: emailDetails.from,
      date: emailDetails.date, // Consider converting to Firestore Timestamp if not already
      snippet: emailDetails.snippet,
      plainBody: emailDetails.body, // Storing the fetched body (might be truncated if we did that before prompt)
      summary: summaryText, // This will be null if summarization failed or was skipped
      processedAt: FieldValue.serverTimestamp(), // Use FieldValue
      status: processingStatus,
      // rawHeaders: emailDetails.rawPayload.headers, // Optional: for detailed debugging/future use
    };

    try {
      await processedEmailRef.set(dataToStore);
      console.log(`Successfully stored processed email ${emailDetails.id} with status '${processingStatus}' to Firestore.`);
    } catch (firestoreError) {
      console.error(`Error storing processed email ${emailDetails.id} to Firestore:`, firestoreError);
      // Decide on further error handling if Firestore write fails (e.g., retry, dead-letter queue)
    }

  } catch (error) {
    console.error(`Error processing notification for ${emailAddress}:`, error.message, error.stack);
  }
};
