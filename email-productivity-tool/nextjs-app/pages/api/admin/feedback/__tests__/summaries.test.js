import { createMocks } from 'node-mocks-http';
import handler from '../summaries'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// --- Firestore Mocks ---
// These will be functions that return 'this' to allow chaining,
// and their final .get() or .count().get() will be spied upon or mocked directly.

const mockFbGet = jest.fn(); // For final .get() on a query or doc
const mockFbCountGet = jest.fn(); // For .count().get()

// Mock chainable Firestore query methods
const mockFbStartAfter = jest.fn(() => ({ limit: mockFbLimit, get: mockFbGet }));
const mockFbLimit = jest.fn(() => ({ get: mockFbGet, startAfter: mockFbStartAfter })); // startAfter can be called before/after limit
const mockFbOrderBy = jest.fn(() => ({ limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhere, get: mockFbGet, count: mockFbCount })); // count for filtered count
const mockFbWhere = jest.fn(() => ({ orderBy: mockFbOrderBy, limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhereItself, get: mockFbGet, count: mockFbCount })); // where can be chained
const mockFbWhereItself = jest.fn(() => ({ orderBy: mockFbOrderBy, limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhereItself, get: mockFbGet, count: mockFbCount })); // For multiple where clauses
const mockFbCount = jest.fn(() => ({ get: mockFbCountGet }));


const mockFbDoc = jest.fn(() => ({ get: mockFbGet })); // For doc(id).get()

const mockFbCollection = jest.fn((path) => {
  if (path === 'users') {
    return { doc: mockFbDoc }; // For isAdmin check: db.collection('users').doc(id).get()
  }
  // For 'summaryFeedback' collection and other potential direct collection calls
  return { 
    where: mockFbWhere, 
    orderBy: mockFbOrderBy, 
    limit: mockFbLimit,
    startAfter: mockFbStartAfter,
    doc: mockFbDoc, // For db.collection('summaryFeedback').doc(startAfterDocId).get()
    count: mockFbCount // For db.collection('summaryFeedback').count().get() (base count)
  };
});

let mockDbInstance = { collection: mockFbCollection };
const mockGetApps = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: mockGetApps,
  initializeApp: jest.fn(), 
  cert: jest.fn()
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockDbInstance),
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') } // Though not used by GET
}));


