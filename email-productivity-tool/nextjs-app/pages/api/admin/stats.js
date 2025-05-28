// email-productivity-tool/nextjs-app/pages/api/admin/stats.js
import { getToken } from 'next-auth/jwt';
import admin from '../../../lib/firebaseAdmin'; // Adjust path to your firebaseAdmin init
import { checkAdminStatus } from '../../../lib/firestoreUtils'; // Adjust path

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

  try {
    // 1. Total Users
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // 2. Processed Emails Today & Errors Today
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    // Firestore Timestamps are needed for date range queries if 'processedAt' is a Firestore Timestamp
    const twentyFourHoursAgoTimestamp = admin.firestore.Timestamp.fromDate(twentyFourHoursAgo);

    const emailsTodayQuery = db.collection('processedEmails')
                               .where('processedAt', '>=', twentyFourHoursAgoTimestamp);
    const emailsTodaySnapshot = await emailsTodayQuery.get();
    const processedEmailsToday = emailsTodaySnapshot.size;

    let processingErrorsToday = 0;
    emailsTodaySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status && (data.status.includes('error') || data.status.includes('failed') || data.status.includes('_empty'))) {
        // Example: "summarization_failed", "processing_error", "summarization_empty", "no_body_for_summary"
        processingErrorsToday++;
      }
    });

    res.status(200).json({
      totalUsers,
      processedEmailsToday,
      processingErrorsToday,
    });

  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({ error: 'Internal server error while fetching statistics.' });
  }
}
