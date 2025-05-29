import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link'; // Optional: for linking back to home or other pages

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [autoSend, setAutoSend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // NOTE: The backend logic for auto-sending emails is currently a placeholder 
  // (logs intent, changes status in 'processedEmails' to 'summarized_auto_send_pending'). 
  // Full implementation of sending via Gmail API and detailed audit logging 
  // in 'outboundAudits' collection is pending in the Cloud Function.

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setIsLoading(true);
      setError('');
      fetch('/api/user/settings')
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch settings (${res.status})`);
          }
          return res.json();
        })
        .then(data => {
          setAutoSend(data.autoSendEnabled);
        })
        .catch(err => {
          console.error(err);
          setError(err.message || 'Could not load auto-send status.');
        })
        .finally(() => setIsLoading(false));
    }
  }, [status, session]);

  const handleToggleAutoSend = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    const newAutoSendState = !autoSend;

    // Optimistically update UI, will revert on error if needed (though current example doesn't revert)
    // setAutoSend(newAutoSendState); 

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSendEnabled: newAutoSendState }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        // If error, setAutoSend back to original state if we updated optimistically
        // setAutoSend(!newAutoSendState); 
        throw new Error(errorData.error || `Failed to update settings (${response.status})`);
      }
      const data = await response.json();
      setAutoSend(data.autoSendEnabled); // Set state based on response from server
      setSuccessMessage(`Auto Send ${data.autoSendEnabled ? 'Enabled' : 'Disabled'} successfully.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not update auto-send status.');
      // If an error occurred and we updated UI optimistically, revert
      // For example, you might want to re-fetch settings here or revert manually:
      // setAutoSend(!newAutoSendState); // Revert if optimistic update was done
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000); // Clear success message after 3s
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Settings</h1>
        <p>Access Denied. Please sign in to manage settings.</p>
        <button 
          onClick={() => signIn('google')} 
          style={{padding: '10px 20px', fontSize: '16px', cursor: 'pointer'}}
        >
          Sign in with Google
        </button>
        <br />
        <br />
        <Link href="/">Go to Homepage</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h1 style={{ textAlign: 'center' }}>User Settings</h1>
      </header>
      
      <section>
        <h2 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Auto Send Configuration</h2>
        <p style={{ marginBottom: '15px', color: '#555', lineHeight: '1.6' }}>
          When enabled, the system will attempt to automatically send replies that have been generated for new incoming emails.
          This feature uses your authenticated Gmail account to send messages. 
          <strong style={{color: 'red'}}> Please use this feature with caution.</strong>
        </p>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px', 
          padding: '15px', 
          border: '1px solid #ddd', 
          borderRadius: '5px',
          backgroundColor: '#f9f9f9'
        }}>
          <label htmlFor="autoSendToggle" style={{ marginRight: '15px', fontWeight: 'bold', fontSize: '1.1em' }}>
            Enable Auto Send:
          </label>
          <button
            id="autoSendToggle"
            onClick={handleToggleAutoSend}
            disabled={isLoading}
            aria-pressed={autoSend}
            style={{
              padding: '10px 18px',
              cursor: 'pointer',
              backgroundColor: autoSend ? '#4CAF50' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1em',
              minWidth: '110px',
              transition: 'background-color 0.3s ease'
            }}
          >
            {isLoading ? 'Saving...' : (autoSend ? 'Enabled' : 'Disabled')}
          </button>
        </div>

        {error && <p style={{ color: 'red', marginTop: '10px', fontWeight: 'bold' }}>Error: {error}</p>}
        {successMessage && <p style={{ color: 'green', marginTop: '10px', fontWeight: 'bold' }}>{successMessage}</p>}

        <div style={{marginTop: '25px', fontSize: '0.95em', color: '#444', padding: '10px', backgroundColor: '#eef', borderRadius: '4px'}}>
          <p>
            <strong>Current Status:</strong> Auto Send is currently 
            <strong style={{ color: autoSend ? 'green' : 'red' }}> {autoSend ? 'ACTIVE' : 'INACTIVE'}</strong>.
          </p>
          <p style={{marginTop: '5px'}}>
            It is recommended to regularly review your sent items in Gmail when this feature is active.
          </p>
        </div>
      </section>
      
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center' }}>
        <Link href="/">Back to Homepage</Link>
      </footer>
    </div>
  );
}
