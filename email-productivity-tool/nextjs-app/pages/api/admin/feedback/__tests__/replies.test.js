import { createMocks } from 'node-mocks-http';
import handler from '../replies'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// --- Firestore Mocks (adapted from summaries.test.js) ---
const mockFbGet = jest.fn(); 
const mockFbCountGet = jest.fn(); 

const mockFbStartAfter = jest.fn(() => ({ limit: mockFbLimit, get: mockFbGet }));
const mockFbLimit = jest.fn(() => ({ get: mockFbGet, startAfter: mockFbStartAfter }));
const mockFbOrderBy = jest.fn(() => ({ limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhere, get: mockFbGet, count: mockFbCount }));
const mockFbWhereItself = jest.fn(() => ({ orderBy: mockFbOrderBy, limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhereItself, get: mockFbGet, count: mockFbCount })); // For multiple where clauses
const mockFbWhere = jest.fn(() => ({ orderBy: mockFbOrderBy, limit: mockFbLimit, startAfter: mockFbStartAfter, where: mockFbWhereItself, get: mockFbGet, count: mockFbCount }));
const mockFbCount = jest.fn(() => ({ get: mockFbCountGet }));

const mockFbDoc = jest.fn(() => ({ get: mockFbGet }));

const mockFbCollection = jest.fn((path) => {
  if (path === 'users') {
    return { doc: mockFbDoc }; 
  }
  // For 'replyFeedback' collection
  return { 
    where: mockFbWhere, 
    orderBy: mockFbOrderBy, 
    limit: mockFbLimit,
    startAfter: mockFbStartAfter,
    doc: mockFbDoc, 
    count: mockFbCount 
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
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') }
}));


