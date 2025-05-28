// email-productivity-tool/nextjs-app/pages/api/ai/generate-reply.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { fetchEmailContent } from '../../../lib/gmailUtils.js'; // Adjusted path
import { Deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messageId, replyContext, tone } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId in request body.' });
  }

  try {
    // 1. Fetch email content
    const emailDetails = await fetchEmailContent(session.accessToken, messageId);

    if (!emailDetails) {
      return res.status(404).json({ error: 'Could not retrieve email content.' });
    }

    // 2. Construct the prompt for DeepSeek
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
"${replyContext.replace(/"/g, '\\"')}" // Basic escaping for quotes in context
---
`;
    }

    const actualTone = tone || 'professional'; // Default to professional if no tone specified
    prompt += `Please draft a ${actualTone} reply to this email.
If the original email asks a question, try to answer it.
If it's a statement, acknowledge it appropriately.
Keep the reply concise and relevant to the original email's content and user's instructions.
Do not invent information not present in the original email or user's context.
Focus on being helpful and clear.
Generate only the body of the reply, without any greetings like "Hi [User's Name]," or sign-offs like "Best regards, [User's Name]", unless specifically instructed by the user's context.`;

    // Basic truncation for the overall prompt to avoid issues if email body was huge
    // This is a safeguard; individual parts like emailDetails.body should ideally be managed too.
    const MAX_PROMPT_LENGTH = 20000; // Adjust as needed based on model limits
    if (prompt.length > MAX_PROMPT_LENGTH) {
      // Find a way to truncate intelligently, or truncate the body part of the prompt
      // For now, simple truncation of the whole prompt
      prompt = prompt.substring(0, MAX_PROMPT_LENGTH) + "... (prompt truncated)";
      console.warn(`Warning: Prompt for messageId ${messageId} was truncated.`);
    }
    
    // 3. Call DeepSeek API
    // Ensure DEEPSEEK_API_KEY is set in your .env.local
    const deepseek = new Deepseek(); // API key from process.env.DEEPSEEK_API_KEY

    const { text: draftReply } = await generateText({
      model: deepseek.chat('deepseek-chat'), // Or 'deepseek-reasoner'
      prompt: prompt,
      // system: "You are an expert email reply assistant." // Alternative way for system prompt
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
    // Check if it's an error from fetchEmailContent
    if (error.status && error.details) {
        return res.status(error.status).json({
            error: error.message || 'Failed to fetch email content for reply generation.',
            details: error.details
        });
    }
    res.status(500).json({ 
        error: 'Failed to generate email reply.', 
        details: error.message || String(error) // Changed 'error' to 'String(error)'
    });
  }
}
