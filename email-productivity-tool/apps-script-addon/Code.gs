// email-productivity-tool/apps-script-addon/Code.gs

// IMPORTANT: Replace this URL with your actual deployed Next.js application URL
const NEXTJS_APP_BASE_URL = "https://your-nextjs-app-deployment-url.com"; 

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
      .setFunctionName("handleSummarizeEmailAction") // Changed from logAction
      .setParameters({action: "summarize", messageId: messageId}); // messageId is already being passed
  section.addWidget(CardService.newTextButton().setText("Summarize Email").setOnClickAction(summarizeAction)); // Text updated
  
  var replyAction = CardService.newAction()
      .setFunctionName("handleDraftReplyAction") // Changed from logAction
      .setParameters({action: "reply", messageId: messageId}); // messageId is already being passed
  section.addWidget(CardService.newTextButton().setText("Draft Reply").setOnClickAction(replyAction)); // Text updated

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

function handleSummarizeEmailAction(e) {
  var messageId = e.parameters.messageId;
  if (!messageId) {
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Error: Message ID not found."))
        .build();
  }

  var identityToken = ScriptApp.getIdentityToken();
  
  // It's possible getIdentityToken() returns null or empty if scopes aren't fully granted
  // or if domain policies restrict it.
  if (!identityToken) {
    console.error("Failed to get Identity Token. User may need to re-authorize, or there might be domain restrictions.");
    // Consider building a card that explains the error and asks to re-authorize.
    var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Authentication Error"))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("Could not obtain user identity token. This might be due to permissions not being fully granted or domain security policies. Please try removing and re-installing the add-on, ensuring all permission scopes are approved. If the issue persists, contact your administrator.")))
      .build();
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([card]).build();
  }

  var apiUrl = NEXTJS_APP_BASE_URL + "/api/ai/summarize";
  var payload = JSON.stringify({ messageId: messageId });
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + identityToken
    },
    payload: payload,
    muteHttpExceptions: true // Important to handle errors gracefully
  };

  // Show a temporary "loading" card or notification
  // var tempCard = CardService.newCardBuilder()
  //   .setHeader(CardService.newCardHeader().setTitle("Summarizing..."))
  //   .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText("Please wait while the summary is being generated.")))
  //   .build();
  // Using UniversalActionResponse to update the UI immediately with a loading card
  // This requires the calling action in onGmailMessage to also use UniversalActionResponse
  // For simplicity now, we'll just update with a notification and then the result.
  // A better UX would be to push a new card with "Summarizing..."

  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    var cardBuilder = CardService.newCardBuilder();
    cardBuilder.setHeader(CardService.newCardHeader().setTitle("Email Summary"));
    var section = CardService.newCardSection();

    if (responseCode === 200) {
      var summaryData = JSON.parse(responseBody);
      if (summaryData.summary) {
        section.addWidget(CardService.newTextParagraph().setText(summaryData.summary));
      } else {
        section.addWidget(CardService.newTextParagraph().setText("Failed to get summary. No summary content in response."));
      }
    } else {
      console.error("Error from Summarize API: " + responseCode + " - " + responseBody);
      var errorDetails = "Error: " + responseCode;
      try {
        var errorJson = JSON.parse(responseBody);
        if(errorJson.error) errorDetails += ": " + errorJson.error;
        if(errorJson.details) errorDetails += " (" + errorJson.details + ")";
      } catch(e) {
        // responseBody was not JSON or malformed
         errorDetails += ". Could not parse error response.";
      }
      section.addWidget(CardService.newTextParagraph().setText("Failed to get summary. " + errorDetails));
    }
    cardBuilder.addSection(section);
    
    // Action to go back or refresh (optional)
    // var goBackAction = CardService.newAction().setFunctionName("onGmailMessage").setParameters(e.parameters); // Re-render original card
    // cardBuilder.addFixedFooter(CardService.newFixedFooter().setPrimaryButton(CardService.newTextButton().setText("Back").setOnClickAction(goBackAction)));

    // Using UniversalActionResponse to display the new card with the summary or error
    return CardService.newUniversalActionResponseBuilder()
        .displayAddOnCards([cardBuilder.build()])
        .build();

  } catch (err) {
    console.error("Critical error in handleSummarizeEmailAction: " + err.toString() + " Stack: " + err.stack);
    // This catches errors like UrlFetchApp failing entirely (e.g. URL unreachable)
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Critical error: " + err.message))
        .build();
  }
}

function handleDraftReplyAction(e) {
  var messageId = e.parameters.messageId;
  if (!messageId) {
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Error: Message ID not found."))
        .build();
  }

  var identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) {
    console.error("Failed to get Identity Token for Draft Reply. User may need to re-authorize.");
    var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Authentication Error"))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("Could not obtain user identity token. Please try re-installing the add-on and ensure all permissions are granted.")))
      .build();
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([card]).build();
  }

  var apiUrl = NEXTJS_APP_BASE_URL + "/api/ai/generate-reply";
  // For this initial version, no replyContext or tone is sent from the add-on.
  // The backend will use its defaults.
  var payload = JSON.stringify({ messageId: messageId }); 
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + identityToken
    },
    payload: payload,
    muteHttpExceptions: true 
  };

  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    var cardBuilder = CardService.newCardBuilder();
    cardBuilder.setHeader(CardService.newCardHeader().setTitle("Generated Draft Reply"));
    var section = CardService.newCardSection();

    if (responseCode === 200) {
      var replyData = JSON.parse(responseBody);
      if (replyData.draftReply) {
        // Displaying the draft reply. Consider how to best present potentially long text.
        // A text area or a preformatted block might be good. For now, TextParagraph.
         section.addWidget(CardService.newTextParagraph().setText(replyData.draftReply));
      } else {
        section.addWidget(CardService.newTextParagraph().setText("Failed to get draft reply. No content in response."));
      }
    } else {
      console.error("Error from Draft Reply API: " + responseCode + " - " + responseBody);
      var errorDetails = "Error: " + responseCode;
       try {
        var errorJson = JSON.parse(responseBody);
        if(errorJson.error) errorDetails += ": " + errorJson.error;
        if(errorJson.details) errorDetails += " (" + errorJson.details + ")";
      } catch(parseErr) {
         errorDetails += ". Could not parse error response.";
      }
      section.addWidget(CardService.newTextParagraph().setText("Failed to generate draft reply. " + errorDetails));
    }
    cardBuilder.addSection(section);
    
    // Optionally, add a button to copy the draft reply to clipboard, or insert into reply composer
    // (Requires more advanced Gmail API interaction with draft/reply composer - for a future step)
    // section.addWidget(CardService.newTextButton().setText("Copy to Clipboard (Not Implemented Yet)").setOnClickAction(CardService.newAction().setFunctionName("logAction")));


    return CardService.newUniversalActionResponseBuilder()
        .displayAddOnCards([cardBuilder.build()])
        .build();

  } catch (err) {
    console.error("Critical error in handleDraftReplyAction: " + err.toString() + " Stack: " + err.stack);
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Critical error generating reply: " + err.message))
        .build();
  }
}
