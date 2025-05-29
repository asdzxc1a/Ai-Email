import { getSession } from 'next-auth/react';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
// Ensure your environment variables are set for service account
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!getApps().length && serviceAccount.privateKey) {
  initializeApp({
    credential: cert(serviceAccount),
  });
} else if (!getApps().length && !serviceAccount.privateKey) {
  console.warn("Firebase Admin SDK private key is not available for 'prompts.js'. API routes requiring Firebase Admin will not work.");
}

const db = getApps().length ? getFirestore() : null;

// Helper function to check admin status
async function isAdmin(session) {
  if (!db) return false; // Cannot check admin status if DB is not initialized
  if (!session || !session.user || !session.user.id) return false;
  
  // Prefer isAdmin flag directly from session if populated by NextAuth JWT callback
  if (typeof session.user.isAdmin === 'boolean') {
    return session.user.isAdmin;
  }

  // Fallback: Fetch from Firestore if not in session (more robust)
  // This assumes user documents in 'users' collection have an 'isAdmin' field.
  try {
    const userRef = db.collection('users').doc(session.user.id);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.isAdmin === true;
    }
  } catch (error) {
    console.error("Error fetching user's admin status from Firestore:", error);
  }
  return false; // Default to false if not found or error
}

export default async function handler(req, res) {
  if (!db) {
    console.error("Firestore database is not initialized in 'prompts.js'. Check Firebase Admin SDK configuration.");
    return res.status(500).json({ error: 'Internal Server Error: Database not configured.' });
  }

  const session = await getSession({ req });
  const userIsAdmin = await isAdmin(session);

  if (!userIsAdmin) {
    return res.status(403).json({ error: 'Forbidden: User is not an administrator or session is invalid.' });
  }

  const { id: promptDocId } = req.query;

  if (req.method === 'GET') {
    try {
      if (promptDocId) { // Get single prompt by ID
        const promptRef = db.collection('promptLibrary').doc(promptDocId);
        const docSnap = await promptRef.get();
        if (!docSnap.exists()) {
          return res.status(404).json({ error: 'Prompt not found.' });
        }
        return res.status(200).json({ id: docSnap.id, ...docSnap.data() });
      } else { // Get all prompts
        const snapshot = await db.collection('promptLibrary').get();
        if (snapshot.empty) {
          return res.status(200).json([]); // Return empty array if no prompts
        }
        const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(prompts);
      }
    } catch (error) {
      console.error('Error fetching prompts from Firestore:', error);
      return res.status(500).json({ error: 'Failed to fetch prompts', details: error.message });
    }
  } else if (req.method === 'PUT') {
    if (!promptDocId) {
      return res.status(400).json({ error: 'Prompt ID (as query parameter "id") is required for PUT requests.' });
    }
    try {
      const { promptContent, description, promptName, variables } = req.body;
      
      // Validation
      if (promptContent !== undefined) { // Allow updating other fields without changing promptContent
        if (typeof promptContent !== 'string' || promptContent.trim() === '') {
          return res.status(400).json({ error: 'promptContent must be a non-empty string if provided.' });
        }
      }
      if (promptName !== undefined && (typeof promptName !== 'string' || promptName.trim() === '')) {
        return res.status(400).json({ error: 'promptName must be a non-empty string if provided.' });
      }
      if (description !== undefined && typeof description !== 'string') {
         return res.status(400).json({ error: 'description must be a string if provided.' });
      }
       if (variables !== undefined && !Array.isArray(variables)) {
        return res.status(400).json({ error: 'variables must be an array if provided.' });
      }

      // Prepare data for Firestore update. Only fields present in the request body will be updated.
      // 'updatedAt' and 'lastUpdatedBy' are always updated on any valid PUT request with changes.
      const promptRef = db.collection('promptLibrary').doc(promptDocId);
      const updateData = {
        updatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: session.user.id, 
      };

      if (promptContent !== undefined) updateData.promptContent = promptContent;
      if (description !== undefined) updateData.description = description;
      if (promptName !== undefined) updateData.promptName = promptName;
      if (variables !== undefined) updateData.variables = variables; // Add variables to updateData

      // Check if there's anything to update besides timestamps
      if (Object.keys(updateData).length <= 2 && !promptContent && !description && !promptName && !variables) {
        // Only timestamps, check if document exists and return it, or error if it doesn't
         const docSnap = await promptRef.get();
         if(!docSnap.exists()){
            return res.status(404).json({ error: 'Prompt not found. Nothing to update.' });
         }
         // No actual content fields to update, just return current doc or a message
         return res.status(200).json({ message: "No content fields provided for update. Timestamps not updated if no other changes.", id: docSnap.id, ...docSnap.data() });
      }


      await promptRef.update(updateData);
      const updatedDoc = await promptRef.get();

      if (!updatedDoc.exists()) { // Should not happen if update didn't throw for non-existing doc
          return res.status(404).json({ error: 'Prompt not found after update attempt.' });
      }

      return res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      console.error(`Error updating prompt ${promptDocId}:`, error);
      // Firestore's update() throws an error if the document does not exist (error.code === 5 or 'NOT_FOUND').
      if (error.code === 5 || error.message.includes("NOT_FOUND") || error.message.includes("No document to update")) { 
        return res.status(404).json({ error: 'Prompt not found for update.' });
      }
      return res.status(500).json({ error: 'Failed to update prompt', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
