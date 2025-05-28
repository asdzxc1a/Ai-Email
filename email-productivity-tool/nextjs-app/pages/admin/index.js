// email-productivity-tool/nextjs-app/pages/admin/index.js
import AdminLayout from '../../components/AdminLayout';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react'; // Import useState and useEffect

export default function AdminDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();

  // State for statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    processedEmailsToday: 0,
    processingErrorsToday: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true); // Start true for initial load
  const [fetchStatsError, setFetchStatsError] = useState(null);

  useEffect(() => {
    if (sessionStatus === "authenticated") { // Only fetch if authenticated
      const fetchStats = async () => {
        setIsLoadingStats(true);
        setFetchStatsError(null);
        try {
          const response = await fetch('/api/admin/stats');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch stats: ${response.status}`);
          }
          const data = await response.json();
          setStats(data);
        } catch (error) {
          console.error("Error fetching admin stats:", error);
          setFetchStatsError(error.message);
        }
        setIsLoadingStats(false);
      };
      fetchStats();
    }
  }, [sessionStatus]); // Re-fetch if sessionStatus changes (e.g., after login)


  // Client-side check for loading state or if session is still validating
  if (sessionStatus === "loading") {
    return (
      <AdminLayout>
        <p>Loading admin dashboard...</p>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the admin area, {session?.user?.name || 'Admin'}!</p>
      <p>This is the main dashboard page. Use the navigation menu to manage users, view processed emails, and access other administrative features.</p>
      
      <section style={{ marginTop: '30px' }}>
        <h2>Quick Stats</h2>
        {isLoadingStats && <p>Loading statistics...</p>}
        {fetchStatsError && <p style={{ color: 'red' }}>Error loading stats: {fetchStatsError}</p>}
        {!isLoadingStats && !fetchStatsError && (
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1, textAlign: 'center' }}>
              <h4>Total Users</h4>
              <p style={{ fontSize: '2.5em', margin: '10px 0' }}>{stats.totalUsers}</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1, textAlign: 'center' }}>
              <h4>Processed Emails (Today)</h4>
              <p style={{ fontSize: '2.5em', margin: '10px 0' }}>{stats.processedEmailsToday}</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', flex: 1, textAlign: 'center' }}>
              <h4>Processing Errors (Today)</h4>
              <p style={{ fontSize: '2.5em', margin: '10px 0', color: stats.processingErrorsToday > 0 ? 'orange' : 'inherit' }}>
                {stats.processingErrorsToday}
              </p>
            </div>
          </div>
        )}
      </section>
      
    </AdminLayout>
  );
}