describe('/api/admin/feedback/replies API Endpoint', () => {
  const mockUserSession = (sessionData) => {
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSession(null); 
    
    mockGetApps.mockReturnValue([true]); 
    mockDbInstance = { collection: mockFbCollection }; 

    mockFbGet.mockResolvedValue({ empty: true, docs: [], exists: false }); 
    mockFbCountGet.mockResolvedValue({ data: () => ({ count: 0 }) }); 
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
      mockUserSession({ user: { id: 'nonAdminId', email: 'user@example.com' } }); 
      mockFbGet.mockResolvedValueOnce({ exists: true, data: () => ({ isAdmin: false }) }); 
      
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
    });

    test('should return empty list if no reply feedback', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
      expect(json.pagination.totalRecords).toBe(0);
    });

    test('should return list of reply feedback', async () => {
      const feedbackItems = [
        { id: 'rfb1', data: () => ({ userId: 'user1', originalAiDraft: 'Orig 1', finalUserDraft: 'Final 1', hasBeenEdited: true, thumbsFeedback: 'up', timestamp: { _seconds: Date.now()/1000 } }) },
        { id: 'rfb2', data: () => ({ userId: 'user2', originalAiDraft: 'Orig 2', finalUserDraft: 'Orig 2', hasBeenEdited: false, thumbsFeedback: 'down', timestamp: { _seconds: Date.now()/1000 } }) },
      ];
      mockFbGet.mockResolvedValueOnce({ empty: false, docs: feedbackItems }); 
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) });   

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.data.length).toBe(2);
      expect(json.data[0].userId).toBe('user1');
      expect(json.data[0].hasBeenEdited).toBe(true);
      expect(json.pagination.totalRecords).toBe(2);
    });

    // --- Pagination Tests (similar to summaries, just ensure collection is 'replyFeedback') ---
    test('should respect limit parameter for reply feedback', async () => {
      mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 10 }) });
      const { req, res } = createMocks({ method: 'GET', query: { limit: '3' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.pagination.limit).toBe(3);
      expect(json.pagination.totalRecords).toBe(10);
      expect(mockFbLimit).toHaveBeenCalledWith(3);
      expect(mockFbCollection).toHaveBeenCalledWith('replyFeedback');
    });

    test('should handle page parameter with startAfterDocId for reply feedback', async () => {
        const firstPageItems = [{ id: 'replyLastDocPage1', data: () => ({ timestamp: { _seconds: Date.now()/1000 } }) }];
        const secondPageItems = [{ id: 'replyDocPage2', data: () => ({ timestamp: { _seconds: Date.now()/1000 - 100 } }) }];
        
        mockFbGet.mockResolvedValueOnce({ empty: false, docs: firstPageItems });
        mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) }); 
  
        const { req: req1, res: res1 } = createMocks({ method: 'GET', query: { limit: '1' } });
        await handler(req1, res1);
        const json1 = JSON.parse(res1._getData());
        const lastDocIdFromPage1 = json1.pagination.lastDocId;
        expect(lastDocIdFromPage1).toBe('replyLastDocPage1');
  
        mockFbGet.mockResolvedValueOnce({ exists: true }); 
        mockFbGet.mockResolvedValueOnce({ empty: false, docs: secondPageItems }); 
        mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 2 }) });
  
        const { req: req2, res: res2 } = createMocks({ method: 'GET', query: { limit: '1', page: '2', startAfterDocId: lastDocIdFromPage1 } });
        await handler(req2, res2);
        
        expect(res2._getStatusCode()).toBe(200);
        const json2 = JSON.parse(res2._getData());
        expect(json2.data[0].id).toBe('replyDocPage2');
        expect(mockFbDoc).toHaveBeenCalledWith(lastDocIdFromPage1); 
        expect(mockFbStartAfter).toHaveBeenCalled(); 
        expect(mockFbCollection).toHaveBeenCalledWith('replyFeedback');
      });

    // --- Filtering Tests (Reply-Specific) ---
    test('should filter by thumbsFeedback="up"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { thumbsFeedback: 'up' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('thumbsFeedback', '==', 'up');
      expect(mockFbCollection).toHaveBeenCalledWith('replyFeedback');
    });
    
    test('should filter by thumbsFeedback="none"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { thumbsFeedback: 'none' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('thumbsFeedback', '==', null);
    });

    test('should filter by hasBeenEdited="true"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { hasBeenEdited: 'true' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('hasBeenEdited', '==', true);
    });
    
    test('should filter by hasBeenEdited="false"', async () => {
      const { req, res } = createMocks({ method: 'GET', query: { hasBeenEdited: 'false' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbWhere).toHaveBeenCalledWith('hasBeenEdited', '==', false);
    });

    // --- Sorting Tests ---
    test('should use default sort (timestamp desc) for reply feedback', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(mockFbOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockFbCollection).toHaveBeenCalledWith('replyFeedback');
    });
    
    test('should sort by hasBeenEdited asc', async () => {
        const { req, res } = createMocks({ method: 'GET', query: { sortBy: 'hasBeenEdited', sortOrder: 'asc' } });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(200);
        expect(mockFbOrderBy).toHaveBeenCalledWith('hasBeenEdited', 'asc');
      });
  });

  // --- Error Handling ---
  test('should return 500 if Firestore count query fails for replies', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockFbCountGet.mockRejectedValueOnce(new Error('Firestore count failed'));
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ error: 'Failed to fetch reply feedback' }));
  });
  
  test('should return 500 if Firestore data query fails for replies', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockFbCountGet.mockResolvedValueOnce({ data: () => ({ count: 1 }) }); 
    mockFbGet.mockRejectedValueOnce(new Error('Firestore data fetch failed')); 
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
  
  test('should return 500 if Firestore is not initialized for replies', async () => {
    mockUserSession({ user: { id: 'adminId', isAdmin: true } });
    mockGetApps.mockReturnValue([]); 

    const { req, res } = createMocks({ method: 'GET' });
    await jest.isolateModulesAsync(async () => {
        const isolatedHandler = (await import('../replies')).default;
        await isolatedHandler(req, res);
    });
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: "Server configuration error: Database not available." });
  });
});
