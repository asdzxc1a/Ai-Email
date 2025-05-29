import { getSession } from 'next-auth/react';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (ensure robust initialization)
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
      console.log("Firebase Admin SDK initialized successfully for /api/feedback/reply.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK for /api/feedback/reply:", error);
    }
  } else {
    console.warn("Firebase Admin SDK credentials (projectId, clientEmail, or privateKey) are missing for /api/feedback/reply. This API will not function correctly.");
  }
}

// Get Firestore instance only if app is initialized
const db = getApps().length > 0 ? getFirestore() : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!db) {
    console.error("Firestore admin SDK is not initialized for /api/feedback/reply. This usually means Firebase Admin SDK credentials were not available or valid at startup. Check server logs.");
    return res.status(500).json({ error: "Server configuration error: Database not available." });
  }

  const session = await getSession({ req });
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  const userId = session.user.id;

  const { messageId, originalAiDraft, finalUserDraft, thumbsFeedback } = req.body;

  // Validate input
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    return res.status(400).json({ error: 'Invalid input: messageId (string) is required.' });
  }
  // originalAiDraft can be an empty string if AI failed to generate, but it must be a string.
  if (typeof originalAiDraft !== 'string') { 
    return res.status(400).json({ error: 'Invalid input: originalAiDraft must be a string.' });
  }
  // finalUserDraft can be an empty string if user deleted everything, but it must be a string.
  if (typeof finalUserDraft !== 'string') { 
    return res.status(400).json({ error: 'Invalid input: finalUserDraft must be a string.' });
  }
  
  // thumbsFeedback is optional. If provided, it must be "up" or "down".
  // If it's an empty string or some other value (not 'up'/'down'), it's problematic if not explicitly handled.
  // The example sets it to null if not 'up' or 'down'.
  if (thumbsFeedback !== undefined && thumbsFeedback !== null && typeof thumbsFeedback !== 'string') {
    return res.status(400).json({ error: 'Invalid input: thumbsFeedback must be a string if provided.' });
  }
  if (typeof thumbsFeedback === 'string' && thumbsFeedback.trim() !== '' && thumbsFeedback !== 'up' && thumbsFeedback !== 'down') {
    return res.status(400).json({ error: 'Invalid input: thumbsFeedback must be "up", "down", or an empty string/null if not provided.' });
  }

  const hasBeenEdited = originalAiDraft !== finalUserDraft;

  try {
    const feedbackData = {
      userId,
      messageId,
      originalAiDraft,
      finalUserDraft,
      hasBeenEdited,
      timestamp: FieldValue.serverTimestamp(),
    };

    // Only include thumbsFeedback if it's valid and provided
    if (thumbsFeedback === 'up' || thumbsFeedback === 'down') {
      feedbackData.thumbsFeedback = thumbsFeedback;
    } else {
      // If thumbsFeedback is an empty string, null, or undefined, store null.
      feedbackData.thumbsFeedback = null; 
    }

    const feedbackRef = await db.collection('replyFeedback').add(feedbackData);

    return res.status(201).json({ 
      success: true, 
      message: 'Reply feedback submitted successfully.',
      feedbackId: feedbackRef.id 
    });

  } catch (error) {
    console.error('Error submitting reply feedback to Firestore:', error);
    return res.status(500).json({ error: 'Failed to submit reply feedback.', details: error.message });
  }
}
