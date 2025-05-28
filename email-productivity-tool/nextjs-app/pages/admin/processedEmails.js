// email-productivity-tool/nextjs-app/pages/admin/processedEmails.js
import AdminLayout from '../../components/AdminLayout';
import { useState, useEffect } from 'react';

// Basic Modal Component (can be moved to its own file later if it grows)
const DetailModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', padding: '20px', borderRadius: '8px',
        width: '80%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>{title || 'Details'}</h3>
          <button onClick={onClose} style={{ fontSize: '1.5em', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};


export default function AdminProcessedEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // For list loading
  const [error, setError] = useState(null); // For list error
  const [nextPageToken, setNextPageToken] = useState(null);
  const [currentPageTokens, setCurrentPageTokens] = useState([null]);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmailForModal, setSelectedEmailForModal] = useState(null); // Stores basic info for modal title, and ID
  const [modalEmailDetails, setModalEmailDetails] = useState(null); // Stores full details from API
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [modalError, setModalError] = useState(null);

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
  
  // Modified fetch to be callable for filters
  const loadEmails = (startAfter = currentPageTokens[currentPageTokens.length - 1]) => {
    fetchProcessedEmails(startAfter, filterUserId, filterStatus);
  }
  useEffect(() => { 
    // Fetch initially, and when currentPageTokens changes (due to pagination)
    // but not when filterUserId or filterStatus change directly, that's handled by handleApplyFilters
    loadEmails(); 
  }, [currentPageTokens]);


  const handleApplyFilters = () => {
    setCurrentPageTokens([null]); // Reset pagination
    // useEffect will pick up the change to currentPageTokens and call loadEmails with new filters
    // Or call directly for immediate effect if useEffect isn't re-triggering as expected on just content change of array:
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


  // Function to open modal and trigger detail fetch
  const handleViewDetails = (emailFromList) => {
    setSelectedEmailForModal(emailFromList); // Store basic info (id, subject)
    setIsModalOpen(true);
    setModalEmailDetails(null); // Clear previous details
    setModalError(null);
  };

  // useEffect to fetch full details when modal opens for a selected email
  useEffect(() => {
    if (isModalOpen && selectedEmailForModal && selectedEmailForModal.id) {
      const fetchDetail = async () => {
        setIsLoadingModal(true);
        setModalError(null);
        try {
          const response = await fetch(`/api/admin/emails/detail?messageId=${selectedEmailForModal.id}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Failed to fetch email detail: ${response.status}`);
          }
          const data = await response.json();
          setModalEmailDetails(data);
        } catch (err) {
          console.error("Error fetching email detail for modal:", err);
          setModalError(err.message);
        }
        setIsLoadingModal(false);
      };
      fetchDetail();
    }
  }, [isModalOpen, selectedEmailForModal]);


  return (
    <AdminLayout>
      <h1>All Processed Emails</h1>
      {/* Filter inputs and button */}
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
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {emails.map(email => (
                <tr key={email.id}>
                  <td style={tableCellStyle} title={email.id}>{email.id.substring(0,10)}...</td>
                  <td style={tableCellStyle} title={email.userId}>{email.userId ? email.userId.substring(0,10)+'...' : 'N/A'}</td>
                  <td style={tableCellStyle}>{email.subject}</td>
                  <td style={tableCellStyle}>{email.from}</td>
                  <td style={tableCellStyle}>{email.status}</td>
                  <td style={tableCellStyle}>{email.summary}</td>
                  <td style={tableCellStyle}>{email.processedAt ? new Date(email.processedAt).toLocaleString() : 'N/A'}</td>
                  <td style={tableCellStyle}>
                    <button onClick={() => handleViewDetails(email)} style={{padding: '5px 10px'}}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* pagination buttons */}
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

      <DetailModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedEmailForModal(null); setModalEmailDetails(null); }} // Clear modalEmailDetails on close
        title={`Details for: ${selectedEmailForModal?.subject || selectedEmailForModal?.id || ''}`}
      >
        {isLoadingModal && <p>Loading details...</p>}
        {modalError && <p style={{ color: 'red' }}>Error: {modalError}</p>}
        {modalEmailDetails && (
          <div>
            <p><strong>Message ID:</strong> {modalEmailDetails.id}</p>
            <p><strong>User ID:</strong> {modalEmailDetails.userId}</p>
            <p><strong>From:</strong> {modalEmailDetails.from}</p>
            <p><strong>Date:</strong> {modalEmailDetails.date ? new Date(modalEmailDetails.date).toLocaleString() : 'N/A'}</p>
            <p><strong>Status:</strong> {modalEmailDetails.status}</p>
            <div style={{marginTop: '10px'}}>
              <strong>Summary:</strong>
              <p style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', border: '1px solid #eee', padding: '8px', backgroundColor: '#f9f9f9'}}>{modalEmailDetails.summary || 'No summary available.'}</p>
            </div>
            <div style={{marginTop: '10px'}}>
              <strong>Full Body (Plain Text):</strong>
              <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', border: '1px solid #eee', padding: '8px', backgroundColor: '#f9f9f9', maxHeight: '250px', overflowY: 'auto'}}>{modalEmailDetails.plainBody || 'No body content available.'}</pre>
            </div>
            {/* Can add raw payload display or other details if needed */}
          </div>
        )}
      </DetailModal>

    </AdminLayout>
  );
}

// (tableHeaderStyle, tableCellStyle)
const tableHeaderStyle = { borderBottom: '2px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f9f9f9'};
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px'};
