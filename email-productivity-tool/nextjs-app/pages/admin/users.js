// email-productivity-tool/nextjs-app/pages/admin/users.js
import AdminLayout from '../../components/AdminLayout'; // Adjust path
import { useState, useEffect } from 'react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [currentPageTokens, setCurrentPageTokens] = useState([null]); // Store tokens for previous pages

  const fetchUsers = async (startAfter = null) => {
    setIsLoading(true);
    setError(null);
    let url = '/api/admin/users/list?limit=10'; // Fetch 10 users per page
    if (startAfter) {
      url += `&startAfterDocId=${startAfter}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();
      setUsers(data.users || []);
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message);
      setUsers([]); // Clear users on error
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers(currentPageTokens[currentPageTokens.length - 1]);
  }, [currentPageTokens]); // Refetch when the current page token changes

  const handleNextPage = () => {
    if (nextPageToken) {
      setCurrentPageTokens(prevTokens => [...prevTokens, nextPageToken]);
    }
  };

  const handlePrevPage = () => {
    if (currentPageTokens.length > 1) {
      // Remove current page's start token, effectively going to previous state
      // The useEffect will then fetch with the new last token in currentPageTokens
      setCurrentPageTokens(prevTokens => prevTokens.slice(0, -1));
    }
  };


  return (
    <AdminLayout>
      <h1>Manage Users</h1>
      {isLoading && <p>Loading users...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
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
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={tableCellStyle} title={user.id}>{user.id.substring(0,15)}...</td>
                  <td style={tableCellStyle}>{user.name}</td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>{user.isAdmin ? 'Yes' : 'No'}</td>
                  <td style={tableCellStyle}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '20px' }}>
            <button onClick={handlePrevPage} disabled={currentPageTokens.length <= 1 || isLoading}>
              Previous Page
            </button>
            <button onClick={handleNextPage} disabled={!nextPageToken || isLoading} style={{ marginLeft: '10px' }}>
              Next Page
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

// Basic styling (can be moved to a CSS module or global styles later)
const tableHeaderStyle = {
  borderBottom: '2px solid #ddd',
  padding: '10px',
  textAlign: 'left',
  backgroundColor: '#f9f9f9'
};
const tableCellStyle = {
  borderBottom: '1px solid #eee',
  padding: '10px'
};
