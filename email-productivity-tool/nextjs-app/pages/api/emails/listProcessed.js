// email-productivity-tool/nextjs-app/pages/api/emails/listProcessed.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth].js'; // Adjust path as necessary
import admin from '../../../lib/firebaseAdmin'; // Firebase Admin SDK for server-side Firestore access

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ error: 'Unauthorized. No active session or user ID.' });
  }

  const userId = session.user.id; // This is the Google User ID (sub)

  // Basic pagination: limit
  const limit = parseInt(req.query.limit) || 25; 
  // For cursor-based pagination, you'd also get req.query.startAfter (e.g., a doc ID or timestamp)

  try {
    let query = db.collection('processedEmails')
                  .where('userId', '==', userId)
                  .orderBy('processedAt', 'desc')
                  .limit(limit);

    // Example for cursor-based pagination (if req.query.startAfterDocId is provided):
    // if (req.query.startAfterDocId) {
    //   const startAfterDoc = await db.collection('processedEmails').doc(req.query.startAfterDocId).get();
    //   if (startAfterDoc.exists) {
    //     query = query.startAfter(startAfterDoc);
    //   }
    // }
    
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json({ emails: [], nextPageToken: null });
    }

    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        docId: doc.id, // This is the messageId
        messageId: data.messageId,
        subject: data.subject,
        from: data.from,
        date: data.date, // Consider converting to ISO string or consistent format if not already
        snippet: data.snippet,
        summary: data.summary,
        status: data.status,
        plainBody: data.plainBody, // Include for detail view from list data
        processedAt: data.processedAt?.toDate ? data.processedAt.toDate().toISOString() : data.processedAt, // Convert Firestore Timestamp
        // Add other fields needed for the list/detail view
      };
    });

    // For cursor-based pagination, the next page token could be the ID of the last document
    // const lastVisibleDocId = emails.length > 0 ? emails[emails.length - 1].docId : null;

    res.status(200).json({ 
        emails: emails, 
        // nextPageToken: lastVisibleDocId // For cursor-based pagination
    });

  } catch (error) {
    console.error('Error fetching processed emails:', error);
    res.status(500).json({ error: 'Internal server error while fetching processed emails.' });
  }
}
