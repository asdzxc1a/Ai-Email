// email-productivity-tool/nextjs-app/pages/api/admin/users/setAdminStatus.js
import { getToken } from 'next-auth/jwt';
import { checkAdminStatus, updateUser } from '../../../../lib/firestoreUtils'; // Adjust path

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.userId) {
    return res.status(401).json({ error: 'Unauthorized: No session found.' });
  }

  const isAdminUser = await checkAdminStatus(token.userId);
  if (!isAdminUser) {
    return res.status(403).json({ error: 'Forbidden: Calling user is not an admin.' });
  }

  const { targetUserId, isAdmin } = req.body;

  if (!targetUserId || typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'Bad Request: Missing targetUserId or isAdmin (must be boolean).' });
  }

  // Optional: Prevent admin from revoking their own status if they are the only admin.
  // This logic would require counting admins or checking if targetUserId === token.userId
  // and then checking if other admins exist. For simplicity, this check is omitted for now.
  // if (token.userId === targetUserId && !isAdmin) {
  //   // Check if there are other admins before allowing self-demotion
  // }

  try {
    await updateUser(targetUserId, { isAdmin: isAdmin });
    console.log(`Admin status for user ${targetUserId} set to ${isAdmin} by admin ${token.userId}`);
    res.status(200).json({ success: true, message: `User ${targetUserId} admin status updated to ${isAdmin}.` });
  } catch (error) {
    console.error(`Error updating admin status for user ${targetUserId}:`, error);
    res.status(500).json({ error: 'Internal server error while updating admin status.' });
  }
}
