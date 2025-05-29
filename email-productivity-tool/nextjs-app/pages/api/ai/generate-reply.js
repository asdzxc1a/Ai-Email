// email-productivity-tool/nextjs-app/pages/api/ai/generate-reply.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { fetchEmailContent } from '../../../lib/gmailUtils.js';
import { Deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { verifyGoogleIdTokenAndRetrieveUser } from '../../../lib/authAddonUtils'; // Import new util

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

    let prompt = `You are an AI assistant helping a user draft a reply to an email.
Here is the original email they received:

From: ${emailDetails.from}
Subject: ${emailDetails.subject}
Received At: ${emailDetails.date}

Body:
${emailDetails.body}

---
`;

    if (replyContext) {
      prompt += `The user has provided the following instructions or context for the reply:
"${replyContext.replace(/"/g, '\\"')}"
---
`;
    }

    const actualTone = tone || 'professional';
    prompt += `Please draft a ${actualTone} reply to this email.
If the original email asks a question, try to answer it.
If it's a statement, acknowledge it appropriately.
Keep the reply concise and relevant to the original email's content and user's instructions.
Do not invent information not present in the original email or user's context.
Focus on being helpful and clear.
Generate only the body of the reply, without any greetings like "Hi [User's Name]," or sign-offs like "Best regards, [User's Name]", unless specifically instructed by the user's context.`;
    
    // TODO: Load reply generation prompt dynamically from Firestore 'promptLibrary' collection (e.g., document ID 'replyGenerationDefault' or based on tone/context) instead of the current hardcoded/default approach. Implement error handling for prompt fetching.
    // Log placeholder for dynamic prompt loading
    console.info(`INFO: Using hardcoded/default reply generation prompt. Dynamic prompt loading from Firestore 'promptLibrary' collection (document ID: 'replyGenerationDefault') is pending implementation.`);
    
    const MAX_PROMPT_LENGTH = 20000;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.substring(0, MAX_PROMPT_LENGTH) + "... (prompt truncated)";
      console.warn(`Warning: Prompt for messageId ${messageId} was truncated.`);
    }
        
    const deepseek = new Deepseek();
    const { text: draftReply } = await generateText({
      model: deepseek.chat('deepseek-chat'),
      prompt: prompt,
      temperature: 0.6 // Added temperature
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
