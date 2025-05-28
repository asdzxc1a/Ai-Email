// email-productivity-tool/apps-script-addon/Code.gs

// IMPORTANT: Replace this URL with your actual deployed Next.js application URL
const NEXTJS_APP_BASE_URL = "https://your-nextjs-app-deployment-url.com"; 
const TONE_OPTIONS = ["professional", "casual", "friendly", "concise", "declined_politely"];

// onOpen(e) function remains the same
function onOpen(e) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Productivity Tool'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('Welcome! Open an email to see contextual actions.')))
    .build();
}

// onGmailMessage function remains the same as defined in subtask #22 (turn 61)
function onGmailMessage(e) {
  console.log("onGmailMessage event object:", JSON.stringify(e));
  var accessToken = e.gmail.accessToken; 
  var messageId = e.gmail.messageId;
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
  card.setHeader(CardService.newCardHeader().setTitle("Email Actions for:").setSubtitle(subject).setImageUrl("https://www.gstatic.com/images/icons/material/system/1x/gsuite_addons_24dp.png"));
  
  var summarizeSection = CardService.newCardSection().setHeader("Summarize");
  var summarizeAction = CardService.newAction()
      .setFunctionName("handleSummarizeEmailAction")
      .setParameters({action: "summarize", messageId: messageId});
  summarizeSection.addWidget(CardService.newTextButton().setText("Summarize Email").setOnClickAction(summarizeAction));
  card.addSection(summarizeSection);

  var draftReplySection = CardService.newCardSection().setHeader("Draft Reply");
  var replyContextInput = CardService.newTextInput()
      .setTitle("Reply Context (Optional)")
      .setHint("Specific instructions for the reply, e.g., 'Tell them I am OOO next week.'")
      .setFieldName("replyContext")
      .setMultiline(true);
  draftReplySection.addWidget(replyContextInput);
  var toneSelection = CardService.newSelectionInput()
      .setTitle("Tone (Optional)")
      .setFieldName("tone")
      .setType(CardService.SelectionInputType.DROPDOWN);
  toneSelection.addItem("Default (Professional)", "", true);
  TONE_OPTIONS.forEach(function(tone) {
    toneSelection.addItem(tone.charAt(0).toUpperCase() + tone.slice(1), tone, false);
  });
  draftReplySection.addWidget(toneSelection);
  var replyAction = CardService.newAction()
      .setFunctionName("handleDraftReplyAction")
      .setParameters({action: "reply", messageId: messageId});
  draftReplySection.addWidget(CardService.newTextButton().setText("Generate Draft Reply").setOnClickAction(replyAction));
  card.addSection(draftReplySection);
  return card.build();
}

// handleSummarizeEmailAction function remains the same as implemented in subtask #20 (turn 39)
function handleSummarizeEmailAction(e) {
  var messageId = e.parameters.messageId;
  if (!messageId) {
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Error: Message ID not found."))
        .build();
  }
  var identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) {
    console.error("Failed to get Identity Token. User may need to re-authorize, or there might be domain restrictions.");
    var authErrorCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Authentication Error"))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("Could not obtain user identity token. This might be due to permissions not being fully granted or domain security policies. Please try removing and re-installing the add-on, ensuring all permission scopes are approved. If the issue persists, contact your administrator.")))
      .build();
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([authErrorCard]).build();
  }
  var apiUrl = NEXTJS_APP_BASE_URL + "/api/ai/summarize";
  var payload = JSON.stringify({ messageId: messageId });
  var options = {
    method: "post", contentType: "application/json",
    headers: { "Authorization": "Bearer " + identityToken },
    payload: payload, muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    var cardBuilder = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle("Email Summary"));
    var section = CardService.newCardSection();
    if (responseCode === 200) {
      var summaryData = JSON.parse(responseBody);
      section.addWidget(CardService.newTextParagraph().setText(summaryData.summary || "No summary content in response."));
    } else {
      console.error("Error from Summarize API: " + responseCode + " - " + responseBody);
      var errorDetails = "Error: " + responseCode; try { var errorJson = JSON.parse(responseBody); if(errorJson.error) errorDetails += ": " + errorJson.error; if(errorJson.details) errorDetails += " (" + errorJson.details + ")"; } catch(parseErr) { errorDetails += ". Could not parse error response."; }
      section.addWidget(CardService.newTextParagraph().setText("Failed to get summary. " + errorDetails));
    }
    cardBuilder.addSection(section);
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([cardBuilder.build()]).build();
  } catch (err) {
    console.error("Critical error in handleSummarizeEmailAction: " + err.toString() + " Stack: " + err.stack);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Critical error: " + err.message)).build();
  }
}

