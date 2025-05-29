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
      console.log("Firebase Admin SDK initialized successfully for /api/admin/feedback/summaries.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK for /api/admin/feedback/summaries:", error);
    }
  } else {
    console.warn("Firebase Admin SDK credentials missing for /api/admin/feedback/summaries. API will not function correctly.");
  }
}
const db = getApps().length > 0 ? getFirestore() : null;

// isAdmin helper function (similar to one in /api/admin/prompts.js)
async function isAdmin(session) {
  if (!db) { // Cannot check admin status if DB is not initialized
    console.error("isAdmin check failed: Firestore DB not initialized.");
    return false;
  }
  if (!session || !session.user || !session.user.id) {
    return false;
  }
  // Prefer isAdmin flag directly from session if populated by NextAuth JWT callback
  if (typeof session.user.isAdmin === 'boolean') {
    return session.user.isAdmin;
  }
  // Fallback: Fetch from Firestore if not in session
  try {
    const userRef = db.collection('users').doc(session.user.id);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      return userDoc.data()?.isAdmin === true;
    }
  } catch (error) {
    console.error("Error fetching user's admin status from Firestore in isAdmin helper:", error);
  }
  return false; // Default to false if not found or error
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!db) {
    console.error("API Handler Error: Firestore DB not initialized for /api/admin/feedback/summaries.");
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

    const feedbackType = req.query.feedbackType; // 'up' or 'down'
    const sortBy = req.query.sortBy || 'timestamp'; // Default sort field
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc'; // Default sort order
    const startAfterDocId = req.query.startAfterDocId;


    let query = db.collection('summaryFeedback');
    let countQuery = db.collection('summaryFeedback');

    // Apply filters
    if (feedbackType && (feedbackType === 'up' || feedbackType === 'down')) {
      query = query.where('feedback', '==', feedbackType);
      countQuery = countQuery.where('feedback', '==', feedbackType);
    }
    // TODO: Add other filters like date range here in future iterations if needed.

    // Get total count for pagination (matching current filters)
    const countSnapshot = await countQuery.count().get();
    const totalRecords = countSnapshot.data().count;
    const totalPages = Math.ceil(totalRecords / limit);

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination (cursor-based using startAfter)
    if (page > 1 && startAfterDocId) {
      const lastVisibleDocSnapshot = await db.collection('summaryFeedback').doc(startAfterDocId).get();
      if (lastVisibleDocSnapshot.exists) {
        query = query.startAfter(lastVisibleDocSnapshot);
      } else {
        // If startAfterDocId is invalid or not found, it might be better to return an error or page 1
        // For now, let's proceed (Firestore will ignore startAfter if snapshot is invalid, effectively starting from beginning of sorted list)
        // Or, more strictly:
        // return res.status(400).json({ error: "Invalid startAfterDocId: Document not found."});
        console.warn(`startAfterDocId ${startAfterDocId} not found. Fetching from beginning for page ${page}.`);
      }
    } else if (page > 1 && !startAfterDocId) {
        // If page > 1 is requested without a cursor, it's an ambiguous request for cursor-based pagination.
        // Best to return an error or default to page 1.
        // For this implementation, we'll inform that cursor is needed.
        // Or, for simplicity, one might fetch (page-1)*limit + limit records and slice, but that's inefficient.
        // We will assume client will provide startAfterDocId if page > 1. If not, they get first page.
        if (page !== 1) { // If explicitly asking for page > 1 without cursor, it's a potential issue.
             console.warn(`Requested page ${page} without startAfterDocId. Results might be unexpected or effectively page 1.`);
             // To strictly enforce cursor for page > 1:
             // return res.status(400).json({ error: `startAfterDocId is required for page ${page}.`});
        }
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
        lastDocId: lastFetchedDocId, // Client should send this as startAfterDocId for the next page
        // Note: To accurately determine if there's a "next page" when using limit,
        // one common technique is to fetch limit + 1 records and see if the extra record exists.
        // Then, only return 'limit' records and use the presence of the extra one to set a 'hasNextPage' flag.
        // This is omitted for simplicity here but is a common pattern for robust cursor pagination.
      }
    });

  } catch (error) {
    console.error("Error fetching summary feedback for admin:", error);
    res.status(500).json({ error: 'Failed to fetch summary feedback', details: error.message });
  }
}
