// email-productivity-tool/nextjs-app/pages/api/admin/users/list.js
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

  const limit = parseInt(req.query.limit) || 30;
  const startAfterDocId = req.query.startAfterDocId || null;

  try {
    let query = db.collection('users')
                  .orderBy(admin.firestore.FieldPath.documentId()) // Order by document ID for consistent pagination
                  .limit(limit);

    if (startAfterDocId) {
      const startAfterDoc = await db.collection('users').doc(startAfterDocId).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      } else {
        // Handle case where startAfterDocId is invalid, maybe return error or first page
        console.warn(`startAfterDocId ${startAfterDocId} not found. Returning first page.`);
      }
    }
    
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json({ users: [], nextPageToken: null });
    }

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // This is the Google User ID (sub)
        email: data.email,
        name: data.name,
        isAdmin: data.isAdmin || false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        // Include other fields if necessary, e.g., lastSignInTime if you store it
      };
    });

    const lastVisibleDocId = users.length > 0 ? users[users.length - 1].id : null;

    res.status(200).json({ 
      users: users, 
      nextPageToken: snapshot.docs.length === limit ? lastVisibleDocId : null // Only provide token if there might be more
    });

  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Internal server error while fetching users.' });
  }
}
