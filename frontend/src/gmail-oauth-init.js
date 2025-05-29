// --- Gmail API OAuth Initiation (Frontend) ---

/**
 * Redirects the user to Google's OAuth 2.0 consent screen.
 * This function would be called when the user wants to link their Gmail account.
 */
function redirectToGoogleSignIn() {
  // These parameters would be configured in your GCP OAuth client settings
  const GOOGLE_CLIENT_ID = 'YOUR_GCP_OAUTH_CLIENT_ID.apps.googleusercontent.com';
  // This should match one of the "Authorized redirect URIs" in your GCP client
  const REDIRECT_URI = 'YOUR_BACKEND_CALLBACK_URL'; // e.g., 'http://localhost:5000/api/auth/google/callback' or 'https://your-app.com/api/auth/google/callback'

  // Scopes determine the permissions your application is requesting
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.metadata',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' '); // Scopes should be a space-separated string

  // Construct the OAuth URL
  const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code', // Indicates you want an authorization code
    scope: scopes,
    access_type: 'offline', // Important to get a refresh token
    prompt: 'consent' // Can be 'none', 'consent', or 'select_account'
                      // 'consent' will always ask the user for consent, good for testing
                      // and ensuring you get a refresh token.
  };

  const queryString = Object.keys(params).map(key => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');

  // Redirect the user's browser to the Google OAuth consent screen
  window.location.href = `${oauth2Endpoint}?${queryString}`;
}

// --- HTML Example (Conceptual) ---
/*
<div>
  <button onclick="redirectToGoogleSignIn()">Link Gmail Account</button>
</div>

<script>
  // Ensure this is called after the user is signed into your application
  // (e.g., via Firebase Auth) so you can associate the Google tokens
  // with their application user ID on the backend.
</script>
*/

console.log("Gmail OAuth initiation script loaded - conceptual only.");
