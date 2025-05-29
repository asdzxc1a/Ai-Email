// email-productivity-tool/nextjs-app/pages/api/gmail/send.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';

// Helper function to encode a string to base64url
// (Identical to the one used in Cloud Function and potentially other places)
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper function to extract email address from "Name <email@example.com>" format
// This is important if the recipientEmail comes in that format.
// For this API, we'll assume recipientEmail is already just the email address.
// If not, this function or similar would be needed.
function extractEmailAddress(fullEmailAddress) {
    if (!fullEmailAddress) return null;
    const match = fullEmailAddress.match(/<([^>]+)>/);
    return match ? match[1] : fullEmailAddress;
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.accessToken || !session.user || !session.user.email) {
    return res.status(401).json({ error: 'Unauthorized. Valid user session required.' });
  }

  const { originalMessageId, replyBody, recipientEmail, originalSubject } = req.body;

  // Validate input
  if (!originalMessageId || typeof originalMessageId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid originalMessageId.' });
  }
  if (!replyBody || typeof replyBody !== 'string') { // Allow empty string for replyBody if user deletes everything
    return res.status(400).json({ error: 'Missing or invalid replyBody.' });
  }
  if (!recipientEmail || typeof recipientEmail !== 'string' || !extractEmailAddress(recipientEmail.trim())) {
    return res.status(400).json({ error: 'Missing or invalid recipientEmail.' });
  }
  if (typeof originalSubject !== 'string') { // originalSubject can be an empty string
    return res.status(400).json({ error: 'Invalid originalSubject.' });
  }

  const cleanRecipientEmail = extractEmailAddress(recipientEmail.trim());
  if (!cleanRecipientEmail) {
    return res.status(400).json({ error: 'Invalid recipientEmail format.' });
  }

  try {
    // 1. Fetch original email headers for Message-ID and References
    const metadataUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${originalMessageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${session.accessToken}` },
    });

    if (!metadataRes.ok) {
      const errorData = await metadataRes.json();
      console.error('Gmail API error fetching metadata:', errorData);
      return res.status(metadataRes.status).json({ error: 'Failed to fetch original email metadata.', details: errorData });
    }
    const emailMetadata = await metadataRes.json();
    
    const originalMessageIdHeader = emailMetadata.payload.headers.find(h => h.name.toLowerCase() === 'message-id')?.value;
    const originalReferencesHeader = emailMetadata.payload.headers.find(h => h.name.toLowerCase() === 'references')?.value;

    if (!originalMessageIdHeader) {
        // This is unlikely for most emails but good to guard against.
        console.error('Could not find Message-ID header in original email metadata for messageId:', originalMessageId);
        return res.status(400).json({ error: 'Could not find Message-ID in original email. Cannot construct valid reply headers.' });
    }

    // 2. Construct MIME Message
    let mimeMessage = `To: ${cleanRecipientEmail}\r\n`;
    mimeMessage += `From: ${session.user.email}\r\n`;
    mimeMessage += `Subject: Re: ${originalSubject}\r\n`;
    mimeMessage += `In-Reply-To: ${originalMessageIdHeader}\r\n`;
    if (originalReferencesHeader) {
      mimeMessage += `References: ${originalReferencesHeader} ${originalMessageIdHeader}\r\n`;
    } else {
      mimeMessage += `References: ${originalMessageIdHeader}\r\n`;
    }
    mimeMessage += `Content-Type: text/plain; charset=utf-8\r\n`;
    mimeMessage += `\r\n`; // Blank line before body
    mimeMessage += `${replyBody}`;

    const rawEmail = base64urlEncode(mimeMessage);

    // 3. Send Email via Gmail API
    const sendUrl = 'https://www.googleapis.com/gmail/v1/users/me/messages/send';
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEmail }),
    });

    const sendData = await sendResponse.json();
    if (!sendResponse.ok) {
      console.error('Gmail API send error:', sendData);
      return res.status(sendResponse.status).json({ error: 'Failed to send email via Gmail.', details: sendData });
    }

    // 4. Response
    return res.status(200).json({ success: true, messageId: sendData.id, threadId: sendData.threadId });

  } catch (error) {
    console.error('Error in /api/gmail/send:', error);
    return res.status(500).json({ error: 'Internal server error.', details: error.message || String(error) });
  }
}
