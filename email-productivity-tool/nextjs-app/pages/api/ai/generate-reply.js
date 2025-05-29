// email-productivity-tool/nextjs-app/pages/api/ai/generate-reply.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { fetchEmailContent } from '../../../lib/gmailUtils.js';
import { Deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { verifyGoogleIdTokenAndRetrieveUser } from '../../../lib/authAddonUtils'; // Import new util
import admin from '../../../lib/firebaseAdmin'; // Import Firebase Admin

const db = admin.firestore();
const DEFAULT_REPLY_PROMPT_ID = 'defaultReplyPrompt'; // Or 'replyGenerationDefault'

export default async function handler(req, res) {
  let userData; // To store user info from either session or token

  // Try NextAuth session first
  const session = await getServerSession(req, res, authOptions);
  if (session && session.accessToken && session.user && session.user.id) {
    userData = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      accessToken: session.accessToken,
    };
  } else {
    // If no session, try Google ID Token from Add-on
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        userData = await verifyGoogleIdTokenAndRetrieveUser(idToken);
      } catch (error) {
        console.error('Addon Auth Error in generate-reply:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Add-on token verification failed.', details: error.message });
      }
    }
  }

  if (!userData || !userData.accessToken) {
    return res.status(401).json({ error: 'Unauthorized. Valid user session or token required.' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messageId, replyContext, tone } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId in request body.' });
  }

  try {
    const emailDetails = await fetchEmailContent(userData.accessToken, messageId); // Use userData.accessToken

    if (!emailDetails) {
      return res.status(404).json({ error: 'Could not retrieve email content.' });
    }

    // Fetch prompt template from Firestore
    let promptTemplateString;
    try {
      const promptDoc = await db.collection('promptLibrary').doc(DEFAULT_REPLY_PROMPT_ID).get();
      if (promptDoc.exists && promptDoc.data().template) {
        promptTemplateString = promptDoc.data().template;
        console.log(`Successfully fetched prompt '${DEFAULT_REPLY_PROMPT_ID}' from Firestore.`);
      } else {
        console.warn(`Prompt document '${DEFAULT_REPLY_PROMPT_ID}' not found in 'promptLibrary' or template field missing. Falling back to a hardcoded default prompt.`);
        // Fallback hardcoded prompt string
        promptTemplateString = `You are an AI assistant.
Original Email Details:
From: {{originalFrom}}
Subject: {{originalSubject}}
Received At: {{originalDate}}
Body:
{{originalEmailBody}}
---
User's Instructions/Context for Reply: "{{userContext}}"
---
Draft a {{tone}} reply to the original email based on the user's instructions.
Generate only the body of the reply.`;
      }
    } catch (error) {
      console.error(`Error fetching prompt '${DEFAULT_REPLY_PROMPT_ID}' from Firestore:`, error);
      console.warn(`Falling back to a hardcoded default prompt due to Firestore error.`);
      // Fallback hardcoded prompt string in case of any error during fetch
      promptTemplateString = `You are an AI assistant.
Original Email Details:
From: {{originalFrom}}
Subject: {{originalSubject}}
Received At: {{originalDate}}
Body:
{{originalEmailBody}}
---
User's Instructions/Context for Reply: "{{userContext}}"
---
Draft a {{tone}} reply to the original email based on the user's instructions.
Generate only the body of the reply.`;
    }

    const actualTone = tone || 'professional';

    // Dynamically construct the prompt using the template and available data
    let finalPrompt = promptTemplateString;
    finalPrompt = finalPrompt.replace(/{{originalEmailBody}}/g, emailDetails.body || '');
    finalPrompt = finalPrompt.replace(/{{userContext}}/g, replyContext || ''); // Ensure undefined is handled as empty string
    finalPrompt = finalPrompt.replace(/{{tone}}/g, actualTone || 'professional');
    finalPrompt = finalPrompt.replace(/{{originalFrom}}/g, emailDetails.from || '');
    finalPrompt = finalPrompt.replace(/{{originalSubject}}/g, emailDetails.subject || '');
    finalPrompt = finalPrompt.replace(/{{originalDate}}/g, emailDetails.date || '');
    // Add any other placeholders as needed, e.g., {{userName}} if available and desired in prompt

    console.log(`Using prompt (first 100 chars): ${finalPrompt.substring(0,100)}...`);
    
    const MAX_PROMPT_LENGTH = 20000; // Keep a safeguard for prompt length
    if (finalPrompt.length > MAX_PROMPT_LENGTH) {
      finalPrompt = finalPrompt.substring(0, MAX_PROMPT_LENGTH) + "... (prompt truncated)";
      console.warn(`Warning: Final prompt for messageId ${messageId} was truncated.`);
    }
        
    const deepseek = new Deepseek();
    const { text: draftReply } = await generateText({
      model: deepseek.chat('deepseek-chat'),
      prompt: finalPrompt, // Use the dynamically constructed prompt
      temperature: 0.6 // Adjusted temperature, can also be part of prompt template or user setting
    });

    if (!draftReply) {
      return res.status(500).json({ error: 'LLM returned an empty reply.' });
    }
    res.status(200).json({ draftReply });

  } catch (error) {
    console.error('Error in reply generation service:', error);
    if (error.message && error.message.includes('authentication_error')) {
        return res.status(401).json({ error: 'LLM Authentication Error. Check API Key.' });
    }
    if (error.status && error.details) { // Error from fetchEmailContent
        return res.status(error.status).json({ error: error.message, details: error.details });
    }
    res.status(500).json({ error: 'Failed to generate email reply.', details: error.message || String(error) }); // Changed error to String(error)
  }
}
