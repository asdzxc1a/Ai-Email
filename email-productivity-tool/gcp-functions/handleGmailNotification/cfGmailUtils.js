// gcp-functions/handleGmailNotification/cfGmailUtils.js
// (Content is identical to lib/gmailUtils.js - base64UrlDecode, getEmailBody, fetchEmailContent)
// Ensure fetch is available (global in Node 18+ on CF, or add node-fetch for older)

// Helper function to decode base64url
function base64UrlDecode(str) {
  let base64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Helper function to find email body part (prefer text/plain)
function getEmailBody(payload) {
  let body = '';
  if (!payload) return body;

  if (payload.parts) {
    const plainTextPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainTextPart && plainTextPart.body && plainTextPart.body.data) {
      body = base64UrlDecode(plainTextPart.body.data);
    } else {
      const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        body = base64UrlDecode(htmlPart.body.data); 
      } else {
        for (const part of payload.parts) {
          if (part.parts && part.parts.length > 0) {
            body = getEmailBody(part);
            if (body) break;
          }
        }
      }
    }
  } else if (payload.body && payload.body.data) {
    body = base64UrlDecode(payload.body.data);
  }
  return body;
}

async function fetchEmailContent(accessToken, messageId) {
  if (!accessToken || !messageId) {
    throw new Error('Missing accessToken or messageId for fetching email content.');
  }
  const GMAIL_API_ENDPOINT = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const response = await fetch(GMAIL_API_ENDPOINT, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gmail API error in fetchEmailContent:', errorData);
    const err = new Error('Failed to fetch email content from Gmail in utility function.');
    err.status = response.status;
    err.details = errorData;
    throw err;
  }
  const emailData = await response.json();
  const { id, snippet, payload } = emailData;
  let subject = '';
  let from = '';
  let date = '';
  if (payload && payload.headers) {
    subject = payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    from = payload.headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    date = payload.headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
  }
  const body = getEmailBody(payload || {});
  return { id, subject, from, date, snippet, body, rawPayload: payload };
}

module.exports = { fetchEmailContent, base64UrlDecode, getEmailBody }; // Export for use in index.js
