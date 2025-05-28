// email-productivity-tool/nextjs-app/pages/api/auth/verifyAddonToken.js
import { verifyGoogleIdTokenAndRetrieveUser } from '../../../lib/authAddonUtils'; // Adjust path

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const userData = await verifyGoogleIdTokenAndRetrieveUser(idToken);
    // userData includes userId, email, name, accessToken
    console.log('Addon token verified, user retrieved:', userData.email);
    res.status(200).json({
      message: 'Token verified and user retrieved successfully.',
      user: { email: userData.email, name: userData.name, id: userData.userId },
    });
  } catch (error) {
    console.error('verifyAddonToken endpoint error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Token verification or user lookup failed.', details: error.message });
  }
}
