import { createMocks } from 'node-mocks-http';
import handler from '../summary'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// Mock Firebase Admin SDK
const mockAdd = jest.fn();
const mockCollection = jest.fn(() => ({ add: mockAdd }));

// This will be used by getFirestore mock. We can change its value in tests.
let mockDbInstance = { collection: mockCollection }; 

// Mock getApps from firebase-admin/app
const mockGetApps = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: mockGetApps, 
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
  // getFirestore will now use the mockDbInstance which can be controlled per test
  getFirestore: jest.fn(() => mockDbInstance), 
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') },
}));

describe('/api/feedback/summary API Endpoint', () => {
  const mockUserSession = (sessionData) => {
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  const validFeedbackBody = {
    messageId: 'testMessage123',
    summaryText: 'This is a test summary.',
    feedbackType: 'up',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSession(null); // Default to no session
    
    // Default to Firebase being initialized for most tests
    mockGetApps.mockReturnValue([true]); // Simulate app is initialized
    mockDbInstance = { collection: mockCollection }; // Reset db instance to a working one
  });

  test('should return 405 for non-POST methods (e.g., GET)', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders().allow).toEqual(['POST']);
  });
  
  test('should return 405 for PUT method', async () => {
    const { req, res } = createMocks({ method: 'PUT', body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders().allow).toEqual(['POST']);
  });


  test('should return 401 if user is not authenticated', async () => {
    const { req, res } = createMocks({ method: 'POST', body: validFeedbackBody });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Unauthorized. Please log in.' });
  });

  describe('Input Validation', () => {
    beforeEach(() => { // Authenticate user for these validation tests
      mockUserSession({ user: { id: 'testUserId' } });
    });

    // Test cases for various invalid inputs
    // Note: The API code has specific error messages which should be matched.
    test.each([
      [{ ...validFeedbackBody, messageId: undefined }, 'Invalid input: messageId (string) is required.'],
      [{ ...validFeedbackBody, messageId: '' }, 'Invalid input: messageId (string) is required.'],
      [{ ...validFeedbackBody, messageId: null }, 'Invalid input: messageId (string) is required.'], // API treats null as missing
      [{ ...validFeedbackBody, summaryText: undefined }, 'Invalid input: summaryText (string) is required.'],
      [{ ...validFeedbackBody, summaryText: '' }, 'Invalid input: summaryText (string) is required.'],
      [{ ...validFeedbackBody, summaryText: null }, 'Invalid input: summaryText (string) is required.'], // API treats null as missing
      [{ ...validFeedbackBody, feedbackType: undefined }, 'Invalid input: feedbackType must be "up" or "down".'],
      [{ ...validFeedbackBody, feedbackType: null }, 'Invalid input: feedbackType must be "up" or "down".'],
      [{ ...validFeedbackBody, feedbackType: 'invalid' }, 'Invalid input: feedbackType must be "up" or "down".'],
      [{ ...validFeedbackBody, feedbackType: 'NEUTRAL' }, 'Invalid input: feedbackType must be "up" or "down".'],
    ])('should return 400 for invalid body: %p leading to error: "%s"', async (body, expectedErrorMessage) => {
      const { req, res } = createMocks({ method: 'POST', body });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: expectedErrorMessage });
    });
  });

  test('should successfully submit feedback ("up") and return 201', async () => {
    mockUserSession({ user: { id: 'testUserId' } });
    mockAdd.mockResolvedValue({ id: 'mockFeedbackId' }); // Simulate successful Firestore add

    const { req, res } = createMocks({ method: 'POST', body: validFeedbackBody });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      message: 'Feedback submitted successfully.',
      feedbackId: 'mockFeedbackId',
    });
    expect(mockCollection).toHaveBeenCalledWith('summaryFeedback');
    expect(mockAdd).toHaveBeenCalledWith({
      userId: 'testUserId',
      messageId: validFeedbackBody.messageId,
      summaryText: validFeedbackBody.summaryText,
      feedback: 'up', // From validFeedbackBody
      timestamp: 'mock-server-timestamp',
    });
  });
  
  test('should successfully submit feedback ("down") and return 201', async () => {
    mockUserSession({ user: { id: 'testUserId' } });
    mockAdd.mockResolvedValue({ id: 'mockFeedbackId2' });
    const downFeedbackBody = {...validFeedbackBody, feedbackType: "down"};

    const { req, res } = createMocks({ method: 'POST', body: downFeedbackBody });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual({
        success: true,
        message: 'Feedback submitted successfully.',
        feedbackId: 'mockFeedbackId2',
    });
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ 
        userId: 'testUserId',
        messageId: downFeedbackBody.messageId,
        summaryText: downFeedbackBody.summaryText,
        feedback: 'down', // Check for 'down'
        timestamp: 'mock-server-timestamp'
    }));
  });

  test('should return 500 if Firestore add operation fails', async () => {
    mockUserSession({ user: { id: 'testUserId' } });
    const firestoreError = new Error('Firestore test error');
    mockAdd.mockRejectedValue(firestoreError);

    const { req, res } = createMocks({ method: 'POST', body: validFeedbackBody });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to submit feedback.',
      details: 'Firestore test error',
    });
  });
  
  test('should return 500 if Firestore is not initialized (db is null)', async () => {
    mockUserSession({ user: { id: 'testUserId' } });
    
    // Simulate Firebase not being initialized effectively making db null in handler
    mockGetApps.mockReturnValue([]); // No apps initialized
    // The handler itself has: const db = getApps().length > 0 ? getFirestore() : null;
    // So, if getApps() returns [], db inside handler will be null.
    // We also need to make sure our getFirestore mock doesn't get called or returns something
    // that indicates an issue if it were called when db should be null.
    // For this test, the key is that the handler's internal `db` becomes null.
    
    const { req, res } = createMocks({ method: 'POST', body: validFeedbackBody });
    
    // Re-import or ensure handler picks up the changed mock state for `db`
    // Since `db` is module-scoped in the handler, changes to `mockGetApps`
    // must occur *before* the handler is imported for the first time in the test suite
    // if the `db` constant is set at module load.
    // However, the example structure for `summary.js` (API route) usually defines `db`
    // near the top based on `getApps().length`.
    // For Jest, if the module is imported once at the top of the test file,
    // this test needs careful handling of how `db` is perceived by the handler.
    // The provided API structure: `const db = getApps().length > 0 ? getFirestore() : null;`
    // This line runs when the module `../summary` is loaded.
    // To test this, we need to reset modules or ensure the condition for `db` being null is met
    // *before* the handler is effectively "compiled" for the test run.
    
    // A more direct way to test the handler's internal check for `db` being null:
    // Temporarily set our mock getFirestore to return null.
    jest.isolateModules(async () => {
        mockGetApps.mockReturnValue([]); // Ensure getApps returns empty
        // We need to ensure that the `db` const inside the handler module becomes null.
        // This means the module needs to be "re-evaluated" with this mock in place.
        // Jest's default behavior might cache the module.
        // A common pattern is `jest.resetModules()` in `beforeEach` and then `requireActual` or `import`
        // within the test or a `beforeEach` for specific describe blocks.

        // For this specific test, let's assume the `db` in the handler becomes null due to `getApps()` returning `[]`
        // The `getFirestore()` mock returning `mockDbInstance` is fine, as it won't be called if `getApps().length` is 0.

        const handlerForThisTest = require('../summary').default; // Re-require for this specific isolated context
        await handlerForThisTest(req, res);
        expect(res._getStatusCode()).toBe(500);
        // The API returns a generic error if `db` is null.
        expect(JSON.parse(res._getData())).toEqual({ error: "Server configuration error: Database not available." });
    });
  });
});
