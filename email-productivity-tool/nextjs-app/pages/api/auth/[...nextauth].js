// email-productivity-tool/nextjs-app/pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createUser, getUser, updateUser, checkAdminStatus } from '../../../lib/firestoreUtils'; // Adjust path

async function refreshAccessToken(token) {
  try {
    const url = "https://oauth2.googleapis.com/token?" + new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens; // Contains error info from Google
    }

    // Prepare data for Firestore update (tokens will be encrypted by updateUser)
    const firestoreUpdateData = {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: new Date(Date.now() + refreshedTokens.expires_in * 1000), // Update expiry in Firestore
      // No need to pass refreshToken to updateUser unless it's also refreshed by Google
    };
    // Google might issue a new refresh token in some specific scenarios, though rarely for this flow.
    if (refreshedTokens.refresh_token) {
      firestoreUpdateData.refreshToken = refreshedTokens.refresh_token;
    }

    await updateUser(token.userId, firestoreUpdateData);
    console.log(`Access token refreshed and updated in Firestore for user ${token.userId}`);

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // Fall back to old refresh token if Google doesn't send a new one
      refreshToken: refreshedTokens.refresh_token || token.refreshToken, 
    };
  } catch (error) {
    console.error("Error refreshing access token for user " + token.userId + ":", error);
    // It's critical to handle the scenario where the refresh token is invalid.
    // In this case, we should invalidate the session to force re-login.
    try {
        await updateUser(token.userId, { 
            accessToken: null, 
            refreshToken: null, // Clear invalid refresh token
            accessTokenExpires: null, // Clear expiry
            // Consider adding a field like 'authError: "RefreshFailed"'
        });
        console.log(`Cleared tokens in Firestore for user ${token.userId} due to refresh failure.`);
    } catch (dbError) {
        console.error("Error clearing tokens in Firestore for user " + token.userId + ":", dbError);
    }
    return {
      ...token,
      error: "RefreshAccessTokenError", // Propagate error
      accessToken: null, // Invalidate current token
      refreshToken: null, // Invalidate current refresh token
      accessTokenExpires: 0, // Expire immediately
    };
  }
}

export const authOptions = {
  providers: [ 
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { 
        params: {
          prompt: "consent", access_type: "offline", response_type: "code",
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in
      if (account && profile) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at * 1000; // expires_at is in seconds
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        token.userId = profile.sub;
        token.email = profile.email;
        token.name = profile.name;
        
        try {
          token.isAdmin = await checkAdminStatus(profile.sub); // Check admin status on login
          const userDataToStore = {
            email: profile.email, name: profile.name, isAdmin: token.isAdmin,
            accessToken: account.access_token, // Will be encrypted by firestoreUtils
            accessTokenExpires: new Date(token.accessTokenExpires), // Store as Date
          };
          if (account.refresh_token) {
            userDataToStore.refreshToken = account.refresh_token; // Will be encrypted
          }
          
          const firestoreUser = await getUser(profile.sub);
          if (firestoreUser) {
            await updateUser(profile.sub, userDataToStore);
          } else {
            await createUser(profile.sub, userDataToStore);
          }
        } catch (error) { 
            console.error("Error saving user/tokens/adminStatus to Firestore:", error);
            token.error = "SaveUserToDbError";
        }
        return token; // Return token after initial setup
      }

      // If token exists but isAdmin status is not yet in token (e.g., older token from before isAdmin was added to JWT)
      if (token.userId && typeof token.isAdmin === 'undefined') {
        try { token.isAdmin = await checkAdminStatus(token.userId); } 
        catch (error) { console.error("Error re-fetching admin status for JWT:", error); token.isAdmin = false; }
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to refresh it
      // Ensure refreshToken exists before attempting refresh
      if (!token.refreshToken) {
        console.error(`No refresh token available for user ${token.userId} to refresh expired access token.`);
        // Invalidate the session by setting an error and clearing tokens
        return {
          ...token,
          error: "MissingRefreshTokenError",
          accessToken: null,
          accessTokenExpires: 0,
        };
      }
      
      console.log(`Access token for user ${token.userId} has expired. Attempting refresh...`);
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken; // The refreshed one, if applicable
      session.user.id = token.userId;
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.isAdmin = token.isAdmin || false;
      if (token.error) { // Propagate error from JWT callback (e.g., RefreshAccessTokenError, MissingRefreshTokenError)
        session.error = token.error;
      }
      return session;
    }
  }
};

export default NextAuth(authOptions);
