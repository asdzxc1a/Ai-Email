// email-productivity-tool/nextjs-app/pages/admin/index.js
import AdminLayout from '../../components/AdminLayout'; // Adjust path if necessary
import { useSession } from 'next-auth/react'; // To check session client-side as well

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();

  // Client-side check for loading state or if session is still validating
  if (status === "loading") {
    return <p>Loading admin dashboard...</p>;
  }
  
  // Although middleware protects this route, an extra client-side check can be useful
  // or for displaying user-specific admin info.
  // For now, middleware handles primary auth/authz.

  return (
    <AdminLayout>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the admin area, {session?.user?.name || 'Admin'}!</p>
      <p>This is the main dashboard page. Use the navigation menu to manage users, view processed emails, and access other administrative features.</p>
      
      <section style={{ marginTop: '30px' }}>
        <h2>Quick Stats (Placeholders)</h2>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1 }}>
            <h4>Total Users</h4>
            <p style={{ fontSize: '2em', margin: 0 }}>--</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1 }}>
            <h4>Processed Emails Today</h4>
            <p style={{ fontSize: '2em', margin: 0 }}>--</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1 }}>
            <h4>Errors Logged</h4>
            <p style={{ fontSize: '2em', margin: 0 }}>--</p>
          </div>
        </div>
      </section>
      
      {/* Future: Add charts or more detailed summaries here */}
    </AdminLayout>
  );
}

// Optional: Add server-side props if needed for initial data,
// but middleware should handle auth/authz before page loads.
// export async function getServerSideProps(context) {
//   const session = await getSession(context); // Example if using getSession
//   if (!session || !session.user.isAdmin) {
//     return { redirect: { destination: '/', permanent: false } };
//   }
//   return { props: { session } }; // Pass session if needed
// }
