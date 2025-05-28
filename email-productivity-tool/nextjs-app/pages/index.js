// email-productivity-tool/nextjs-app/pages/index.js
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function HomePage() {
  const { data: session } = useSession();
  const [watchStatus, setWatchStatus] = useState('');
  // Removed textToProcess, added messageIdInput
  const [messageIdInput, setMessageIdInput] = useState(''); 
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // setupGmailWatch function remains unchanged
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

  const handleSummarize = async () => {
    if (!messageIdInput.trim()) {
      alert('Please enter a Message ID to summarize.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send messageId instead of textToSummarize
        body: JSON.stringify({ messageId: messageIdInput }), 
      });
      const data = await res.json();
      if (res.ok) {
        setApiResponse(data);
      } else {
        setApiResponse({ error: data.error || 'Failed to get summary.' });
      }
    } catch (error) {
      console.error('Frontend error calling /api/ai/summarize:', error);
      setApiResponse({ error: 'Client-side error. Check console.' });
    }
    setIsLoading(false);
  };

  // Updated to use messageIdInput for consistency, though generate-reply API is still a placeholder
  const handleGenerateReply = async () => { 
    if (!messageIdInput.trim()) {
      alert('Please enter a Message ID to generate a reply for.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null);
    try {
      // The generate-reply API is still a placeholder and might expect different input.
      // For now, sending messageId as part of the body for consistency.
      // This will likely need further adjustment when generate-reply is implemented.
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent: `Content for message ID: ${messageIdInput}`, context: 'general' }), 
      });
      const data = await res.json();
      if (res.ok) {
        setApiResponse(data);
      } else {
        setApiResponse({ error: data.error || 'Failed to generate reply.' });
      }
    } catch (error) {
      console.error('Frontend error calling /api/ai/generate-reply:', error);
      setApiResponse({ error: 'Client-side error. Check console.' });
    }
    setIsLoading(false);
  };

  if (session) {
    return (
      <>
        <h1>Email Productivity Tool</h1>
        <p>Welcome, {session.user.email}!</p>
        <button onClick={setupGmailWatch}>Setup Gmail Watch</button>
        {watchStatus && <p>{watchStatus}</p>}
        <hr style={{ margin: '20px 0' }} />
        <h2>Test AI Functions</h2>
        <label htmlFor="messageIdInput" style={{ display: 'block', margin: '10px 0 5px' }}>
          Enter Gmail Message ID:
        </label>
        <input
          type="text"
          id="messageIdInput"
          value={messageIdInput}
          onChange={(e) => setMessageIdInput(e.target.value)}
          placeholder="Enter Gmail Message ID here"
          style={{ display: 'block', margin: '0 0 10px', width: '300px', padding: '8px', border: '1px solid #ccc' }}
        />
        <button onClick={handleSummarize} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Get Summary'}
        </button>
        {/* Button for generate reply, also uses messageIdInput for now */}
        <button onClick={handleGenerateReply} disabled={isLoading} style={{ marginLeft: '10px' }}>
          {isLoading ? 'Processing...' : 'Generate Reply (Placeholder)'}
        </button>
        {isLoading && <p style={{ marginTop: '10px' }}>Loading...</p>}
        {apiResponse && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9', whiteSpace: 'pre-wrap' }}>
            <h3>API Response:</h3>
            <p>{typeof apiResponse.summary === 'string' ? apiResponse.summary : JSON.stringify(apiResponse, null, 2)}</p>
          </div>
        )}
        <br />
        <button onClick={() => signOut()} style={{ marginTop: '20px' }}>Sign out</button>
      </>
    );
  }
  return (
    // Sign-in UI remains unchanged
    <>
      <h1>Email Productivity Tool</h1>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
    </>
  );
}
