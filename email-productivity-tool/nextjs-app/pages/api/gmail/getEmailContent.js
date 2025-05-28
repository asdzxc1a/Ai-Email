// email-productivity-tool/nextjs-app/pages/api/gmail/getEmailContent.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { fetchEmailContent } from '../../../lib/gmailUtils.js'; // Adjusted path

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized. No active session or access token.' });
  }

  const { messageId } = req.query;

  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId parameter.' });
  }

  try {
    const emailDetails = await fetchEmailContent(session.accessToken, messageId);
    res.status(200).json(emailDetails);
  } catch (error) {
    console.error('Error in /api/gmail/getEmailContent endpoint:', error);
    const status = error.status || 500;
    res.status(status).json({ 
      error: error.message || 'Internal server error while fetching email content.',
      details: error.details 
    });
  }
}
