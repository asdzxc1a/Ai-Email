// email-productivity-tool/nextjs-app/pages/index.js
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function HomePage() {
  const { data: session } = useSession();
  const [watchStatus, setWatchStatus] = useState('');
  const [messageIdInput, setMessageIdInput] = useState(''); 
  const [replyContextInput, setReplyContextInput] = useState(''); // New state
  const [toneInput, setToneInput] = useState('professional'); // New state, default to professional
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const toneOptions = ["professional", "casual", "friendly", "concise", "declined_politely"];

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

  const handleGenerateReply = async () => { 
    if (!messageIdInput.trim()) {
      alert('Please enter a Message ID to generate a reply for.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null);
    try {
      const payload = { 
        messageId: messageIdInput,
        replyContext: replyContextInput.trim() || undefined, // Send undefined if empty
        tone: toneInput || undefined, // Send undefined if empty to use API default
      };

      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });
      const data = await res.json();
      if (res.ok) {
        setApiResponse(data); // Expects { draftReply: "..." }
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
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="messageIdInput" style={{ display: 'block', marginBottom: '5px' }}>
            Enter Gmail Message ID:
          </label>
          <input
            type="text"
            id="messageIdInput"
            value={messageIdInput}
            onChange={(e) => setMessageIdInput(e.target.value)}
            placeholder="Gmail Message ID (for Summarize & Reply)"
            style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', marginBottom: '10px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Summarize Email</h3>
          <button onClick={handleSummarize} disabled={isLoading || !messageIdInput}>
            {isLoading ? 'Processing...' : 'Get Summary'}
          </button>
        </div>
        
        <hr style={{ margin: '20px 0' }}/>

        <div style={{ marginBottom: '20px' }}>
          <h3>Generate Reply</h3>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="replyContextInput" style={{ display: 'block', marginBottom: '5px' }}>
              Optional: Specific instructions for the reply:
            </label>
            <textarea
              id="replyContextInput"
              value={replyContextInput}
              onChange={(e) => setReplyContextInput(e.target.value)}
              placeholder="e.g., 'Tell them I'm interested but need more details about the budget.'"
              rows="3"
              style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="toneInput" style={{ display: 'block', marginBottom: '5px' }}>
              Optional: Tone for the reply:
            </label>
            <select 
              id="toneInput" 
              value={toneInput} 
              onChange={(e) => setToneInput(e.target.value)}
              style={{ display: 'block', width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc' }}
            >
              {toneOptions.map(tone => <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>)}
            </select>
          </div>
          <button onClick={handleGenerateReply} disabled={isLoading || !messageIdInput}>
            {isLoading ? 'Processing...' : 'Generate Reply'}
          </button>
        </div>

        {isLoading && <p>Loading...</p>}
        
        {apiResponse && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
            <h3>API Response:</h3>
            {apiResponse.summary && <p><strong>Summary:</strong> {apiResponse.summary}</p>}
            {apiResponse.draftReply && <p><strong>Draft Reply:</strong><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '5px', border: '1px solid #eee', padding: '10px', backgroundColor: 'white' }}>{apiResponse.draftReply}</pre></p>}
            {apiResponse.error && <p style={{ color: 'red' }}><strong>Error:</strong> {apiResponse.error}</p>}
            {(apiResponse.details || (apiResponse.error && !apiResponse.summary && !apiResponse.draftReply)) && 
              <details style={{ marginTop: '10px' }}>
                <summary>Details</summary>
                <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#eee', padding: '10px', marginTop: '5px' }}>
                  {typeof apiResponse.details === 'string' ? apiResponse.details : JSON.stringify(apiResponse, null, 2)}
                </pre>
              </details>
            }
          </div>
        )}
        
        <br />
        <button onClick={() => signOut()} style={{ marginTop: '30px', display: 'block' }}>Sign out</button>
      </>
    );
  }
  // Sign-in UI remains unchanged
  return (
    <>
      <h1>Email Productivity Tool</h1>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
    </>
  );
}
