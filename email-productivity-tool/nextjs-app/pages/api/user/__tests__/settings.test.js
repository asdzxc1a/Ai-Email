import { createMocks } from 'node-mocks-http';
import handler from '../settings'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// Mock Firebase Admin SDK
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
}));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => [true]), // Simulate already initialized
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ collection: mockCollection })),
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') },
}));


describe('/api/user/settings API Endpoint', () => {
  const mockSession = (sessionData) => {
    // getSession is the default export from next-auth/react in some versions,
    // or a named export. The actual module might export it as { getSession }.
    // For this mock, we directly assign to the mock function.
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    mockSession(null); // Default to no session
  });

  // --- GET Requests ---
  describe('GET', () => {
    test('should return 401 if user is not authenticated', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ error: expect.stringContaining('Unauthorized') }));
    });

    test('should return autoSendEnabled:false and create doc if user authenticated but no doc exists', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      mockGet.mockResolvedValue({ exists: false }); // Firestore doc does not exist
      mockSet.mockResolvedValue({}); // Firestore set is successful

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ autoSendEnabled: false });
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockDoc).toHaveBeenCalledWith('testUserId');
      // API uses set without merge:true for new doc creation
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', autoSendEnabled: false, createdAt: 'mock-server-timestamp', updatedAt: 'mock-server-timestamp' })
      );
    });
    
    test('should return existing autoSendEnabled value if doc exists and value is true', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      mockGet.mockResolvedValue({ exists: true, data: () => ({ autoSendEnabled: true, email: 'test@example.com' }) });

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ autoSendEnabled: true });
    });

    test('should return existing autoSendEnabled value if doc exists and value is false', async () => {
        mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
        mockGet.mockResolvedValue({ exists: true, data: () => ({ autoSendEnabled: false, email: 'test@example.com' }) });
  
        const { req, res } = createMocks({ method: 'GET' });
        await handler(req, res);
  
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual({ autoSendEnabled: false });
      });

     test('should return autoSendEnabled:false if field missing in existing doc', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      mockGet.mockResolvedValue({ exists: true, data: () => ({ email: 'test@example.com' }) }); // autoSendEnabled missing

      const { req, res } = createMocks({ method: 'GET' });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ autoSendEnabled: false });
    });
  });

  // --- POST Requests ---
  describe('POST', () => {
    test('should return 401 if user is not authenticated', async () => {
      const { req, res } = createMocks({ method: 'POST', body: { autoSendEnabled: true } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(401);
    });

    test('should update autoSendEnabled to true if doc exists and return success', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      mockGet.mockResolvedValue({ exists: true, data: () => ({ email: 'test@example.com', autoSendEnabled: false }) }); // Doc exists
      mockUpdate.mockResolvedValue({}); // Firestore update is successful

      const { req, res } = createMocks({ method: 'POST', body: { autoSendEnabled: true } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ success: true, autoSendEnabled: true });
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockDoc).toHaveBeenCalledWith('testUserId');
      expect(mockUpdate).toHaveBeenCalledWith({
        autoSendEnabled: true,
        updatedAt: 'mock-server-timestamp',
      });
      expect(mockSet).not.toHaveBeenCalled(); // Ensure set is not called when update is expected
    });
    
    test('should update autoSendEnabled to false if doc exists and return success', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      mockGet.mockResolvedValue({ exists: true, data: () => ({ email: 'test@example.com', autoSendEnabled: true }) }); // Doc exists
      mockUpdate.mockResolvedValue({});

      const { req, res } = createMocks({ method: 'POST', body: { autoSendEnabled: false } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ success: true, autoSendEnabled: false });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ autoSendEnabled: false, updatedAt: 'mock-server-timestamp' })
      );
      expect(mockSet).not.toHaveBeenCalled();
    });

    test('should return 400 if autoSendEnabled is not a boolean', async () => {
      mockSession({ user: { id: 'testUserId', email: 'test@example.com' } });
      const { req, res } = createMocks({ method: 'POST', body: { autoSendEnabled: 'not-a-boolean' } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid input: autoSendEnabled must be a boolean.' });
    });
    
    test('should create doc with setting if it does not exist on POST', async () => {
      mockSession({ user: { id: 'newUserId', email: 'new@example.com' } });
      mockGet.mockResolvedValue({ exists: false }); // Simulate doc does not exist
      mockSet.mockResolvedValue({}); // Firestore set is successful

      const { req, res } = createMocks({ method: 'POST', body: { autoSendEnabled: true } });
      await handler(req, res);
      
      expect(res._getStatusCode()).toBe(201); // API returns 201 when creating
      expect(JSON.parse(res._getData())).toEqual({ success: true, autoSendEnabled: true, created: true });
      expect(mockGet).toHaveBeenCalledWith(); // get is called first
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@example.com',
        autoSendEnabled: true,
        createdAt: 'mock-server-timestamp',
        updatedAt: 'mock-server-timestamp',
      }));
      expect(mockUpdate).not.toHaveBeenCalled(); // Update should not be called if doc is new
    });
  });
  
  // --- Other HTTP Methods ---
  describe('Other Methods', () => {
    test('should return 405 for PUT method', async () => {
        const { req, res } = createMocks({ method: 'PUT', body: {} });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders().allow).toEqual(['GET', 'POST']);
    });

    test('should return 405 for DELETE method', async () => {
        const { req, res } = createMocks({ method: 'DELETE' });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(405);
    });
  });
});
