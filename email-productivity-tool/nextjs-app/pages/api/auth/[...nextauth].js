// email-productivity-tool/nextjs-app/pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
// Ensure correct path for firestoreUtils if it's different
import { createUser, getUser, updateUser, checkAdminStatus } from '../../../lib/firestoreUtils'; 

export const authOptions = {
  providers: [ 
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) { // Removed 'user' as profile.sub is preferred for Google ID
      // Initial sign-in
      if (account && profile) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at * 1000;
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        token.userId = profile.sub;
        token.email = profile.email;
        token.name = profile.name;

        try {
          // Check admin status when JWT is created/updated with profile info
          const isAdmin = await checkAdminStatus(profile.sub);
          token.isAdmin = isAdmin; // Add isAdmin claim to JWT

          let firestoreUser = await getUser(profile.sub);
          const userDataToStore = {
            email: profile.email,
            name: profile.name,
            accessToken: account.access_token, // TODO: Encrypt
            accessTokenExpires: new Date(token.accessTokenExpires), // Store expires_at
            isAdmin: isAdmin, // Also store isAdmin status in Firestore for persistence
          };
          if (account.refresh_token) {
            userDataToStore.refreshToken = account.refresh_token; // TODO: Encrypt
          }

          if (firestoreUser) {
            console.log(`Updating user ${profile.sub} in Firestore with new tokens and admin status.`);
            await updateUser(profile.sub, userDataToStore);
          } else {
            console.log(`Creating user ${profile.sub} in Firestore with admin status.`);
            await createUser(profile.sub, userDataToStore);
          }
        } catch (error) {
          console.error("Error saving user/tokens/adminStatus to Firestore:", error);
          token.error = "SaveUserToDbError";
        }
      } else if (token.userId && typeof token.isAdmin === 'undefined') {
        // If token exists but isAdmin status is not yet in token (e.g., older token), try to fetch it.
        // This is a fallback, ideally isAdmin is set on login.
        try {
            console.log(`Re-fetching admin status for JWT for user ${token.userId}`);
            const isAdmin = await checkAdminStatus(token.userId);
            token.isAdmin = isAdmin;
        } catch (error) {
            console.error("Error re-fetching admin status for JWT:", error);
            token.isAdmin = false; // Default to false on error
        }
      }
      
      // Token refresh logic placeholder (as before)
      // if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
      //   return token;
      // }
      // ... refresh logic ...
      
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.id = token.userId;
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.isAdmin = token.isAdmin || false; // Pass isAdmin to client session, default to false
      if (token.error) {
        session.error = token.error;
      }
      // For debugging: indicate if token is expired and not refreshed
      // if (!token.accessToken && token.error === "AccessTokenExpiredNoRefreshToken") {
      //     session.error = "AccessTokenExpired"; 
      // }
      return session;
    }
  }
};

export default NextAuth(authOptions);
