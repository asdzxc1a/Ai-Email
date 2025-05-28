import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js';
import { updateUser } from '../../../lib/firestoreUtils'; // Adjusted path, removed getUser as it's not used in this version

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id || !session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized or missing user ID/access token in session.' });
  }

  const userId = session.user.id;
  const accessToken = session.accessToken;

  const GMAIL_API_ENDPOINT = 'https://www.googleapis.com/gmail/v1/users/me/watch';
  // Use FIREBASE_PROJECT_ID for the Pub/Sub topic path
  const pubSubTopicName = `projects/${process.env.FIREBASE_PROJECT_ID}/topics/gmail-push-notifications-placeholder`; 

  try {
    const response = await fetch(GMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        labelIds: ['INBOX'],
        topicName: pubSubTopicName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gmail API watch error:', data);
      return res.status(response.status).json({ error: 'Failed to set up Gmail watch', details: data });
    }

    // Update user in Firestore with historyId and expiration
    await updateUser(userId, {
      gmailHistoryId: data.historyId,
      // Store expiration as a JavaScript Date object, Firestore will convert it to Timestamp
      watchExpiration: new Date(Number(data.expiration)), 
    });

    console.log('Gmail API watch setup successful and user updated in Firestore:', data);
    res.status(200).json({ success: true, details: data });

  } catch (error) {
    console.error('Error calling Gmail watch API or updating Firestore:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
