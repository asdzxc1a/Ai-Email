import { getSession } from 'next-auth/react';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (robust initialization)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!getApps().length) {
  if (serviceAccount.privateKey && serviceAccount.projectId && serviceAccount.clientEmail) {
    try {
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully for /api/admin/feedback/replies.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK for /api/admin/feedback/replies:", error);
    }
  } else {
    console.warn("Firebase Admin SDK credentials missing for /api/admin/feedback/replies. API will not function correctly.");
  }
}
const db = getApps().length > 0 ? getFirestore() : null;

// isAdmin helper function (can be imported from a shared util if created)
async function isAdmin(session) {
  if (!db) { 
    console.error("isAdmin check failed: Firestore DB not initialized.");
    return false;
  }
  if (!session || !session.user || !session.user.id) {
    return false;
  }
  if (typeof session.user.isAdmin === 'boolean') {
    return session.user.isAdmin;
  }
  try {
    const userRef = db.collection('users').doc(session.user.id);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      return userDoc.data()?.isAdmin === true;
    }
  } catch (error) {
    console.error("Error fetching user's admin status from Firestore in isAdmin helper:", error);
  }
  return false; 
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!db) {
    console.error("API Handler Error: Firestore DB not initialized for /api/admin/feedback/replies.");
    return res.status(500).json({ error: "Server configuration error: Database not available." });
  }

  const session = await getSession({ req });
  if (!(await isAdmin(session))) {
    return res.status(403).json({ error: 'Forbidden: User is not an administrator.' });
  }

  try {
    let page = parseInt(req.query.page) || 1;
    if (page < 1) page = 1;
    
    let limit = parseInt(req.query.limit) || 10;
    if (limit > 50) limit = 50;
    if (limit < 1) limit = 1;

    const thumbsFilter = req.query.thumbsFeedback; // 'up', 'down', or 'none'
    const editedFilter = req.query.hasBeenEdited; // 'true' or 'false'
    const sortBy = req.query.sortBy || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const startAfterDocId = req.query.startAfterDocId;

    let query = db.collection('replyFeedback');
    let countQuery = db.collection('replyFeedback');

    // Apply filters
    if (thumbsFilter) {
      if (thumbsFilter === 'up' || thumbsFilter === 'down') {
        query = query.where('thumbsFeedback', '==', thumbsFilter);
        countQuery = countQuery.where('thumbsFeedback', '==', thumbsFilter);
      } else if (thumbsFilter === 'none') {
        query = query.where('thumbsFeedback', '==', null);
        countQuery = countQuery.where('thumbsFeedback', '==', null);
      }
    }
    if (editedFilter === 'true' || editedFilter === 'false') {
      const boolEdited = editedFilter === 'true';
      query = query.where('hasBeenEdited', '==', boolEdited);
      countQuery = countQuery.where('hasBeenEdited', '==', boolEdited);
    }
    // TODO: Add other filters like date range here in future iterations if needed.


    const countSnapshot = await countQuery.count().get();
    const totalRecords = countSnapshot.data().count;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Adjust page if it's out of bounds after calculating totalPages
    if (page > totalPages && totalPages > 0) {
        page = totalPages; // Go to last page if requested page is too high
    }


    query = query.orderBy(sortBy, sortOrder);

    if (page > 1 && startAfterDocId) {
      const lastVisibleDocSnapshot = await db.collection('replyFeedback').doc(startAfterDocId).get();
      if (lastVisibleDocSnapshot.exists) {
        query = query.startAfter(lastVisibleDocSnapshot);
      } else {
        console.warn(`startAfterDocId ${startAfterDocId} not found for replyFeedback. Fetching from beginning for page ${page}.`);
        // If cursor is invalid, it's safer to not apply startAfter, effectively resetting to page 1 of the current sort/filter.
        // However, the client requested a specific page number. This indicates a potential inconsistency.
        // For this implementation, if cursor is bad, we effectively query page 1.
        // Client should be aware or handle page reset.
        // An alternative is to return an error:
        // return res.status(400).json({ error: "Invalid startAfterDocId: Document not found."});
      }
    } else if (page > 1 && !startAfterDocId) {
      // This can happen if client tries to paginate with page numbers without using the provided lastDocId.
      // For robust cursor pagination, client should always use lastDocId for pages > 1.
      console.warn(`Requested page ${page} for replyFeedback without startAfterDocId. Results will be from the beginning of the sorted/filtered list.`);
      // To strictly enforce: return res.status(400).json({ error: `startAfterDocId is required for page ${page}.`});
    }
    
    query = query.limit(limit);

    const snapshot = await query.get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const lastFetchedDocId = data.length > 0 ? data[data.length - 1].id : null;

    res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        limit,
        totalPages,
        totalRecords,
        lastDocId: lastFetchedDocId,
      }
    });

  } catch (error) {
    console.error("Error fetching reply feedback for admin:", error);
    res.status(500).json({ error: 'Failed to fetch reply feedback', details: error.message });
  }
}
