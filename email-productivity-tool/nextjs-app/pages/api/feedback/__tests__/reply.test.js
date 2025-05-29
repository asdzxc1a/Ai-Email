import { createMocks } from 'node-mocks-http';
import handler from '../reply'; // Path to your API handler

// Mock getSession
jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
}));

// Mock Firebase Admin SDK
const mockAdd = jest.fn();
const mockCollection = jest.fn(() => ({ add: mockAdd }));

// This will be used by getFirestore mock.
let mockDbInstance = { collection: mockCollection }; 

// Mock getApps from firebase-admin/app
const mockGetApps = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: mockGetApps, 
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockDbInstance), 
  FieldValue: { serverTimestamp: jest.fn(() => 'mock-server-timestamp') },
}));

describe('/api/feedback/reply API Endpoint', () => {
  const mockUserSession = (sessionData) => {
    require('next-auth/react').getSession.mockResolvedValue(sessionData);
  };

  const baseValidBody = {
    messageId: 'testMsgId123',
    originalAiDraft: 'Original AI draft text.',
    finalUserDraft: 'User edited draft text.', // Default to edited for base
    thumbsFeedback: undefined, // Default to no thumbs feedback
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to authenticated user for most tests, can be overridden
    mockUserSession({ user: { id: 'testUserId' } }); 
    
    // Default to Firebase being initialized for most tests
    mockGetApps.mockReturnValue([true]); // Simulate app is initialized
    mockDbInstance = { collection: mockCollection }; // Reset db instance to a working one
  });

  // --- Authentication Tests ---
  test('should return 401 if user is not authenticated', async () => {
    mockUserSession(null); // Override default for this test
    const { req, res } = createMocks({ method: 'POST', body: baseValidBody });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Unauthorized. Please log in.' });
  });

  // --- Request Method Tests ---
  test('should return 405 for GET method', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders().allow).toEqual(['POST']);
  });
  
  test('should return 405 for PUT method', async () => {
    const { req, res } = createMocks({ method: 'PUT', body: baseValidBody });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  // --- Input Validation Tests ---
  describe('Input Validation', () => {
    test.each([
      [{ ...baseValidBody, messageId: undefined }, 'Invalid input: messageId (string) is required.'],
      [{ ...baseValidBody, messageId: '' }, 'Invalid input: messageId (string) is required.'],
      [{ ...baseValidBody, originalAiDraft: undefined }, 'Invalid input: originalAiDraft must be a string.'],
      [{ ...baseValidBody, originalAiDraft: 123 }, 'Invalid input: originalAiDraft must be a string.'],
      [{ ...baseValidBody, finalUserDraft: undefined }, 'Invalid input: finalUserDraft must be a string.'],
      [{ ...baseValidBody, finalUserDraft: true }, 'Invalid input: finalUserDraft must be a string.'],
      [{ ...baseValidBody, thumbsFeedback: 'neutral' }, 'Invalid input: thumbsFeedback must be "up", "down", or an empty string/null if not provided.'],
      [{ ...baseValidBody, thumbsFeedback: 123 }, 'Invalid input: thumbsFeedback must be a string if provided.'],
    ])('should return 400 for invalid body: %p -> %s', async (body, expectedErrorMessage) => {
      const { req, res } = createMocks({ method: 'POST', body });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: expectedErrorMessage });
    });
  });

  // --- Successful Feedback Submission Tests ---
  describe('Successful Submissions', () => {
    test('Scenario 1: Thumbs Up, No Edit - should submit successfully', async () => {
      mockAdd.mockResolvedValue({ id: 'mockFeedbackId1' });
      const testBody = {
        ...baseValidBody,
        finalUserDraft: baseValidBody.originalAiDraft, // No edit
        thumbsFeedback: 'up',
      };

      const { req, res } = createMocks({ method: 'POST', body: testBody });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ success: true, feedbackId: 'mockFeedbackId1' }));
      expect(mockCollection).toHaveBeenCalledWith('replyFeedback');
      expect(mockAdd).toHaveBeenCalledWith({
        userId: 'testUserId',
        messageId: testBody.messageId,
        originalAiDraft: testBody.originalAiDraft,
        finalUserDraft: testBody.finalUserDraft,
        hasBeenEdited: false, // Key check
        thumbsFeedback: 'up', // Key check
        timestamp: 'mock-server-timestamp',
      });
    });

    test('Scenario 2: Thumbs Down, With Edit - should submit successfully', async () => {
      mockAdd.mockResolvedValue({ id: 'mockFeedbackId2' });
      const testBody = {
        ...baseValidBody,
        finalUserDraft: 'This is a significantly edited draft.', // Edited
        thumbsFeedback: 'down',
      };

      const { req, res } = createMocks({ method: 'POST', body: testBody });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
        hasBeenEdited: true, // Key check
        thumbsFeedback: 'down', // Key check
        finalUserDraft: 'This is a significantly edited draft.',
        originalAiDraft: baseValidBody.originalAiDraft, 
      }));
    });
    
    test('Scenario 3: Edit Only, No Thumbs Feedback (undefined) - should submit successfully', async () => {
      mockAdd.mockResolvedValue({ id: 'mockFeedbackId3' });
      const testBody = {
        ...baseValidBody,
        finalUserDraft: 'Just an edit, no thumbs.', // Edited
        thumbsFeedback: undefined, // Explicitly undefined
      };

      const { req, res } = createMocks({ method: 'POST', body: testBody });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
        hasBeenEdited: true, // Key check
        thumbsFeedback: null, // API stores null if not 'up' or 'down'
      }));
    });

    test('Scenario 4: No Edit, No Thumbs Feedback (empty string) - should submit successfully', async () => {
        mockAdd.mockResolvedValue({ id: 'mockFeedbackId4' });
        const testBody = {
          ...baseValidBody,
          finalUserDraft: baseValidBody.originalAiDraft, // No edit
          thumbsFeedback: '', // Empty string
        };
  
        const { req, res } = createMocks({ method: 'POST', body: testBody });
        await handler(req, res);
  
        expect(res._getStatusCode()).toBe(201);
        expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
          hasBeenEdited: false, // Key check
          thumbsFeedback: null, // API stores null if empty string provided
        }));
      });
  });

  // --- Firestore Error Tests ---
  test('should return 500 if Firestore add operation fails', async () => {
    const firestoreError = new Error('Firestore test write error');
    mockAdd.mockRejectedValue(firestoreError);

    const { req, res } = createMocks({ method: 'POST', body: baseValidBody });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to submit reply feedback.',
      details: 'Firestore test write error',
    });
  });
  
  // --- Firestore Not Initialized Test ---
  test('should return 500 if Firestore is not initialized (db is null)', async () => {
    // Simulate Firebase not being initialized effectively making db null in handler
    mockGetApps.mockReturnValue([]); // No apps initialized
    
    const { req, res } = createMocks({ method: 'POST', body: baseValidBody });
    
    // Isolate this module's import to ensure it re-evaluates with the new mockGetApps value
    await jest.isolateModulesAsync(async () => {
        const isolatedHandler = (await import('../reply')).default;
        await isolatedHandler(req, res);
    });
        
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: "Server configuration error: Database not available." });
  });
});
