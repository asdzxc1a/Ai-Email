// email-productivity-tool/nextjs-app/pages/api/ai/summarize.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { fetchEmailContent } from '../../../lib/gmailUtils.js'; // Adjusted path
import { Deepseek } from '@ai-sdk/deepseek'; // Import Deepseek
import { generateText } from 'ai'; // Import generateText from Vercel AI SDK

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messageId } = req.body; // Changed from textToSummarize to messageId

  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId in request body.' });
  }

  try {
    // 1. Fetch email content
    const emailDetails = await fetchEmailContent(session.accessToken, messageId);

    if (!emailDetails || !emailDetails.body) {
      return res.status(404).json({ error: 'Could not retrieve email content or body was empty.' });
    }
    
    // 2. Prepare prompt for DeepSeek
    // Ensure emailDetails.body is not excessively long. Truncate if necessary.
    // DeepSeek (and other LLMs) have token limits.
    const maxBodyLength = 15000; // Example: ~4k tokens, adjust as needed
    const truncatedBody = emailDetails.body.length > maxBodyLength 
                         ? emailDetails.body.substring(0, maxBodyLength) + "..." 
                         : emailDetails.body;

    const prompt = `Summarize the following email concisely:
    From: ${emailDetails.from}
    Subject: ${emailDetails.subject}
    Body:
    ${truncatedBody}`;

    // 3. Call DeepSeek API via Vercel AI SDK
    // Ensure DEEPSEEK_API_KEY is set in your .env.local
    const deepseek = new Deepseek({
      // apiKey: process.env.DEEPSEEK_API_KEY // Not typically needed if env var is set
    }); 
    
    const { text: summary } = await generateText({
      model: deepseek.chat('deepseek-chat'), // Specify the model
      prompt: prompt,
      // You can add other parameters like temperature, maxTokens etc. here
      // system: "You are an expert email summarizer." // Optional system prompt
    });

    if (!summary) {
      return res.status(500).json({ error: 'LLM returned an empty summary.' });
    }

    res.status(200).json({ summary });

  } catch (error) {
    console.error('Error in summarization service:', error);
    if (error.message && error.message.includes('authentication_error')) {
        return res.status(401).json({ error: 'LLM Authentication Error. Check API Key.' });
    }
    // Check for specific Vercel AI SDK errors related to API key missing
    if (error.message && error.message.includes("Missing API key")) {
        console.error("DeepSeek API Key is missing. Ensure DEEPSEEK_API_KEY is set in .env.local");
        return res.status(500).json({ error: 'LLM Configuration Error: API Key missing.' });
    }
    res.status(500).json({ 
        error: 'Failed to summarize email.', 
        details: error.message || String(error) 
    });
  }
}
