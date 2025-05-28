// email-productivity-tool/nextjs-app/lib/firestoreUtils.js
import admin from './firebaseAdmin';
import { encryptToken, decryptToken } from './cryptoUtils'; // Adjust path if needed

const db = admin.firestore();
const usersCollection = db.collection('users');

export const getUser = async (userId) => {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found.`);
      return null;
    }
    const userData = userDoc.data();
    
    // Decrypt tokens
    const accessToken = userData.accessToken ? decryptToken(userData.accessToken) : null;
    const refreshToken = userData.refreshToken ? decryptToken(userData.refreshToken) : null;

    // If decryption fails and returns null, it means either the token was null to begin with,
    // or it was plaintext and failed decryption (cryptoUtils.js handles this by returning null).
    // Or it was genuinely corrupted.
    // It's important that if a token was stored as plaintext before this change,
    // decryptToken might return null. We need a strategy for this.
    // For now, if decryptToken returns null, we pass null.
    // A more robust solution would be to try decrypt, if fails, assume plaintext and use, then re-encrypt.
    // Or, have a field indicating if tokens are encrypted.
    // Let's assume for now new tokens will be encrypted, old ones might be plain (and decryption will fail, returning null).

    return { 
      id: userDoc.id, 
      ...userData, // original data (includes encrypted tokens)
      accessToken: accessToken, // potentially decrypted
      refreshToken: refreshToken // potentially decrypted
    };
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
    const { email, name, isAdmin } = userData; // Keep isAdmin if passed
    const encryptedAccessToken = userData.accessToken ? encryptToken(userData.accessToken) : null;
    const encryptedRefreshToken = userData.refreshToken ? encryptToken(userData.refreshToken) : null;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    const dataToSet = {
      email,
      name,
      isAdmin: isAdmin || false, // Default isAdmin to false
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      // Include other fields from userData if necessary, e.g., accessTokenExpires
      accessTokenExpires: userData.accessTokenExpires || null, 
      gmailHistoryId: null,
      watchExpiration: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    // Remove null token fields to avoid storing them explicitly if not present
    if (!encryptedAccessToken) delete dataToSet.accessToken;
    if (!encryptedRefreshToken) delete dataToSet.refreshToken;
    if (!userData.accessTokenExpires) delete dataToSet.accessTokenExpires;


    await usersCollection.doc(userId).set(dataToSet);
    console.log(`User ${userId} created successfully with encrypted tokens.`);
    // Don't return raw/encrypted tokens from here for security best practice
    return { id: userId, email, name, isAdmin: dataToSet.isAdmin };
  } catch (error) {
    console.error(`Error creating user ${userId}:`, error);
    throw error;
  }
};

export const updateUser = async (userId, updateData) => {
  try {
    const dataToUpdate = { ...updateData };
    if (dataToUpdate.accessToken) {
      dataToUpdate.accessToken = encryptToken(dataToUpdate.accessToken);
    }
    if (dataToUpdate.refreshToken) {
      dataToUpdate.refreshToken = encryptToken(dataToUpdate.refreshToken);
    }
    // Ensure accessTokenExpires is handled if present in updateData
    if (dataToUpdate.accessTokenExpires) {
        // Assuming it's already a Date object or Firestore will handle conversion
        // No specific encryption needed for expiry date itself
    }

    // Remove null token fields if encryption returned null (e.g. empty input)
    if (dataToUpdate.accessToken === null) delete dataToUpdate.accessToken;
    if (dataToUpdate.refreshToken === null) delete dataToUpdate.refreshToken;

    dataToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await usersCollection.doc(userId).update(dataToUpdate);
    console.log(`User ${userId} updated successfully with potentially encrypted tokens.`);
    // Return a confirmation or minimal data, avoid returning tokens directly.
    // getUser will decrypt if called separately.
    return { id: userId, message: "User updated. Re-fetch for decrypted data if needed." };
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    throw error;
  }
};
