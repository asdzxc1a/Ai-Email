import { getSession } from 'next-auth/react';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
// Ensure your environment variables are set in your Next.js environment
// (e.g., .env.local or Vercel environment variables)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Replace \n with actual newline characters for private key from environment variable
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

// Initialize Firebase Admin SDK only if it hasn't been initialized yet and private key is available
if (!getApps().length) {
  if (serviceAccount.privateKey && serviceAccount.projectId && serviceAccount.clientEmail) {
    try {
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
      // Potentially set a flag or handle this case to prevent db operations
    }
  } else {
    console.warn("Firebase Admin SDK credentials (projectId, clientEmail, or privateKey) are missing. API routes requiring Firebase Admin will not function correctly.");
  }
}

// Get Firestore instance only if app is initialized
const db = getApps().length > 0 ? getFirestore() : null;


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!db) { // Check if Firestore was initialized
    console.error("Firestore admin SDK is not initialized. This usually means Firebase Admin SDK credentials were not available or valid at startup. Check server logs.");
    return res.status(500).json({ error: "Server configuration error: Database not available." });
  }

  const session = await getSession({ req });
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
