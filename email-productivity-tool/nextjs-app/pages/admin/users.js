// email-productivity-tool/nextjs-app/pages/admin/users.js
import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // To get current admin's ID

export default function AdminUsersPage() {
  const { data: session } = useSession(); // Get current session for logged-in admin's ID
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null); // For errors from toggle action
  const [actionSuccess, setActionSuccess] = useState(''); // For success messages from toggle
  const [nextPageToken, setNextPageToken] = useState(null);
  const [currentPageTokens, setCurrentPageTokens] = useState([null]);

  const fetchUsers = async (startAfter = null) => { 
    setIsLoading(true);
    setError(null);
    // Clear action messages when re-fetching list
    setActionError(null); 
    setActionSuccess('');
    let url = '/api/admin/users/list?limit=10';
    if (startAfter) { url += `&startAfterDocId=${startAfter}`; }
    try {
      const response = await fetch(url);
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || `Failed to fetch users: ${response.status}`); }
      const data = await response.json();
      setUsers(data.users || []);
      setNextPageToken(data.nextPageToken || null);
    } catch (err) { console.error("Error fetching users:", err); setError(err.message); setUsers([]); }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers(currentPageTokens[currentPageTokens.length - 1]);
  }, [currentPageTokens]);

  const handleToggleAdminStatus = async (targetUserId, currentIsAdmin) => {
    // Check if the current admin is trying to demote themselves
    if (session && session.user.id === targetUserId && currentIsAdmin) {
      // Count how many admins are currently listed in the UI
      const adminCount = users.filter(u => u.isAdmin).length;
      if (adminCount <= 1) {
        alert("You cannot revoke your own admin status as you are the only admin listed. Please promote another user to admin first.");
        return;
      }
      if (!confirm("Are you sure you want to remove your own admin privileges? You will lose access to this page if this action succeeds.")) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to ${currentIsAdmin ? 'revoke' : 'grant'} admin status for user ${users.find(u=>u.id === targetUserId)?.email || targetUserId}?`)) {
        return;
      }
    }

    setActionError(null);
    setActionSuccess('');
    // Consider a more specific loading state for the action itself if global isLoading is too broad
    // For now, using global isLoading
    setIsLoading(true); 

    try {
      const response = await fetch('/api/admin/users/setAdminStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, isAdmin: !currentIsAdmin }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to update admin status: ${response.status}`);
      }
      setActionSuccess(data.message || 'Admin status updated successfully.');
      // Optimistically update UI
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === targetUserId ? { ...u, isAdmin: !currentIsAdmin } : u)
      );
    } catch (err) {
      console.error("Error toggling admin status:", err);
      setActionError(err.message);
    }
    setIsLoading(false);
  };
  
  const handleNextPage = () => {
    if (nextPageToken) {
      setCurrentPageTokens(prevTokens => [...prevTokens, nextPageToken]);
    }
  };

  const handlePrevPage = () => {
    if (currentPageTokens.length > 1) {
      setCurrentPageTokens(prevTokens => prevTokens.slice(0, -1));
    }
  };

  return (
    <AdminLayout>
      <h1>Manage Users</h1>
      {/* Displaying general loading/error for the list */}
      {isLoading && users.length === 0 && <p>Loading users...</p>} 
      {error && <p style={{ color: 'red' }}>Error fetching users: {error}</p>}
      
      {/* Displaying action success/error messages */}
      {actionError && <p style={{ color: 'red', fontWeight: 'bold' }}>Action Error: {actionError}</p>}
      {actionSuccess && <p style={{ color: 'green', fontWeight: 'bold' }}>{actionSuccess}</p>}
      
      {!isLoading && !error && users.length === 0 && <p>No users found.</p>}
      
      {!isLoading && !error && users.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>ID (Google SUB)</th>
                <th style={tableHeaderStyle}>Name</th>
                <th style={tableHeaderStyle}>Email</th>
                <th style={tableHeaderStyle}>Admin?</th>
                <th style={tableHeaderStyle}>Joined At</th>
                <th style={tableHeaderStyle}>Actions</th> 
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={tableCellStyle} title={user.id}>{user.id.substring(0,10)}...</td>
                  <td style={tableCellStyle}>{user.name}</td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>{user.isAdmin ? 'Yes' : 'No'}</td>
                  <td style={tableCellStyle}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td style={tableCellStyle}>
                    <button 
                      onClick={() => handleToggleAdminStatus(user.id, user.isAdmin)}
                      disabled={isLoading} // Disable button during any loading state (list or action)
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: user.isAdmin ? '#ffc107' : '#28a745', 
                        color: user.isAdmin ? 'black' : 'white',
                        border: 'none', borderRadius: '4px', cursor: 'pointer'
                      }}
                    >
                      {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
           <div style={{ marginTop: '20px' }}>
            <button onClick={handlePrevPage} disabled={currentPageTokens.length <= 1 || isLoading}>Previous</button>
            <button onClick={handleNextPage} disabled={!nextPageToken || isLoading} style={{ marginLeft: '10px' }}>Next</button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

const tableHeaderStyle = { borderBottom: '2px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f9f9f9'};
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px'};
