// email-productivity-tool/nextjs-app/pages/api/admin/emails/detail.js
import { getToken } from 'next-auth/jwt';
import admin from '../../../../lib/firebaseAdmin'; // Adjust path to your firebaseAdmin init
import { checkAdminStatus } from '../../../../lib/firestoreUtils'; // Adjust path

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.userId) {
    return res.status(401).json({ error: 'Unauthorized: No session found.' });
  }

  const isAdmin = await checkAdminStatus(token.userId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: User is not an admin.' });
  }

  const { messageId } = req.query;

  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'Bad Request: Missing or invalid messageId query parameter.' });
  }

  try {
    const emailDocRef = db.collection('processedEmails').doc(messageId);
    const docSnap = await emailDocRef.get();

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Not Found: Processed email with the given messageId not found.' });
    }

    const emailData = docSnap.data();
    // Convert Firestore Timestamps to ISO strings for consistent API response
    const processedAtISO = emailData.processedAt?.toDate ? emailData.processedAt.toDate().toISOString() : emailData.processedAt;
    // Potentially convert other date fields if they exist and are Timestamps

    res.status(200).json({
      id: docSnap.id, // which is the messageId
      ...emailData,
      processedAt: processedAtISO, 
      // Ensure plainBody and summary are returned in full
    });

  } catch (error) {
    console.error(`Error fetching processed email detail for messageId ${messageId}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching email detail.' });
  }
}
