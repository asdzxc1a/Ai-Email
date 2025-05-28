// email-productivity-tool/apps-script-addon/Code.gs
function onOpen(e) {
  // This function runs when the add-on is opened from the Add-ons menu
  // It's not context-aware, so it's less relevant for message-specific actions
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Productivity Tool'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('Welcome! Open an email to see contextual actions.')))
    .build();
}

/**
 * Callback for rendering the main card for a specific Gmail message.
 * @param {Object} e The event object passed by Gmail, containing message context.
 * @return {CardService.Card} The card to display.
 */
function onGmailMessage(e) {
  console.log("onGmailMessage event object:", JSON.stringify(e));

  // The add-on needs access to the current message metadata.
  // This access token is short-lived and specific to the add-on's execution.
  var accessToken = e.gmail.accessToken; 
  var messageId = e.gmail.messageId;

  // Activate temporary Gmail scopes, if not already active
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var mailMessage;
  var subject = "N/A";
  try {
    mailMessage = GmailApp.getMessageById(messageId);
    subject = mailMessage.getSubject();
  } catch (err) {
    console.error("Error accessing Gmail message:", err);
    subject = "Error accessing subject";
  }
  
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Email Actions"));
  
  var section = CardService.newCardSection().setHeader("Current Email");
  section.addWidget(CardService.newKeyValue().setTopLabel("Subject").setContent(subject));

  // Placeholder buttons - these don't do anything yet other than log
  var summarizeAction = CardService.newAction()
      .setFunctionName("logAction")
      .setParameters({action: "summarize", messageId: messageId});
  section.addWidget(CardService.newTextButton().setText("Summarize Email (Placeholder)").setOnClickAction(summarizeAction));
  
  var replyAction = CardService.newAction()
      .setFunctionName("logAction")
      .setParameters({action: "reply", messageId: messageId});
  section.addWidget(CardService.newTextButton().setText("Draft Reply (Placeholder)").setOnClickAction(replyAction));

  card.addSection(section);
  return card.build();
}

/**
 * Generic logging function for card actions.
 * @param {Object} e The event object from the action.
 */
function logAction(e) {
  console.log("Action triggered:", JSON.stringify(e.parameters));
  var message = "Action: " + e.parameters.action + " on message " + e.parameters.messageId;
  // For user feedback, you might show a notification
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Logged: " + e.parameters.action))
      .build();
}
