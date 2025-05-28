import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createUser, getUser, updateUser } from '../../../lib/firestoreUtils'; // Adjusted path

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
    async jwt({ token, account, profile }) {
      if (account) { // On sign-in
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // Make sure this is requested in scope
        token.userId = profile.sub || token.sub; // Google ID

        try {
          let user = await getUser(token.userId);
          const userData = {
            email: profile.email,
            name: profile.name,
            accessToken: account.access_token, // TODO: Encrypt
            refreshToken: account.refresh_token, // TODO: Encrypt
          };
          if (user) {
            await updateUser(token.userId, userData);
          } else {
            await createUser(token.userId, userData);
          }
        } catch (error) {
          console.error("Error saving user to Firestore:", error);
          // Decide how to handle this error - maybe prevent sign-in or notify user
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.user.id = token.userId; // Add userId to session
      return session;
    }
  }
};

export default NextAuth(authOptions);
