// email-productivity-tool/nextjs-app/pages/admin/processedEmails.js
import AdminLayout from '../../components/AdminLayout'; // Adjust path
import { useState, useEffect } from 'react';

export default function AdminProcessedEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [currentPageTokens, setCurrentPageTokens] = useState([null]); // For pagination

  // Filter states
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchProcessedEmails = async (startAfter = null, userId = '', status = '') => {
    setIsLoading(true);
    setError(null);
    let url = `/api/admin/emails/listAll?limit=10`; // Fetch 10 per page
    if (startAfter) {
      url += `&startAfterDocId=${startAfter}`;
    }
    if (userId) {
      url += `&userId=${encodeURIComponent(userId)}`;
    }
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch processed emails: ${response.status}`);
      }
      const data = await response.json();
      setEmails(data.emails || []);
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error("Error fetching processed emails:", err);
      setError(err.message);
      setEmails([]);
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    // Fetch initially, and when currentPageTokens changes (due to pagination)
    // but not when filterUserId or filterStatus change, that's handled by handleApplyFilters
    fetchProcessedEmails(currentPageTokens[currentPageTokens.length - 1], filterUserId, filterStatus);
  }, [currentPageTokens]); // Only re-fetch on page token change initially

  const handleApplyFilters = () => {
    setCurrentPageTokens([null]); // Reset pagination to first page
    // The useEffect will trigger a fetch because currentPageTokens changed (even if its content is just [null])
    // However, to ensure it fetches with the new filters immediately, we can call fetchProcessedEmails directly.
    fetchProcessedEmails(null, filterUserId, filterStatus); 
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
      <h1>All Processed Emails</h1>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
        <h4>Filters</h4>
        <input 
          type="text" 
          placeholder="Filter by User ID (Google SUB)" 
          value={filterUserId} 
          onChange={(e) => setFilterUserId(e.target.value)} 
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <input 
          type="text" 
          placeholder="Filter by Status (e.g., summarized)" 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)} 
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <button onClick={handleApplyFilters} style={{ padding: '8px 12px' }} disabled={isLoading}>Apply Filters</button>
      </div>

      {isLoading && <p>Loading processed emails...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!isLoading && !error && emails.length === 0 && <p>No processed emails found matching criteria.</p>}
      
      {!isLoading && !error && emails.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Message ID</th>
                <th style={tableHeaderStyle}>User ID</th>
                <th style={tableHeaderStyle}>Subject</th>
                <th style={tableHeaderStyle}>From</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Summary (Snippet)</th>
                <th style={tableHeaderStyle}>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {emails.map(email => (
                <tr key={email.id}>
                  <td style={tableCellStyle} title={email.id}>{email.id.substring(0,15)}...</td>
                  <td style={tableCellStyle} title={email.userId}>{email.userId ? email.userId.substring(0,15)+'...' : 'N/A'}</td>
                  <td style={tableCellStyle}>{email.subject}</td>
                  <td style={tableCellStyle}>{email.from}</td>
                  <td style={tableCellStyle}>{email.status}</td>
                  <td style={tableCellStyle}>{email.summary}</td>
                  <td style={tableCellStyle}>{email.processedAt ? new Date(email.processedAt).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '20px' }}>
            <button onClick={handlePrevPage} disabled={currentPageTokens.length <= 1 || isLoading}>
              Previous
            </button>
            <button onClick={handleNextPage} disabled={!nextPageToken || isLoading} style={{ marginLeft: '10px' }}>
              Next
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