describe('/api/admin/feedback/summaries API Endpoint', () => {
  const mockUserSession = (sessionData) => {
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSession(null); // Default: no session
    
    // Default mock implementations for Firestore calls
    mockGetApps.mockReturnValue([true]); // Simulate Firebase app is initialized
    mockDbInstance = { collection: mockFbCollection }; // Reset db instance

    // Default return values for .get() and .count().get()
    mockFbGet.mockResolvedValue({ empty: true, docs: [], exists: false }); // Default for doc().get() and query.get()
    mockFbCountGet.mockResolvedValue({ data: () => ({ count: 0 }) }); // Default for query.count().get()
  });

  // --- Authorization Tests ---
  describe('Authorization', () => {
    test('should return 403 if not authenticated', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(403);
      expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ error: 'Forbidden: User is not an administrator.' }));
    });

    test('should return 403 if authenticated user is not an admin (session flag false)', async () => {
      mockUserSession({ user: { id: 'nonAdminId', email: 'user@example.com', isAdmin: false } });
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(403);
    });
    
    test('should return 403 if authenticated user is not an admin (Firestore lookup)', async () => {
      mockUserSession({ user: { id: 'nonAdminId', email: 'user@example.com' } }); // isAdmin undefined in session
      mockFbGet.mockResolvedValueOnce({ exists: true, data: () => ({ isAdmin: false }) }); // User doc from Firestore
      
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      
      expect(mockFbCollection).toHaveBeenCalledWith('users');
      expect(mockFbDoc).toHaveBeenCalledWith('nonAdminId');
      expect(res._getStatusCode()).toBe(403);
    });
  });

  // --- Request Method Test ---
  test('should return 405 for non-GET methods (e.g., POST)', async () => {
    mockUserSession({ user: { id: 'adminId', email: 'admin@example.com', isAdmin: true } });
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders().allow).toEqual(['GET']);
  });

  // --- Admin User - Data Retrieval ---
  describe('Admin Access - Data Retrieval', () => {
    beforeEach(() => {
      mockUserSession({ user: { id: 'adminId', email: 'admin@example.com', isAdmin: true } });
      // If isAdmin helper in API always checks Firestore, mock it here:
      // mockFbGet.mockResolvedValueOnce({ exists: true, data: () => ({ isAdmin: true }) });
      // However, the isAdmin helper prefers session.user.isAdmin if true.
    });

    test('should return empty list if no feedback', async () => {
      // Default mocks already set up for empty results
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
      expect(json.pagination.totalRecords).toBe(0);
      expect(json.pagination.totalPages).toBe(0); // Or 1 if totalRecords is 0, API returns Math.ceil(0/10) = 0
    });

    test('should return list of summary feedback', async () => {
      const feedbackItems = [
        { id: 'fb1', data: () => ({ userId: 'user1', feedback: 'up', timestamp: { _seconds: Date.now()/1000 } }) },
        { id: 'fb2', data: () => ({ userId: 'user2', feedback: 'down', timestamp: { _seconds: Date.now()/1000 } }) },
      ];
      mockFbGet.mockResolvedValueOnce({ empty: false, docs: feedbackItems }); // For the data query
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) });   // For the count query

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.data.length).toBe(2);
      expect(json.data[0].userId).toBe('user1');
      expect(json.pagination.totalRecords).toBe(2);
      expect(json.pagination.totalPages).toBe(1);
    });

    // --- Pagination Tests ---
    test('should respect limit parameter', async () => {
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 15 }) });
      // The actual data returned by mockFbGet should also be limited by the mock setup if we were testing data content
      // Here we primarily test if the limit method on the query builder was called
      const { req, res } = createMocks({ method: 'GET', query: { limit: '7' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.pagination.limit).toBe(7);
      expect(json.pagination.totalRecords).toBe(15);
      expect(mockFbLimit).toHaveBeenCalledWith(7);
    });

    test('should handle page parameter with startAfterDocId', async () => {
      const firstPageItems = [{ id: 'lastDocPage1', data: () => ({ timestamp: { _seconds: Date.now()/1000 } }) }];
      const secondPageItems = [{ id: 'docPage2', data: () => ({ timestamp: { _seconds: Date.now()/1000 - 100 } }) }];
      
      // Setup for first call (page 1)
      mockFbGet.mockResolvedValueOnce({ empty: false, docs: firstPageItems });
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) }); // Total 2 records

      const { req: req1, res: res1 } = createMocks({ method: 'GET', query: { limit: '1' } });
      await handler(req1, res1);
      const json1 = JSON.parse(res1._getData());
      const lastDocIdFromPage1 = json1.pagination.lastDocId;
      expect(lastDocIdFromPage1).toBe('lastDocPage1');

      // Setup for second call (page 2, using cursor)
      mockFbGet.mockResolvedValueOnce({ exists: true }); // For the startAfterDocId lookup
      mockFbGet.mockResolvedValueOnce({ empty: false, docs: secondPageItems }); // Data for page 2
      // Count query will be called again, ensure it still returns total
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) });


      const { req: req2, res: res2 } = createMocks({ method: 'GET', query: { limit: '1', page: '2', startAfterDocId: lastDocIdFromPage1 } });
      await handler(req2, res2);
      
      expect(res2._getStatusCode()).toBe(200);
      const json2 = JSON.parse(res2._getData());
      expect(json2.data.length).toBe(1);
      expect(json2.data[0].id).toBe('docPage2');
      expect(json2.pagination.currentPage).toBe(2);
      expect(mockFbCollection).toHaveBeenCalledWith('summaryFeedback');
      expect(mockFbDoc).toHaveBeenCalledWith(lastDocIdFromPage1); // Check cursor doc lookup
      expect(mockFbStartAfter).toHaveBeenCalled(); // Check that startAfter was called
    });
    
    test('should handle invalid startAfterDocId by returning first page results (or appropriate error/handling)', async () => {
        mockFbGet.mockResolvedValueOnce({ exists: false }); // Simulate startAfterDocId not found
        // Count query
        mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 5 }) });
        // Data query (will effectively be page 1 as startAfter is skipped or fails silently in mock if not robust)
        const page1Items = [{ id: 'item1', data: () => ({}) }];
        mockFbGet.mockResolvedValueOnce({ empty: false, docs: page1Items });


        const { req, res } = createMocks({ method: 'GET', query: { page: '2', startAfterDocId: 'invalidOrMissingDocId' } });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(200); // API handles this gracefully
        const json = JSON.parse(res._getData());
        // Depending on exact API logic for invalid cursor, it might return page 1 or an error.
        // The current API logs a warning and proceeds, effectively fetching page 1 if startAfter fails.
        expect(json.data.length).toBe(1); 
        expect(json.data[0].id).toBe('item1');
        expect(json.pagination.currentPage).toBe(2); // API keeps page number but content might be page 1
    });


    // --- Filtering Tests ---
    test('should filter by feedbackType="up"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { feedbackType: 'up' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('feedback', '==', 'up');
    });
    
    test('should filter by feedbackType="down"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { feedbackType: 'down' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('feedback', '==', 'down');
    });

    // --- Sorting Tests ---
    test('should sort by specified field and order (e.g., userId asc)', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { sortBy: 'userId', sortOrder: 'asc' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbOrderBy).toHaveBeenCalledWith('userId', 'asc');
    });
    
    test('should use default sort (timestamp desc) if not specified', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
    });
  });

  // --- Error Handling ---
  test('should return 500 if Firestore count query fails', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockFbCountGet.mockRejectedValueOnce(new Error('Firestore count failed'));
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ error: 'Failed to fetch summary feedback' }));
  });
  
  test('should return 500 if Firestore data query fails', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 1 }) }); // Count succeeds
    mockFbGet.mockRejectedValueOnce(new Error('Firestore data fetch failed')); // Data fetch fails
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
  
  test('should return 500 if Firestore is not initialized', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockGetApps.mockReturnValue([]); // Simulate Firebase app NOT initialized

    // Need to use jest.isolateModulesAsync for this to ensure the handler re-evaluates `db`
    const { req, res } = createMocks({ method: 'GET' });
    await jest.isolateModulesAsync(async () => {
        const isolatedHandler = (await import('../summaries')).default;
        await isolatedHandler(req, res);
    });
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: "Server configuration error: Database not available." });
  });
});
