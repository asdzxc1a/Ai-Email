// email-productivity-tool/nextjs-app/pages/api/ai/summarize.js
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
        console.error('Addon Auth Error in summarize:', error.message);
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

  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId in request body.' });
  }

  try {
    const emailDetails = await fetchEmailContent(userData.accessToken, messageId); // Use userData.accessToken

    if (!emailDetails || !emailDetails.body) {
      return res.status(404).json({ error: 'Could not retrieve email content or body was empty.' });
    }
    
    const maxBodyLength = 15000; 
    const truncatedBody = emailDetails.body.length > maxBodyLength 
                         ? emailDetails.body.substring(0, maxBodyLength) + "..." 
                         : emailDetails.body;

    const prompt = `Summarize the following email concisely:
    From: ${emailDetails.from}
    Subject: ${emailDetails.subject}
    Body:
    ${truncatedBody}`;
    
    const deepseek = new Deepseek(); 
    
    const { text: summary } = await generateText({
      model: deepseek.chat('deepseek-chat'),
      prompt: prompt,
    });

    if (!summary) {
      return res.status(500).json({ error: 'LLM returned an empty summary.' });
    }
    res.status(200).json({ summary });

  } catch (error) {
    console.error('Error in summarization service:', error);
    if (error.message && error.message.includes('authentication_error')) { // LLM auth error
        return res.status(401).json({ error: 'LLM Authentication Error. Check API Key.' });
    }
    if (error.status && error.details) { // Error from fetchEmailContent
        return res.status(error.status).json({ error: error.message, details: error.details });
    }
    res.status(500).json({ error: 'Failed to summarize email.', details: error.message || String(error) }); // Changed error to String(error)
  }
}
