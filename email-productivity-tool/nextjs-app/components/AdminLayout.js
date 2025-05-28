// email-productivity-tool/nextjs-app/components/AdminLayout.js
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react'; // For user info/logout

export default function AdminLayout({ children }) {
  const { data: session } = useSession();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '220px', backgroundColor: '#f0f0f0', padding: '20px', borderRight: '1px solid #ccc' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.5em' }}>Admin Menu</h2>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              <Link href="/admin">Dashboard</Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <Link href="/admin/users">Manage Users</Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <Link href="/admin/processedEmails">Processed Emails</Link>
            </li>
            {/* Add more admin links here as needed */}
          </ul>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
          {session && (
            <>
              <p style={{ margin: '0 0 5px', fontSize: '0.9em' }}>
                Signed in as: <br/> 
                <strong title={session.user.email}>{session.user.name}</strong>
              </p>
              <button 
                onClick={() => signOut({ callbackUrl: '/' })} 
                style={{ width: '100%', padding: '8px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px'}}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>
      <main style={{ flex: 1, padding: '20px' }}>
        {children}
      </main>
    </div>
  );
}
