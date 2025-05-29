import AdminLayout from '../../components/AdminLayout'; // Correct path based on ls output
import { useSession } from 'next-auth/react'; 
import { useState, useEffect } from 'react';

// TODO: Implement full UI for prompt management, including viewing prompt details, 
// editing content, description, variables, and potentially creating/deleting prompts. 
// This page currently only provides a read-only preview and placeholder text.
export default function AdminPromptsPage() {
  const { data: session, status } = useSession(); 
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Effect to fetch prompts if the user is an admin
  useEffect(() => {
    // Check if session is loaded and user is marked as admin
    // AdminLayout might already handle redirection for non-admins, 
    // but this check ensures API call is only made by admins.
    if (status === 'authenticated' && session?.user?.isAdmin) {
      setIsLoading(true);
      setError(''); // Clear previous errors
      fetch('/api/admin/prompts')
        .then(res => {
          if (!res.ok) {
            // Try to parse error body if available
            return res.json().then(errData => {
              throw new Error(errData.error || `Failed to fetch prompts (${res.status})`);
            }).catch(() => { // Fallback if error body is not JSON or not present
              throw new Error(`Failed to fetch prompts (${res.status})`);
            });
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setPrompts(data);
          } else {
            // This case should ideally not happen if API is consistent
            console.warn("Received non-array data for prompts:", data);
            setPrompts([]); 
            setError("Received unexpected data format from server.");
          }
        })
        .catch(err => {
          console.error("Error fetching prompts for admin placeholder page:", err);
          setError(err.message || "Could not load available prompts.");
        })
        .finally(() => setIsLoading(false));
    } else if (status === 'authenticated' && !session?.user?.isAdmin) {
      // If user is authenticated but not admin, set an error or message.
      // AdminLayout should ideally prevent rendering this page for non-admins.
      setError("You are not authorized to view prompt data.");
      setPrompts([]); // Clear any existing prompts
    }
  }, [session, status]); // Rerun effect if session or status changes


  // Basic loading state for the whole page if session is loading
  if (status === "loading") {
    return (
      <AdminLayout>
        <p>Loading admin page...</p>
      </AdminLayout>
    );
  }
  
  // If AdminLayout doesn't handle auth redirection, this check is a fallback.
  // However, AdminLayout is expected to handle unauthorized access.
  // This explicit check for non-admin here is more about controlling content display
  // rather than primary access control if AdminLayout is effective.
  if (status === "authenticated" && !session.user.isAdmin) {
    return (
      <AdminLayout>
        <h1>Access Denied</h1>
        <p>You do not have permission to view this page. Please contact an administrator if you believe this is an error.</p>
      </AdminLayout>
    );
  }
  // If unauthenticated and AdminLayout doesn't redirect, show generic access denied.
  // ( signIn() option could be added here if AdminLayout doesn't offer it )
  if (status === "unauthenticated") {
     return (
      <AdminLayout>
        <h1>Access Denied</h1>
        <p>Please sign in as an administrator.</p>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      <h1>Prompt Library Management</h1>
      <p style={{ fontStyle: 'italic', backgroundColor: '#f0f0f0', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '25px' }}>
        <strong>Placeholder Page:</strong> Full prompt management capabilities (viewing details, editing, creating new prompts) will be implemented here in a future update.
        The backend API for these operations is ready.
      </p>
      
      <h2 style={{marginTop: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
        Available Prompt Templates (Read-Only Preview)
      </h2>

      {isLoading && <p>Loading available prompts...</p>}
      
      {!isLoading && error && ( // Display error only if not loading
        <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>
      )}

      {!isLoading && !error && prompts.length === 0 && (
        <p>No prompts found. This could be because none are defined in the database, the API is temporarily unavailable, or you do not have permission to view them.</p>
      )}

      {!isLoading && !error && prompts.length > 0 && (
        <ul style={{ listStyleType: 'none', paddingLeft: '0' }}>
          {prompts.map(prompt => (
            <li key={prompt.id} style={{ marginBottom: '12px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
              <strong style={{display: 'block', marginBottom: '4px', color: '#333'}}>{prompt.promptName || `Prompt ID: ${prompt.id}`}</strong>
              <p style={{fontSize: '0.9em', color: '#555', margin: '0'}}>
                {prompt.description ? prompt.description.substring(0, 150) + (prompt.description.length > 150 ? '...' : '') : <em>No description provided.</em>}
              </p>
              {prompt.variables && prompt.variables.length > 0 && (
                <p style={{fontSize: '0.8em', color: '#777', marginTop: '5px'}}>
                  Variables: {prompt.variables.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
       <p style={{marginTop: '20px', fontSize: '0.9em', color: '#666'}}>
        <em>(This list is a read-only preview. Full editing and creation functionality will be added in a future update.)</em>
      </p>

    </AdminLayout>
  );
}
