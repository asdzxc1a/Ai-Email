import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function HomePage() {
  const { data: session } = useSession();
  const [watchStatus, setWatchStatus] = useState('');
  const [textToProcess, setTextToProcess] = useState('Enter some email text here to test AI functions...');
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (!textToProcess.trim()) {
      alert('Please enter some text to summarize.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToSummarize: textToProcess }),
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
    if (!textToProcess.trim()) {
      alert('Please enter some text to generate a reply for.');
      return;
    }
    setIsLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent: textToProcess, context: 'general' }),
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
        <textarea
          value={textToProcess}
          onChange={(e) => setTextToProcess(e.target.value)}
          rows="5"
          cols="70" // Increased width
          style={{ display: 'block', margin: '10px 0', padding: '5px', border: '1px solid #ccc' }}
        />
        <button onClick={handleSummarize} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Get Summary'}
        </button>
        <button onClick={handleGenerateReply} disabled={isLoading} style={{ marginLeft: '10px' }}>
          {isLoading ? 'Processing...' : 'Generate Reply'}
        </button>
        {isLoading && <p style={{ marginTop: '10px' }}>Loading...</p>}
        {apiResponse && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
            <h3>API Response:</h3>
            <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
          </div>
        )}
        <br />
        <button onClick={() => signOut()} style={{ marginTop: '20px' }}>Sign out</button>
      </>
    );
  }
  return (
    <>
      <h1>Email Productivity Tool</h1>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
    </>
  );
}
