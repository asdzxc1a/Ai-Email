// email-productivity-tool/nextjs-app/pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createUser, getUser, updateUser } from '../../../lib/firestoreUtils'; // Adjust path as needed

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",       // Re-prompt for consent to ensure refresh_token
          access_type: "offline",  // Request offline access for refresh_token
          response_type: "code",
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify" // Ensure all needed scopes are present
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile, user }) { // Added 'user' for initial sign-in id
      // Initial sign-in
      if (account && profile) { // 'profile' is available on initial sign-in with Google
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at * 1000; // Convert to milliseconds
        
        // Google often only sends refresh_token on the first authorization
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        
        // Use profile.sub for Google User ID, which is more reliable than token.sub initially
        token.userId = profile.sub; 
        token.email = profile.email;
        token.name = profile.name;

        try {
          let firestoreUser = await getUser(profile.sub);
          const userDataToStore = {
            email: profile.email,
            name: profile.name,
            accessToken: account.access_token, // TODO: Encrypt
            // Store accessTokenExpires in Firestore as well for server-side reference if needed
            accessTokenExpires: new Date(token.accessTokenExpires), 
          };
          // Only update refreshToken in Firestore if a new one is explicitly provided
          if (account.refresh_token) {
            userDataToStore.refreshToken = account.refresh_token; // TODO: Encrypt
          }

          if (firestoreUser) {
            console.log(`Updating user ${profile.sub} in Firestore with new tokens.`);
            await updateUser(profile.sub, userDataToStore);
          } else {
            console.log(`Creating user ${profile.sub} in Firestore.`);
            // If creating, ensure refreshToken is included if available
            await createUser(profile.sub, userDataToStore); 
          }
        } catch (error) {
          console.error("Error saving user/tokens to Firestore:", error);
          token.error = "SaveUserToDbError"; 
        }
      }
      
      // Return previous token if the access token has not expired yet
      // This check might need adjustment if we implement token refresh logic below
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        // console.log("Access token is current, returning existing token.");
        return token;
      }

      // Access token has expired, try to refresh it (if refreshToken exists)
      // TODO: Implement actual token refresh logic if needed.
      // For now, if token expires, subsequent calls requiring it will fail until re-login.
      // Google's client libraries often handle refresh internally if properly configured.
      // If we were to implement manual refresh:
      // if (token.refreshToken) {
      //   try {
      //     // Use token.refreshToken to get a new accessToken from Google's token endpoint
      //     // Update token.accessToken, token.accessTokenExpires, and potentially token.refreshToken if a new one is issued
      //     // Update Firestore with the new tokens
      //     console.log("Access token expired, would refresh here."); // Placeholder
      //   } catch (error) {
      //     console.error("Error refreshing access token", error);
      //     token.error = "RefreshAccessTokenError";
      //   }
      // } else {
      //    console.log("Access token expired, but no refresh token available.");
      //    // Potentially set an error or clear the accessToken to force re-authentication
      //    delete token.accessToken; // Example: clear expired token
      //    token.error = "AccessTokenExpiredNoRefreshToken";
      // }
      
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      // It's generally not recommended to expose refreshToken to the client-side session
      // but can be done if absolutely necessary for specific client needs.
      // session.refreshToken = token.refreshToken; 
      session.user.id = token.userId; // Ensure user ID is in the session
      session.user.email = token.email;
      session.user.name = token.name;
      if (token.error) {
        session.error = token.error; // Propagate error to session for client awareness
      }
      // For debugging: indicate if token is expired and not refreshed
      if (!token.accessToken && token.error === "AccessTokenExpiredNoRefreshToken") {
          session.error = "AccessTokenExpired"; 
      }
      return session;
    }
  }
};

export default NextAuth(authOptions);
