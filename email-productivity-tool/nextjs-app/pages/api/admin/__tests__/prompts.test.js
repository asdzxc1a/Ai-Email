import { createMocks } from 'node-mocks-http';
import handler from '../prompts'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// Mock Firebase Admin SDK
const mockFbGet = jest.fn();
const mockFbUpdate = jest.fn();
const mockFbSet = jest.fn(); // For potential future use, though prompts API uses update

const mockDoc = jest.fn((docId) => ({
  get: mockFbGet,
  update: mockFbUpdate,
  set: mockFbSet,
  // Add id property to the mock doc object for convenience in tests
  id: docId, 
}));

const mockCollection = jest.fn((collectionPath) => ({
  doc: mockDoc,
  get: mockFbGet, // For collection().get() to list all prompts
}));

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => [true]), // Simulate already initialized
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ collection: mockCollection })),
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') },
}));

describe('/api/admin/prompts API Endpoint', () => {
  const mockUserSession = (sessionData) => {
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  const mockAdminUserDoc = (isAdmin = true) => ({
    exists: true,
    data: () => ({ isAdmin }),
  });

  const mockNonAdminUserDoc = () => ({
    exists: true,
    data: () => ({ isAdmin: false }),
  });
  
  const mockUserDocNotFound = () => ({
    exists: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSession(null); // Default to no session
  });

  // --- Admin Authorization Tests ---
  describe('Authorization', () => {
    const methods = ['GET', 'PUT']; // Methods that require auth for this endpoint
    methods.forEach(method => {
      test(`${method} /api/admin/prompts should return 403 if not authenticated`, async () => {
        const { req, res } = createMocks({ method, ...(method === 'PUT' && { query: { id: 'any' }}) });
        await handler(req, res);
        // The API's isAdmin check will make getSession return null, then it will try to fetch user from DB.
        // If no session.user.id, it returns 403 early.
        expect(res._getStatusCode()).toBe(403);
        expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ error: expect.stringContaining('Forbidden') }));
      });

      test(`${method} /api/admin/prompts should return 403 if authenticated but not admin (session.user.isAdmin is false)`, async () => {
        mockUserSession({ user: { id: 'nonAdminUserId', email: 'user@example.com', isAdmin: false } });
        // isAdmin helper will use session.user.isAdmin directly
        const { req, res } = createMocks({ method, ...(method === 'PUT' && { query: { id: 'any' }}) });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(403);
      });
      
      test(`${method} /api/admin/prompts should return 403 if authenticated but not admin (session.user.isAdmin undefined, Firestore lookup returns false)`, async () => {
        mockUserSession({ user: { id: 'nonAdminUserId', email: 'user@example.com' } }); // isAdmin undefined in session
        mockFbGet.mockResolvedValueOnce(mockNonAdminUserDoc()); // Firestore lookup for user returns isAdmin: false
        
        const { req, res } = createMocks({ method, ...(method === 'PUT' && { query: { id: 'any' }}) });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(403);
        expect(mockCollection).toHaveBeenCalledWith('users'); // Verify Firestore user lookup
        expect(mockDoc).toHaveBeenCalledWith('nonAdminUserId');
      });

      test(`${method} /api/admin/prompts should return 403 if authenticated but user doc not found in Firestore`, async () => {
        mockUserSession({ user: { id: 'ghostUserId', email: 'ghost@example.com' } }); // isAdmin undefined in session
        mockFbGet.mockResolvedValueOnce(mockUserDocNotFound()); // Firestore lookup for user returns not found
        
        const { req, res } = createMocks({ method, ...(method === 'PUT' && { query: { id: 'any' }}) });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(403);
        expect(mockCollection).toHaveBeenCalledWith('users');
        expect(mockDoc).toHaveBeenCalledWith('ghostUserId');
      });
    });
  });

  // --- GET /api/admin/prompts (List all) ---
  describe('GET /api/admin/prompts (List)', () => {
    test('should return empty array if no prompts and user is admin (session isAdmin:true)', async () => {
      mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
      // No need to mock user Firestore get if session.user.isAdmin is true
      mockFbGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For promptLibrary.get()

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual([]);
      expect(mockCollection).toHaveBeenCalledWith('promptLibrary');
    });
    
    test('should return empty array if no prompts and user is admin (Firestore isAdmin:true)', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com' } }); // isAdmin undefined in session
        mockFbGet.mockResolvedValueOnce(mockAdminUserDoc(true)); // User lookup in Firestore
        mockFbGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For promptLibrary.get()
  
        const { req, res } = createMocks({ method: 'GET' });
        await handler(req, res);
  
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual([]);
        expect(mockCollection).toHaveBeenCalledWith('users'); // First call for admin check
        expect(mockCollection).toHaveBeenCalledWith('promptLibrary'); // Second call for prompts
      });

    test('should return list of prompts if user is admin', async () => {
      mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
      const mockPromptsData = [
        { id: 'p1', promptName: 'Summary Prompt', content: 'Summarize', variables: ['text'] },
        { id: 'p2', promptName: 'Reply Prompt', content: 'Reply', variables: ['context', 'originalEmail'] },
      ];
      const firestoreDocs = mockPromptsData.map(p => ({ id: p.id, data: () => p }));
      mockFbGet.mockResolvedValueOnce({ empty: false, docs: firestoreDocs }); // For promptLibrary.get()

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockPromptsData);
    });
  });

  // --- GET /api/admin/prompts?id=<promptDocId> (Get single) ---
  describe('GET /api/admin/prompts?id=<promptDocId> (Single)', () => {
    test('should return a single prompt if found and user is admin', async () => {
      mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
      const promptData = { promptName: 'Test Prompt', content: 'Details', variables: [] };
      mockFbGet.mockResolvedValueOnce({ exists: true, id: 'testPromptId', data: () => promptData }); // For promptLibrary.doc().get()

      const { req, res } = createMocks({ method: 'GET', query: { id: 'testPromptId' } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ id: 'testPromptId', ...promptData });
      expect(mockCollection).toHaveBeenCalledWith('promptLibrary');
      expect(mockDoc).toHaveBeenCalledWith('testPromptId');
    });

    test('should return 404 if single prompt not found and user is admin', async () => {
      mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
      mockFbGet.mockResolvedValueOnce({ exists: false }); // For promptLibrary.doc().get()

      const { req, res } = createMocks({ method: 'GET', query: { id: 'nonExistentId' } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Prompt not found.' });
    });
  });
  
  // --- PUT /api/admin/prompts?id=<promptDocId> ---
  describe('PUT /api/admin/prompts?id=<promptDocId>', () => {
    const promptIdToUpdate = 'testPromptId';
    const updatePayload = {
      promptName: "Updated Name",
      promptContent: "New updated content",
      description: "New description",
      variables: ["var1", "var2"]
    };

    test('should update prompt successfully if user is admin', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        
        mockFbUpdate.mockResolvedValue({}); // Simulate successful update
        mockFbGet.mockResolvedValueOnce({ // Simulate fetching the updated document for response
            exists: true, 
            id: promptIdToUpdate,
            data: () => ({ 
                ...updatePayload, 
                updatedAt: 'mock-server-timestamp', 
                lastUpdatedBy: 'adminUserId' 
            }) 
        });

        const { req, res } = createMocks({ 
            method: 'PUT', 
            query: { id: promptIdToUpdate },
            body: updatePayload 
        });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({
            id: promptIdToUpdate,
            ...updatePayload
        }));
        expect(mockCollection).toHaveBeenCalledWith('promptLibrary');
        expect(mockDoc).toHaveBeenCalledWith(promptIdToUpdate);
        expect(mockFbUpdate).toHaveBeenCalledWith(expect.objectContaining({
            ...updatePayload,
            updatedAt: 'mock-server-timestamp',
            lastUpdatedBy: 'adminUserId'
        }));
    });
    
    test('should update only description if only description is provided', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const partialPayload = { description: "Only description updated" };
        mockFbUpdate.mockResolvedValue({});
        mockFbGet.mockResolvedValueOnce({
            exists: true, id: promptIdToUpdate,
            data: () => ({ 
                promptName: "Original Name", promptContent: "Original Content", 
                description: "Only description updated", 
                variables: [],
                updatedAt: 'mock-server-timestamp', lastUpdatedBy: 'adminUserId' 
            })
        });

        const { req, res } = createMocks({ method: 'PUT', query: { id: promptIdToUpdate }, body: partialPayload });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(mockFbUpdate).toHaveBeenCalledWith(expect.objectContaining({
            description: "Only description updated",
            updatedAt: 'mock-server-timestamp',
            lastUpdatedBy: 'adminUserId'
        }));
        expect(mockFbUpdate.mock.calls[0][0].promptName).toBeUndefined();
        expect(mockFbUpdate.mock.calls[0][0].promptContent).toBeUndefined();
    });

    test('should return 404 if prompt to update not found, user is admin', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        mockFbUpdate.mockRejectedValue({ code: 5 }); // Simulate Firestore NOT_FOUND on update

        const { req, res } = createMocks({ 
            method: 'PUT', 
            query: { id: 'nonExistentId' },
            body: updatePayload 
        });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(404);
        expect(JSON.parse(res._getData())).toEqual({ error: 'Prompt not found for update.' });
    });
    
    test('should return 400 if promptContent is empty string, user is admin', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ 
            method: 'PUT', 
            query: { id: promptIdToUpdate },
            body: { promptContent: "" } // API expects non-empty if provided
        });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ error: 'promptContent must be a non-empty string if provided.' });
    });

    test('should return 400 if promptName is empty string, user is admin', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ 
            method: 'PUT', 
            query: { id: promptIdToUpdate },
            body: { promptName: "" } 
        });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ error: 'promptName must be a non-empty string if provided.' });
    });

    test('should return 400 if variables is not an array, user is admin', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ 
            method: 'PUT', 
            query: { id: promptIdToUpdate },
            body: { variables: "not-an-array" } 
        });
        await handler(req, res);
        
        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ error: 'variables must be an array if provided.' });
    });

    test('should return 400 if ID is missing in query for PUT', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ method: 'PUT', body: updatePayload }); // No query.id
        await handler(req, res);
        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ error: 'Prompt ID (as query parameter "id") is required for PUT requests.' });
    });
  });
  
  // --- Other HTTP Methods ---
  describe('Other Methods', () => {
    test('should return 405 for POST method', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ method: 'POST', body: {} });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders().allow).toEqual(['GET', 'PUT']);
    });

    test('should return 405 for DELETE method', async () => {
        mockUserSession({ user: { id: 'adminUserId', email: 'admin@example.com', isAdmin: true } });
        const { req, res } = createMocks({ method: 'DELETE' });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(405);
    });
  });
});
