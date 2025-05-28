// email-productivity-tool/nextjs-app/lib/firestoreUtils.js
import admin from './firebaseAdmin';

const db = admin.firestore();
const usersCollection = db.collection('users');

export const getUser = async (userId) => {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found.`);
      return null;
    }
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error(`Error getting user ${userId}:`, error);
    throw error;
  }
};

/**
 * Checks if a user has admin privileges.
 * @param {string} userId - The ID of the user (document ID in 'users' collection, typically Google SUB).
 * @returns {Promise<boolean>} True if the user is an admin, false otherwise.
 */
export const checkAdminStatus = async (userId) => {
  if (!userId) {
    console.warn("checkAdminStatus: userId was not provided.");
    return false;
  }
  try {
    const userDocRef = usersCollection.doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.log(`checkAdminStatus: User ${userId} not found.`);
      return false;
    }

    const userData = userDoc.data();
    if (userData && userData.isAdmin === true) {
      console.log(`checkAdminStatus: User ${userId} is an admin.`);
      return true;
    } else {
      console.log(`checkAdminStatus: User ${userId} is not an admin (isAdmin field missing or false).`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking admin status for user ${userId}:`, error);
    return false; // Default to not admin on error
  }
};

export const createUser = async (userId, userData) => {
  try {
    const { email, name, accessToken, refreshToken } = userData;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    await usersCollection.doc(userId).set({
      email,
      name,
      accessToken, // TODO: Encrypt before storing
      refreshToken, // TODO: Encrypt before storing
      gmailHistoryId: null,
      watchExpiration: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    console.log(`User ${userId} created successfully.`);
    return { id: userId, ...userData, createdAt: new Date(), updatedAt: new Date() }; // Approximate client-side
  } catch (error) {
    console.error(`Error creating user ${userId}:`, error);
    throw error;
  }
};

export const updateUser = async (userId, updateData) => {
  try {
    const dataToUpdate = { ...updateData };
    // TODO: Encrypt accessToken and refreshToken if they are being updated
    if (dataToUpdate.accessToken) console.warn("accessToken should be encrypted before storing");
    if (dataToUpdate.refreshToken) console.warn("refreshToken should be encrypted before storing");

    dataToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await usersCollection.doc(userId).update(dataToUpdate);
    console.log(`User ${userId} updated successfully.`);
    return await getUser(userId); // Return updated user
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    throw error;
  }
};
