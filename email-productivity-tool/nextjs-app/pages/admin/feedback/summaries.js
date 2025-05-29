import AdminLayout from '../../../components/AdminLayout';
import { useState, useEffect, useCallback } from 'react';

const ITEMS_PER_PAGE = 10;

export default function SummaryFeedbackAdminPage() {
  const [feedbackData, setFeedbackData] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    lastDocId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters state will only hold the feedbackType for simplicity. Page is managed by pagination state.
  const [currentFeedbackType, setCurrentFeedbackType] = useState(''); // 'all', 'up', 'down'
  
  // pageCursors[i] stores the startAfterDocId to fetch page i+1. pageCursors[0] is always null (for page 1).
  const [pageCursors, setPageCursors] = useState([null]); 

  const fetchFeedback = useCallback(async (page, feedbackTypeToFetch, cursor) => {
    setIsLoading(true);
    setError('');
    let url = `/api/admin/feedback/summaries?limit=${ITEMS_PER_PAGE}&page=${page}`;
    
    if (feedbackTypeToFetch && feedbackTypeToFetch !== 'all') {
      url += `&feedbackType=${feedbackTypeToFetch}`;
    }
    if (page > 1 && cursor) {
      url += `&startAfterDocId=${cursor}`;
    }
    // Default sorting is by timestamp desc in the API, can add params if needed:
    // url += `&sortBy=timestamp&sortOrder=desc`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to fetch summary feedback (${res.status})`);
      }
      const { data, pagination: apiPagination } = await res.json();
      setFeedbackData(data);
      setPagination(apiPagination);

      // Manage cursors for next page
      if (page === 1) {
        setPageCursors([null, apiPagination.lastDocId]);
      } else if (apiPagination.lastDocId && pageCursors.length <= page) {
        // Add cursor for the next page if it's not already there
         setPageCursors(prev => {
            const newCursors = [...prev];
            newCursors[page] = apiPagination.lastDocId; // Cursor to fetch page+1
            return newCursors;
         });
      } else if (!apiPagination.lastDocId && page < apiPagination.totalPages) {
        // If lastDocId is null but it's not the true last page (e.g. last item deleted)
        // We might need to truncate pageCursors here if page became the new last page.
        // For now, this is okay, disabled state of 'Next' button relies on totalPages.
      }


    } catch (err) {
      console.error("Error fetching summary feedback:", err);
      setError(err.message);
      setFeedbackData([]); 
    } finally {
      setIsLoading(false);
    }
  }, [pageCursors]); // Include pageCursors to allow it to be up-to-date if needed by future complex logic

  useEffect(() => {
    // Fetch when currentPage or currentFeedbackType changes.
    // The cursor for the current page is pageCursors[currentPage - 1].
    fetchFeedback(pagination.currentPage, currentFeedbackType, pageCursors[pagination.currentPage - 1]);
  }, [pagination.currentPage, currentFeedbackType, fetchFeedback]); // Removed pageCursors from here to avoid loop, fetchFeedback has it

  const handleFilterChange = (e) => {
    setCurrentFeedbackType(e.target.value);
    setPagination(prev => ({ ...prev, currentPage: 1, lastDocId: null })); // Reset to page 1
    setPageCursors([null]); // Reset cursors
    // useEffect will trigger fetchFeedback due to currentPage and currentFeedbackType change
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      // The cursor for the *next* page is the lastDocId of the *current* page.
      // This was stored as pageCursors[pagination.currentPage] = apiPagination.lastDocId
      // So, to fetch page N, we need the cursor that was pagination.lastDocId when page N-1 was fetched.
      // This cursor is stored at pageCursors[pagination.currentPage-1] to fetch current page.
      // The lastDocId from current fetch (pagination.lastDocId) is for fetching NEXT page.
      if (pagination.lastDocId && pageCursors.length <= pagination.currentPage) {
         setPageCursors(prev => [...prev, pagination.lastDocId]);
      }
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const handlePreviousPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      // The cursor for fetching the target previous page is at pageCursors[targetPage - 1]
      // No need to explicitly pass cursor here, useEffect will use the correct one from pageCursors.
    }
  };
  
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    // Firestore Timestamp can be { _seconds: ..., _nanoseconds: ... } or a Date object from older SDK versions
    const date = ts._seconds ? new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000) : new Date(ts);
    return date.toLocaleString();
  };


  return (
    <AdminLayout>
      <h1>Summary Feedback Management</h1>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>
          <label htmlFor="feedbackTypeFilter" style={{ marginRight: '8px', fontWeight: 'bold' }}>Filter by Feedback: </label>
          <select id="feedbackTypeFilter" value={currentFeedbackType} onChange={handleFilterChange} style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}>
            <option value="">All</option> {/* Changed 'all' to empty string to match API if it expects no param */}
            <option value="up">👍 Up</option>
            <option value="down">👎 Down</option>
          </select>
        </div>
        {/* Placeholder for more filters like date range */}
      </div>

      {isLoading && <p>Loading feedback...</p>}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}
      
      {!isLoading && !error && feedbackData.length === 0 && <p>No summary feedback found matching your criteria.</p>}
      {!isLoading && !error && feedbackData.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Date</th>
                  <th style={tableHeaderStyle}>User ID</th>
                  <th style={tableHeaderStyle}>Message ID</th>
                  <th style={tableHeaderStyle}>Summary Text (Hover for full)</th>
                  <th style={tableHeaderStyle}>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {feedbackData.map(fb => (
                  <tr key={fb.id}>
                    <td style={tableCellStyle}>{formatTimestamp(fb.timestamp)}</td>
                    <td style={tableCellStyle} title={fb.userId}>{fb.userId.substring(0,15)}...</td>
                    <td style={tableCellStyle} title={fb.messageId}>{fb.messageId.substring(0,20)}...</td>
                    <td style={tableCellStyle} title={fb.summaryText}>
                      {fb.summaryText.substring(0, 70)}{fb.summaryText.length > 70 ? '...' : ''}
                    </td>
                    <td style={tableCellStyle}>{fb.feedback === 'up' ? '👍 Up' : '👎 Down'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={handlePreviousPage} disabled={pagination.currentPage <= 1 || isLoading} style={paginationButtonStyle}>
              Previous
            </button>
            <span>Page {pagination.currentPage} of {pagination.totalPages || 1} (Total: {pagination.totalRecords} records)</span>
            <button onClick={handleNextPage} disabled={pagination.currentPage >= pagination.totalPages || isLoading || !pagination.lastDocId && pagination.currentPage < pagination.totalPages} style={paginationButtonStyle}>
              Next
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

const tableHeaderStyle = { border: '1px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f0f0f0', fontWeight: 'bold' };
const tableCellStyle = { border: '1px solid #ddd', padding: '10px', verticalAlign: 'top' };
const paginationButtonStyle = { padding: '8px 15px', borderRadius: '4px', border: '1px solid #007bff', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', opacity: 1};
// Add disabled style for pagination buttons: paginationButtonStyle.disabled = { opacity: 0.5, cursor: 'not-allowed' } (inline for now)
// For inline style in button: style={{...paginationButtonStyle, ...(isDisabled && {opacity:0.5, cursor:'not-allowed'})}}
```