function handleDraftReplyAction(e) {
  var messageId = e.parameters.messageId;
  var formInputs = e.formInputs || {};
  var aPSReplyContext = formInputs.replyContext ? formInputs.replyContext[0] : "";
  var aPSTone = formInputs.tone ? formInputs.tone[0] : "";

  console.log("Draft Reply Action: messageId=" + messageId + ", context='" + aPSReplyContext + "', tone='" + aPSTone + "'");

  if (!messageId) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: Message ID missing.")).build();
  }
  var identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) {
    var errorCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Authentication Error"))
      .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText("Could not obtain identity token. Please try re-installing the add-on and ensure all permissions are granted.")))
      .build();
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([errorCard]).build();
  }

  var apiUrl = NEXTJS_APP_BASE_URL + "/api/ai/generate-reply";
  var payload = { 
    messageId: messageId,
    replyContext: aPSReplyContext || undefined, 
    tone: aPSTone || undefined 
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + identityToken },
    payload: JSON.stringify(payload),
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
         section.addWidget(CardService.newTextParagraph().setText(replyData.draftReply));
         
         // **NEW: Add "Insert into Reply" button**
         var insertAction = CardService.newAction()
             .setFunctionName("handleInsertIntoComposerAction")
             .setParameters({ 
                 messageId: messageId, 
                 draftReplyText: replyData.draftReply // Pass the draft text
             });
         section.addWidget(CardService.newTextButton().setText("Insert into Reply Composer").setOnClickAction(insertAction));

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
    return CardService.newUniversalActionResponseBuilder().displayAddOnCards([cardBuilder.build()]).build();

  } catch (err) {
    console.error("Critical error in handleDraftReplyAction: " + err.toString() + " Stack: " + err.stack);
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Critical error: " + err.message)).build();
  }
}

// **NEW: handleInsertIntoComposerAction function**
function handleInsertIntoComposerAction(e) {
  var messageId = e.parameters.messageId;
  var draftReplyText = e.parameters.draftReplyText;

  if (!messageId || draftReplyText === undefined || draftReplyText === null) {
    console.error("Insert Action: Missing messageId or draftReplyText. MessageId: " + messageId + ", DraftText: " + draftReplyText);
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Error: Missing data for inserting reply."))
        .build();
  }

  try {
    // Activate temporary Gmail scopes, this is good practice before GmailApp calls
    // This is necessary because the e.gmail.accessToken from onGmailMessage is not available here.
    // However, it seems that if user has granted scopes, direct GmailApp calls might work
    // during an add-on action context. If this fails, we might need to re-think token passing
    // or use a different method if available for add-on actions.
    // For now, relying on the already granted permissions.
    var message = GmailApp.getMessageById(messageId);
    if (message) {
      // Using createDraftReply to open the reply composer with the text.
      // This method automatically handles HTML if draftReplyText is HTML, or plain text.
      message.createDraftReply(draftReplyText); 
      
      // After creating the draft, the user is typically taken to the Gmail composer.
      // We can provide a notification that this action was taken.
      return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification().setText("Draft created and opened in Gmail composer."))
          .build();
    } else {
      console.error("Insert Action: Could not find message with ID: " + messageId);
      return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification().setText("Error: Could not find original message to reply to."))
          .build();
    }
  } catch (error) {
    console.error("Error in handleInsertIntoComposerAction: " + error.toString() + " Stack: " + error.stack);
    // Specific check for authorization error
    if (error.message.toLowerCase().includes("authorization")) {
        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification().setText("Authorization error. Ensure 'gmail.compose' scope is granted."))
            .build();
    }
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Error creating draft: " + error.message))
        .build();
  }
}

// logAction can be removed if no longer used by any UI elements.
function logAction(e) {
  console.log("Action triggered (logAction):", JSON.stringify(e.parameters));
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Logged action: " + e.parameters.action))
      .build();
}
