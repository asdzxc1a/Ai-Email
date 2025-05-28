/**
 * Background Cloud Function to be triggered by Pub/Sub.
 * This function is triggered when a message is published to the topic
 * configured for Gmail push notifications.
 *
 * @param {object} pubSubEvent The event payload.
 * @param {object} context The event metadata.
 */
exports.handleGmailNotification = (pubSubEvent, context) => {
  const message = pubSubEvent.data
    ? Buffer.from(pubSubEvent.data, 'base64').toString()
    : null;

  if (message) {
    console.log('Received Gmail notification:');
    try {
      const notificationData = JSON.parse(message);
      console.log('Email:', notificationData.emailAddress);
      console.log('History ID:', notificationData.historyId);

      // TODO: Add logic here to:
      // 1. Validate the notification (optional, but good practice).
      // 2. Store the historyId or use it to fetch new messages.
      // 3. Trigger email processing (summarization, etc.).

    } catch (error) {
      console.error('Error parsing Gmail notification message:', error);
    }
  } else {
    console.log('Received empty Pub/Sub message.');
  }
};
