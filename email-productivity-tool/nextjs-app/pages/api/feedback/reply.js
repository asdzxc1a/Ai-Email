import { getServerSession } from 'next-auth/next'; // Updated import
import { authOptions } from '../auth/[...nextauth].js'; // Import authOptions
// import { initializeApp, getApps, cert } from 'firebase-admin/app'; // Removed
import { FieldValue } from 'firebase-admin/firestore'; // Keep FieldValue if used directly
import admin from '../../../lib/firebaseAdmin'; // Import centralized admin

// Get Firestore instance from centralized admin
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Assuming firebaseAdmin.js handles db initialization and logging.
  // If admin.firestore() fails or returns an unusable instance, errors should originate there
  // or be caught by global error handlers.

  const session = await getServerSession(req, res, authOptions); // Updated session retrieval
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
