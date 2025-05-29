// email-productivity-tool/nextjs-app/pages/index.js
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const { data: session } = useSession();
  const [watchStatus, setWatchStatus] = useState('');
  const [messageIdInput, setMessageIdInput] = useState(''); 
  const [replyContextInput, setReplyContextInput] = useState('');
  const [toneInput, setToneInput] = useState('professional');
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false); 

  const [processedEmails, setProcessedEmails] = useState([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [fetchEmailsError, setFetchEmailsError] = useState(null);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState({}); // For summary feedback

  const toneOptions = ["professional", "casual", "friendly", "concise", "declined_politely"];

  useEffect(() => {
    // ... existing useEffect to fetch emails ...
    if (session) { 
      const fetchEmails = async () => {
        setIsLoadingEmails(true);
        setFetchEmailsError(null);
        try {
          const limit = 20;
          const response = await fetch(`/api/emails/listProcessed?limit=${limit}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch emails: ${response.status}`);
          }
          const data = await response.json();
          setProcessedEmails(data.emails || []);
        } catch (error) {
          console.error("Error fetching processed emails:", error);
          setFetchEmailsError(error.message);
        }
        setIsLoadingEmails(false);
      };
      fetchEmails();
    } else { setProcessedEmails([]); }
  }, [session]);

  const setupGmailWatch = async () => { 
    setWatchStatus('Setting up...');
    try {
      const res = await fetch('/api/gmail/watch', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setWatchStatus(`Watch setup successful! History ID: ${data.details.historyId}, Expires: ${new Date(Number(data.details.expiration)).toLocaleString()}`);
      } else {
        setWatchStatus(`Error: ${data.error} - ${data.details?.error?.message || 'Check console'}`);
      }
    } catch (error) {
      console.error('Frontend error calling /api/gmail/watch:', error);
      setWatchStatus('Failed to set up watch. Check console.');
    }
  };

  // Modified to accept optional messageId parameter
  const handleSummarize = async (targetMessageId = null) => {
    const currentMessageId = targetMessageId || messageIdInput;
    if (!currentMessageId.trim()) {
      alert('Please provide a Message ID.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null); // Clear previous response
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: currentMessageId }), 
      });
      const data = await res.json();
      setApiResponse(data.error ? { error: data.error, details: data.details } : { summary: data.summary });
    } catch (error) {
      console.error('Frontend error calling /api/ai/summarize:', error);
      setApiResponse({ error: 'Client-side error. Check console.' });
    }
    setIsLoading(false);
  };

  // Modified to accept optional messageId parameter
  const handleGenerateReply = async (targetMessageId = null) => { 
    const currentMessageId = targetMessageId || messageIdInput;
    if (!currentMessageId.trim()) {
      alert('Please provide a Message ID.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null); // Clear previous response
    try {
      const payload = { 
        messageId: currentMessageId,
        replyContext: replyContextInput.trim() || undefined,
        tone: toneInput || undefined, 
      };
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });
      const data = await res.json();
      setApiResponse(data.error ? { error: data.error, details: data.details } : { draftReply: data.draftReply });
    } catch (error) {
      console.error('Frontend error calling /api/ai/generate-reply:', error);
      setApiResponse({ error: 'Client-side error. Check console.' });
    }
    setIsLoading(false);
  };

  const toggleEmailDetail = (emailId) => {
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
    } else {
      setSelectedEmailId(emailId);
      setApiResponse(null); // Clear API response when selecting a new email detail
    }
  };

  // Function to render the API response
  const renderApiResponse = () => {
    if (!apiResponse) return null;
    return (
      <div style={{ marginTop: '10px', padding: '10px', border: '1px dashed #bbb', backgroundColor: '#f0f0f0' }}>
        <h4>AI Action Response:</h4>
        {apiResponse.summary && <p><strong>Summary:</strong> {apiResponse.summary}</p>}
        {apiResponse.draftReply && <p><strong>Draft Reply:</strong><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '5px', border: '1px solid #eee', padding: '10px', backgroundColor: 'white' }}>{apiResponse.draftReply}</pre></p>}
        {apiResponse.error && <p style={{ color: 'red' }}><strong>Error:</strong> {apiResponse.error}</p>}
        {(apiResponse.details || (apiResponse.error && !apiResponse.summary && !apiResponse.draftReply)) && 
          <details style={{ marginTop: '10px' }}>
            <summary>Error Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#eee', padding: '10px', marginTop: '5px' }}>
              {typeof apiResponse.details === 'string' ? apiResponse.details : JSON.stringify(apiResponse, null, 2)}
            </pre>
          </details>
        }
      </div>
    );
  };


  if (session) {
    return (
      <>
        <h1>Email Productivity Tool</h1>
        <p>Welcome, {session.user.email}!</p>
        {/* ... watch button ... */}
        <button onClick={setupGmailWatch}>Setup Gmail Watch</button>
        {watchStatus && <p>{watchStatus}</p>}
        
        <hr style={{ margin: '20px 0' }} />
        <h2>Processed Emails</h2>
        {/* ... email list loading/error ... */}
        {isLoadingEmails && <p>Loading emails...</p>}
        {fetchEmailsError && <p style={{ color: 'red' }}>Error fetching emails: {fetchEmailsError}</p>}
        {!isLoadingEmails && !fetchEmailsError && processedEmails.length === 0 && (
          <p>No processed emails found. New emails should appear here after they are processed by the system.</p>
        )}
        {!isLoadingEmails && !fetchEmailsError && processedEmails.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {processedEmails.map(email => (
              <li key={email.docId} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
                {/* ... email header, toggle button ... */}
                <div onClick={() => toggleEmailDetail(email.docId)} style={{ cursor: 'pointer' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '5px', fontSize: '1.1em' }}>{email.subject || '(No Subject)'}</h3>
                  <p style={{ margin: '0 0 5px', fontSize: '0.9em' }}><strong>From:</strong> {email.from}</p>
                  <p style={{ margin: '0 0 5px', fontSize: '0.9em' }}><strong>Date:</strong> {new Date(email.date || email.processedAt).toLocaleString()}</p>
                  <p style={{margin: '0 0 8px', fontSize: '0.8em', color: 'gray'}}>Status: {email.status}</p>
                   <button onClick={(e) => { e.stopPropagation(); toggleEmailDetail(email.docId); }} style={{padding: '5px 10px', fontSize: '0.9em', marginBottom: '5px'}}>
                    {selectedEmailId === email.docId ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {selectedEmailId === email.docId && (
                  <div style={{ marginTop: '10px', padding: '10px', borderTop: '1px dashed #ccc', backgroundColor: '#f9f9f9' }}>
                    <h4>Email Details:</h4>
                    {/* ... summary, plainBody display ... */}
                    {email.summary && ( <div style={{ marginBottom: '10px' }}><strong>Full Summary:</strong><p style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '5px', border: '1px solid #e0e0e0', padding: '8px', backgroundColor: 'white' }}>{email.summary}</p></div>)}
                    <strong>Full Body:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '5px', border: '1px solid #e0e0e0', padding: '8px', backgroundColor: 'white', maxHeight: '300px', overflowY: 'auto' }}>{email.plainBody || '(No body content available)'}</pre>
                    
                    {/* AI Actions for this selected email */}
                    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
                      <h5>Actions for this email:</h5>
                      <button onClick={() => handleSummarize(email.docId)} disabled={isLoading} style={{marginRight: '10px'}}>
                        {isLoading ? 'Processing...' : 'Re-summarize'}
                      </button>
                      <button onClick={() => handleGenerateReply(email.docId)} disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Generate Reply for this Email'}
                      </button>
                       {/* Reply context and tone inputs are still global for now */}
                       {/* Consider moving them here or using a modal for a better UX later */}
                    </div>
                    {/* Display API response for actions on THIS email */}
                    {renderApiResponse()} 

                    {/* --- Feedback Buttons --- */}
                    {email.summary && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                        <strong>Rate this summary:</strong>
                        <button 
                          onClick={() => handleFeedback(email.docId, email.summary, 'up')}
                          disabled={feedbackStatus[email.docId] === 'loading' || feedbackStatus[email.docId] === 'up'}
                          style={{ 
                            marginLeft: '10px', 
                            padding: '5px 8px',
                            cursor: (feedbackStatus[email.docId] === 'loading' || feedbackStatus[email.docId] === 'up') ? 'default' : 'pointer',
                            backgroundColor: feedbackStatus[email.docId] === 'up' ? 'lightgreen' : 'transparent',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                          }}
                        >
                          👍 Up
                        </button>
                        <button 
                          onClick={() => handleFeedback(email.docId, email.summary, 'down')}
                          disabled={feedbackStatus[email.docId] === 'loading' || feedbackStatus[email.docId] === 'down'}
                          style={{ 
                            marginLeft: '5px', 
                            padding: '5px 8px',
                            cursor: (feedbackStatus[email.docId] === 'loading' || feedbackStatus[email.docId] === 'down') ? 'default' : 'pointer',
                            backgroundColor: feedbackStatus[email.docId] === 'down' ? 'lightpink' : 'transparent',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                          }}
                        >
                          👎 Down
                        </button>
                        {feedbackStatus[email.docId] === 'loading' && <span style={{ marginLeft: '10px', fontStyle: 'italic' }}>Saving feedback...</span>}
                        {feedbackStatus[email.docId] === 'error' && <span style={{ marginLeft: '10px', color: 'red' }}>Error submitting feedback!</span>}
                        {(feedbackStatus[email.docId] === 'up' || feedbackStatus[email.docId] === 'down') && 
                         feedbackStatus[email.docId] !== 'loading' && feedbackStatus[email.docId] !== 'error' &&
                            <span style={{ marginLeft: '10px', color: 'green' }}>Thanks for your feedback!</span>
                        }
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <hr style={{ margin: '20px 0' }} />
        <h2>Test AI Functions (with Direct Message ID)</h2>
        {/* ... existing UI for messageIdInput, replyContextInput, toneInput ... */}
        {/* ... This section now primarily serves as the input source for replyContext and tone for detail view actions ... */}
        {/* ... and also for direct ID testing ... */}
        <div style={{ marginBottom: '20px' }}> {/* Inputs for Direct ID testing & context/tone for detail view actions */}
            <label htmlFor="messageIdInput" style={{ display: 'block', marginBottom: '5px' }}>Test Message ID (Direct):</label>
            <input type="text" id="messageIdInput" value={messageIdInput} onChange={(e) => setMessageIdInput(e.target.value)} placeholder="Enter Gmail Message ID" style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', marginBottom: '10px', border: '1px solid #ccc' }}/>
            
            <label htmlFor="replyContextInput" style={{ display: 'block', marginBottom: '5px' }}>Reply Context (for selected email or direct ID):</label>
            <textarea id="replyContextInput" value={replyContextInput} onChange={(e) => setReplyContextInput(e.target.value)} placeholder="Optional: Specific instructions for the reply..." rows="3" style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', marginBottom: '10px', border: '1px solid #ccc' }}/>
            
            <label htmlFor="toneInput" style={{ display: 'block', marginBottom: '5px' }}>Reply Tone (for selected email or direct ID):</label>
            <select id="toneInput" value={toneInput} onChange={(e) => setToneInput(e.target.value)} style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
              {toneOptions.map(tone => <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>)}
            </select>

            <button onClick={() => handleSummarize()} disabled={isLoading || !messageIdInput}>Summarize Direct ID</button>
            <button onClick={() => handleGenerateReply()} disabled={isLoading || !messageIdInput} style={{ marginLeft: '10px' }}>Generate Reply for Direct ID</button>
        </div>
        
        {/* Global API Response for Direct ID tests if no email is selected, or it's handled within detail view */}
        {!selectedEmailId && renderApiResponse()} 

        <br />
        <button onClick={() => signOut()} style={{ marginTop: '30px', display: 'block' }}>Sign out</button>
      </>
    );
  }

  const handleFeedback = async (messageId, summaryText, feedbackType) => {
    if (!session) {
      alert("Please sign in to provide feedback.");
      return; 
    }
  
    setFeedbackStatus(prev => ({ ...prev, [messageId]: 'loading' }));
    let temporarySuccessClearer = null; // To manage clearing "Thanks" message
  
    try {
      const response = await fetch('/api/feedback/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messageId, // This should be the actual Gmail message ID
          summaryText: summaryText,
          feedbackType: feedbackType,
        }),
      });
  
      const data = await response.json(); 
  
      if (!response.ok) {
        throw new Error(data.error || `Failed to submit feedback (${response.status})`);
      }
      
      setFeedbackStatus(prev => ({ ...prev, [messageId]: feedbackType })); 
      console.log("Feedback submitted successfully:", data.message);

      // Clear "Thanks" message after a few seconds
      temporarySuccessClearer = setTimeout(() => {
        // Only clear if it's still in the 'up' or 'down' state from this submission,
        // not if it became 'loading' or 'error' again for some reason.
        setFeedbackStatus(prev => {
            if (prev[messageId] === feedbackType && prev[messageId] !== 'loading' && prev[messageId] !== 'error') {
                return { ...prev, [messageId]: `submitted_${feedbackType}` }; // Or just null to re-enable
            }
            return prev;
        });
      }, 3000); 
  
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setFeedbackStatus(prev => ({ ...prev, [messageId]: 'error' }));
    }
    // Cleanup timeout if component unmounts or another feedback is submitted for the same item
    return () => {
        if (temporarySuccessClearer) {
            clearTimeout(temporarySuccessClearer);
        }
    };
  };

  // Sign-in UI remains unchanged
  return ( 
    <>
      <h1>Email Productivity Tool</h1>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
    </>
   );
}
