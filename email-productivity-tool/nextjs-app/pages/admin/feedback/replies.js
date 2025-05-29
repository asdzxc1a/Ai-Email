import AdminLayout from '../../../components/AdminLayout';
import { useState, useEffect, useCallback } from 'react';

const ITEMS_PER_PAGE = 10;

// Basic Modal Component
const DraftDetailModal = ({ isOpen, onClose, originalDraft, finalDraft }) => {
  if (!isOpen) return null;
  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px'}}>Full Draft Comparison</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{marginTop: 0, marginBottom: '5px'}}>Original AI Draft:</h4>
            <pre style={draftPreStyle}>{originalDraft || '(empty)'}</pre>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{marginTop: 0, marginBottom: '5px'}}>Final User Draft:</h4>
            <pre style={draftPreStyle}>{finalDraft || '(empty)'}</pre>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 15px', border: 'none', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
};

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 };
const modalContentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '90%', maxWidth: '800px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };
const draftPreStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', padding: '10px', borderRadius: '4px', maxHeight: '30vh', overflowY: 'auto' };


export default function ReplyFeedbackAdminPage() {
  const [feedbackData, setFeedbackData] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    lastDocId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [filters, setFilters] = useState({
    thumbsFeedback: '', // 'all', 'up', 'down', 'none'
    hasBeenEdited: '',  // 'all', 'true', 'false'
  });
  
  const [pageCursors, setPageCursors] = useState([null]); // pageCursors[0] for page 1 (no cursor)
  const [modalData, setModalData] = useState({ isOpen: false, originalDraft: '', finalDraft: '' });

  const fetchFeedback = useCallback(async (page, currentFilters, cursors) => {
    setIsLoading(true);
    setError('');
    let url = `/api/admin/feedback/replies?limit=${ITEMS_PER_PAGE}&page=${page}`;
    
    if (currentFilters.thumbsFeedback && currentFilters.thumbsFeedback !== 'all') {
      url += `&thumbsFeedback=${currentFilters.thumbsFeedback}`;
    }
    if (currentFilters.hasBeenEdited && currentFilters.hasBeenEdited !== 'all') {
      url += `&hasBeenEdited=${currentFilters.hasBeenEdited}`;
    }
    
    const cursorForApi = page > 1 ? cursors[page - 1] : null;
    if (cursorForApi) {
        url += `&startAfterDocId=${cursorForApi}`;
    }
    // Default sorting by timestamp desc is handled by API. Add params here if client-side sort control is needed.

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to fetch reply feedback (${res.status})`);
      }
      const { data, pagination: apiPagination } = await res.json();
      setFeedbackData(data);
      setPagination(apiPagination);

      if (apiPagination.lastDocId) {
        setPageCursors(prev => {
            const newCursors = [...prev];
            newCursors[page] = apiPagination.lastDocId; // Store cursor for *next* page fetch
            return newCursors;
        });
      }
    } catch (err) {
      console.error("Error fetching reply feedback:", err);
      setError(err.message);
      setFeedbackData([]); 
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback(pagination.currentPage, filters, pageCursors);
  }, [pagination.currentPage, filters, fetchFeedback, pageCursors]);


  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1, lastDocId: null })); 
    setPageCursors([null]); 
  };

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
        setPagination(prev => ({ ...prev, currentPage: newPage }));
        // useEffect will handle the fetch with the correct cursor from pageCursors
    }
  };
  
  const openDraftModal = (original, final) => {
    setModalData({ isOpen: true, originalDraft: original, finalDraft: final });
  };
  const closeDraftModal = () => {
    setModalData({ isOpen: false, originalDraft: '', finalDraft: '' });
  };
  
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const date = ts._seconds ? new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000) : new Date(ts);
    return date.toLocaleString();
  };

  return (
    <AdminLayout>
      <h1>Reply Feedback Management</h1>
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <label htmlFor="thumbsFeedbackFilter" style={{ marginRight: '8px', fontWeight: 'bold' }}>Thumbs Feedback: </label>
          <select name="thumbsFeedback" id="thumbsFeedbackFilter" value={filters.thumbsFeedback} onChange={handleFilterChange} style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}>
            <option value="">All</option> {/* 'all' represented by empty string for no filter */}
            <option value="up">👍 Up</option>
            <option value="down">👎 Down</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label htmlFor="hasBeenEditedFilter" style={{ marginRight: '8px', fontWeight: 'bold' }}>Edited: </label>
          <select name="hasBeenEdited" id="hasBeenEditedFilter" value={filters.hasBeenEdited} onChange={handleFilterChange} style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}>
            <option value="">All</option> {/* 'all' represented by empty string */}
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {isLoading && <p>Loading feedback...</p>}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}
      
      {!isLoading && !error && feedbackData.length === 0 && <p>No reply feedback found matching your criteria.</p>}
      {!isLoading && !error && feedbackData.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Date</th>
                  <th style={tableHeaderStyle}>User ID</th>
                  <th style={tableHeaderStyle}>Message ID</th>
                  <th style={tableHeaderStyle}>Original Draft</th>
                  <th style={tableHeaderStyle}>Final Draft</th>
                  <th style={tableHeaderStyle}>Edited</th>
                  <th style={tableHeaderStyle}>Thumbs</th>
                </tr>
              </thead>
              <tbody>
                {feedbackData.map(fb => (
                  <tr key={fb.id}>
                    <td style={tableCellStyle}>{formatTimestamp(fb.timestamp)}</td>
                    <td style={tableCellStyle} title={fb.userId}>{fb.userId.substring(0,10)}...</td>
                    <td style={tableCellStyle} title={fb.messageId}>{fb.messageId.substring(0,15)}...</td>
                    <td style={tableCellStyle}>
                      {fb.originalAiDraft ? `${fb.originalAiDraft.substring(0, 40)}${fb.originalAiDraft.length > 40 ? '...' : ''}` : '(empty)'}
                      <button onClick={() => openDraftModal(fb.originalAiDraft, fb.finalUserDraft)} style={{marginLeft: '8px', fontSize: '0.8em', padding: '2px 5px', cursor:'pointer'}}>View</button>
                    </td>
                    <td style={tableCellStyle}>
                      {fb.finalUserDraft ? `${fb.finalUserDraft.substring(0, 40)}${fb.finalUserDraft.length > 40 ? '...' : ''}` : '(empty)'}
                    </td>
                    <td style={tableCellStyle}>{fb.hasBeenEdited ? 'Yes' : 'No'}</td>
                    <td style={tableCellStyle}>{fb.thumbsFeedback === 'up' ? '👍 Up' : fb.thumbsFeedback === 'down' ? '👎 Down' : 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => goToPage(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1 || isLoading} style={{...paginationButtonStyle, opacity: (pagination.currentPage <= 1 || isLoading) ? 0.5 : 1, cursor: (pagination.currentPage <= 1 || isLoading) ? 'not-allowed' : 'pointer'}}>
              Previous
            </button>
            <span>Page {pagination.currentPage} of {pagination.totalPages || 1} (Total: {pagination.totalRecords} records)</span>
            <button onClick={() => goToPage(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages || isLoading || !pagination.lastDocId && pagination.currentPage < pagination.totalPages} style={{...paginationButtonStyle, opacity: (pagination.currentPage >= pagination.totalPages || isLoading || !pagination.lastDocId && pagination.currentPage < pagination.totalPages) ? 0.5 : 1, cursor: (pagination.currentPage >= pagination.totalPages || isLoading || !pagination.lastDocId && pagination.currentPage < pagination.totalPages) ? 'not-allowed' : 'pointer'}}>
              Next
            </button>
          </div>
        </>
      )}
      <DraftDetailModal 
        isOpen={modalData.isOpen} 
        onClose={closeDraftModal} 
        originalDraft={modalData.originalDraft} 
        finalDraft={modalData.finalDraft} 
      />
    </AdminLayout>
  );
}

const tableHeaderStyle = { border: '1px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f0f0f0', fontWeight: 'bold' };
const tableCellStyle = { border: '1px solid #ddd', padding: '10px', verticalAlign: 'top', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const paginationButtonStyle = { padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white' };

```
