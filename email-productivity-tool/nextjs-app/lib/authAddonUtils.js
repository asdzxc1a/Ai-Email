// email-productivity-tool/nextjs-app/lib/authAddonUtils.js
import { OAuth2Client } from 'google-auth-library';
import { getUser } from './firestoreUtils'; // Assuming getUser fetches by Google User ID (sub)

const googleClient = new OAuth2Client();

export async function verifyGoogleIdTokenAndRetrieveUser(idToken) {
  if (!idToken) {
    throw new Error('ID token is required.');
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      // No specific audience check here, relying on Google's issuance
      // and then checking if the user (sub) exists in our DB.
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
      throw new Error('Invalid token payload or email not verified.');
    }

    // Fetch user from Firestore using the Google User ID (payload.sub)
    // getUser is expected to retrieve the user document, which includes the accessToken for Gmail
    const user = await getUser(payload.sub); 

    if (!user) {
      throw new Error('User not found in our database for the provided token.');
    }

    // Ensure the user object contains the necessary accessToken for Gmail API calls
    if (!user.accessToken) {
        // This could happen if the token was stored during an earlier auth flow without this scope
        // or if there's an issue with how tokens are persisted.
        throw new Error('User record is missing the Gmail API access token.');
    }

    return {
      userId: user.id, // This is the Google sub, which is the doc ID in Firestore
      email: user.email,
      name: user.name,
      accessToken: user.accessToken, // Crucial for making Gmail API calls
      // refreshToken: user.refreshToken, // Also include if needed for token refresh logic later
    };

  } catch (error) {
    console.error('Error in verifyGoogleIdTokenAndRetrieveUser:', error.message);
    // Re-throw a more generic error or specific error type if needed
    throw new Error(`Token verification or user retrieval failed: ${error.message}`);
  }
}
