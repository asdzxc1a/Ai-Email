import { getServerSession } from 'next-auth/next'; // Updated import
import { authOptions } from '../auth/[...nextauth].js'; // Import authOptions
// import { initializeApp, getApps, cert } from 'firebase-admin/app'; // Removed
import { FieldValue } from 'firebase-admin/firestore'; // Keep FieldValue if used directly, getFirestore is from admin
import admin from '../../../lib/firebaseAdmin'; // Import centralized admin

// Get Firestore instance from centralized admin
const db = admin.firestore();


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // The check for db initialization is implicitly handled by firebaseAdmin.js
  // If db is not available, admin.firestore() would likely throw or return an unusable instance,
  // or firebaseAdmin.js would log errors.
  // A direct check like `if (!db)` might still be useful if admin.firestore() could return null/undefined
  // under certain (unlikely) conditions post-initialization.
  // For now, assuming firebaseAdmin ensures db is valid if no init error, or errors out there.

  const session = await getServerSession(req, res, authOptions); // Updated session retrieval
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  const userId = session.user.id;

  const { messageId, summaryText, feedbackType } = req.body;

  // Validate input
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    return res.status(400).json({ error: 'Invalid input: messageId (string) is required.' });
  }
  if (!summaryText || typeof summaryText !== 'string' || summaryText.trim() === '') {
    // Note: summaryText could be long, but basic non-empty check for now.
    return res.status(400).json({ error: 'Invalid input: summaryText (string) is required.' });
  }
  if (!feedbackType || (feedbackType !== 'up' && feedbackType !== 'down')) {
    return res.status(400).json({ error: 'Invalid input: feedbackType must be "up" or "down".' });
  }

  try {
    const feedbackData = {
      userId, // User who provided the feedback
      messageId, // ID of the email message this feedback pertains to
      summaryText, // The actual summary text that was shown to the user
      feedback: feedbackType, // 'up' or 'down'
      timestamp: FieldValue.serverTimestamp(), // Firestore server-side timestamp
    };

    // Add a new document with a generated ID to the 'summaryFeedback' collection.
    const feedbackRef = await db.collection('summaryFeedback').add(feedbackData);

    return res.status(201).json({ 
      success: true, 
      message: 'Feedback submitted successfully.',
      feedbackId: feedbackRef.id // Return the ID of the newly created feedback document
    });

  } catch (error) {
    console.error('Error submitting summary feedback to Firestore:', error);
    // Log the specific error to the server console for debugging
    // error.code and error.details might provide more specific Firestore error info
    return res.status(500).json({ error: 'Failed to submit feedback.', details: error.message });
  }
}
