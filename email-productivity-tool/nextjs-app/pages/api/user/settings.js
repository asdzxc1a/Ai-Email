import { getServerSession } from 'next-auth/next'; // Updated import
import { authOptions } from '../auth/[...nextauth].js'; // Import authOptions
// import { initializeApp, getApps, cert } from 'firebase-admin/app'; // Removed
import { FieldValue } from 'firebase-admin/firestore'; // Keep FieldValue if used directly
import admin from '../../../lib/firebaseAdmin'; // Import centralized admin

// Get Firestore instance from centralized admin
const db = admin.firestore();

export default async function handler(req, res) {
  // Assuming firebaseAdmin.js handles db initialization and logging.
  // If admin.firestore() fails or returns an unusable instance, errors should originate there
  // or be caught by global error handlers.
  // The previous `if (!db)` check is removed for this reason.

  const session = await getServerSession(req, res, authOptions); // Updated session retrieval

  if (!session || !session.user || !session.user.id) {
    // session.user.id is expected to be the Google User ID (sub)
    return res.status(401).json({ error: 'Unauthorized: No active session or user ID missing.' });
  }

  const userId = session.user.id; 
  const userEmail = session.user.email; // For creating new user doc if needed

  if (req.method === 'GET') {
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // If user document doesn't exist, create it with default autoSendEnabled: false
        console.log(`User document not found for ${userId}. Creating with default settings.`);
        const defaultSettings = {
          email: userEmail, // Store email for reference
          autoSendEnabled: false,
          createdAt: FieldValue.serverTimestamp(), // Use server timestamp
          updatedAt: FieldValue.serverTimestamp(),
        };
        await userRef.set(defaultSettings);
        return res.status(200).json({ autoSendEnabled: false });
      }

      const userData = userDoc.data();
      // Default to false if autoSendEnabled is not explicitly set
      return res.status(200).json({ autoSendEnabled: userData.autoSendEnabled || false });
    } catch (error) {
      console.error(`Error fetching user settings for ${userId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { autoSendEnabled } = req.body;

      if (typeof autoSendEnabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid input: autoSendEnabled must be a boolean.' });
      }

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get(); // Check if doc exists before update/set

      const dataToUpdate = {
        autoSendEnabled: autoSendEnabled,
        updatedAt: FieldValue.serverTimestamp(), // Use server timestamp
      };

      if (!userDoc.exists) {
        console.log(`User document not found for ${userId} during POST. Creating with new setting.`);
        // If document doesn't exist, set it with the new autoSendEnabled value and other defaults
        dataToUpdate.email = userEmail; // Store email for reference
        dataToUpdate.createdAt = FieldValue.serverTimestamp();
        await userRef.set(dataToUpdate);
        return res.status(201).json({ success: true, autoSendEnabled: autoSendEnabled, created: true });
      } else {
        // If document exists, update it
        await userRef.update(dataToUpdate);
        return res.status(200).json({ success: true, autoSendEnabled: autoSendEnabled });
      }

    } catch (error) {
      console.error(`Error updating user settings for ${userId}:`, error);
      // Note: Firestore's update() throws an error if the document does not exist (error.code === 5 or 'NOT_FOUND').
      // The logic above already handles this by checking userDoc.exists.
      // This catch block is for other potential errors during the set/update operations.
      return res.status(500).json({ error: 'Failed to update settings', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
