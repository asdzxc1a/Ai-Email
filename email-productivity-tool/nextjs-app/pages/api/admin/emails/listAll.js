// email-productivity-tool/nextjs-app/pages/api/admin/emails/listAll.js
import { getToken } from 'next-auth/jwt';
import admin from '../../../../lib/firebaseAdmin'; // Adjust path
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

  const limit = parseInt(req.query.limit) || 30;
  const startAfterDocId = req.query.startAfterDocId || null; // This will be messageId
  const filterUserId = req.query.userId || null;
  const filterStatus = req.query.status || null;

  try {
    let query = db.collection('processedEmails');
    
    if (filterUserId) {
      query = query.where('userId', '==', filterUserId);
    }
    if (filterStatus) {
      query = query.where('status', '==', filterStatus);
    }
    
    // Note: Firestore requires an index for queries with multiple where clauses and an orderBy on a different field.
    // If filtering by userId or status, ordering by processedAt might need a composite index.
    // For simplicity, if filters are applied, we might remove explicit orderBy('processedAt') or ensure indexes.
    // Or, order by processedAt first, then apply filters if possible on client or with more complex queries.
    // For now, let's order by processedAt and assume if filters are used, an index would be needed.
    // If filterUserId is present, ordering by processedAt for that specific user is fine.
    query = query.orderBy('processedAt', 'desc'); 

    if (startAfterDocId) {
      const startAfterDoc = await db.collection('processedEmails').doc(startAfterDocId).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      } else {
        console.warn(`startAfterDocId ${startAfterDocId} for processedEmails not found. Returning first page.`);
      }
    }
    
    query = query.limit(limit);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json({ emails: [], nextPageToken: null });
    }

    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // This is the messageId
        userId: data.userId,
        subject: data.subject,
        from: data.from,
        status: data.status,
        summary: data.summary ? data.summary.substring(0, 100) + (data.summary.length > 100 ? '...' : '') : 'N/A', // Snippet
        processedAt: data.processedAt?.toDate ? data.processedAt.toDate().toISOString() : data.processedAt,
        // Add other fields as needed
      };
    });

    const lastVisibleDocId = emails.length > 0 ? emails[emails.length - 1].id : null;

    res.status(200).json({ 
      emails: emails, 
      nextPageToken: snapshot.docs.length === limit ? lastVisibleDocId : null
    });

  } catch (error) {
    console.error('Error fetching all processed emails for admin:', error);
    // Check for specific Firestore index errors if they occur
    if (error.message && error.message.includes('requires an index')) {
        return res.status(500).json({ error: 'Query requires a Firestore index. Please create it in the Firebase console.', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error while fetching processed emails.' });
  }
}
