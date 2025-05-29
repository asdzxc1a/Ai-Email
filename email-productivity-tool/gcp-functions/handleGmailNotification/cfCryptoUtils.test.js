describe('cfCryptoUtils', () => {
  const ORIGINAL_TEXT = 'mySecretToken123!@#';
  const MOCK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef'; // 32-byte key

  let originalEnv;
  let consoleErrorSpy;

  beforeEach(() => {
    // Store original process.env
    originalEnv = { ...process.env };
    // Reset modules to ensure cfCryptoUtils re-reads process.env
    jest.resetModules();
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
    // Restore console.error spy
    consoleErrorSpy.mockRestore();
  });

  describe('with TOKEN_ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = MOCK_ENCRYPTION_KEY;
    });

    test('encryptToken should successfully encrypt a string', () => {
      const { encryptToken } = require('./cfCryptoUtils');
      const encrypted = encryptToken(ORIGINAL_TEXT);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBeNull();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(ORIGINAL_TEXT);
    });

    test('decryptToken should successfully decrypt an encrypted string', () => {
      const { encryptToken, decryptToken } = require('./cfCryptoUtils');
      const encrypted = encryptToken(ORIGINAL_TEXT);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(ORIGINAL_TEXT);
    });

    test('encryptToken and decryptToken should work for an empty string', () => {
      const { encryptToken, decryptToken } = require('./cfCryptoUtils');
      const encryptedEmpty = encryptToken('');
      expect(encryptedEmpty).toBeDefined();
      expect(encryptedEmpty).not.toBeNull();
      const decryptedEmpty = decryptToken(encryptedEmpty);
      expect(decryptedEmpty).toBe('');
    });

    test('decryptToken should return null for a malformed token (not valid Base64 or wrong format)', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      const malformedToken = 'thisIsNotValidEncryptedData';
      expect(decryptToken(malformedToken)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "CF Decryption failed (possibly wrong key, or input is not truly encrypted, or malformed ciphertext):",
        expect.any(String) // CryptoJS errors are strings
      );
    });
    
    test('decryptToken should return null for a token encrypted with a different key (simulated by garbage data)', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      // This simulates data that is base64 but not decryptable with the current key
      const garbageEncryptedData = Buffer.from("some other key's data").toString('base64');
      expect(decryptToken(garbageEncryptedData)).toBeNull();
       expect(consoleErrorSpy).toHaveBeenCalledWith(
        "CF Decryption failed (possibly wrong key, or input is not truly encrypted, or malformed ciphertext):",
        expect.any(String)
      );
    });

    test('encryptToken should return null for null input', () => {
      const { encryptToken } = require('./cfCryptoUtils');
      expect(encryptToken(null)).toBeNull();
      // The module's getEncryptionKey would log if key is missing, but encryptToken itself doesn't log for null input
      // if key is present. If key was missing, getEncryptionKey would log.
    });
    
    test('encryptToken should return null for undefined input', () => {
      const { encryptToken } = require('./cfCryptoUtils');
      expect(encryptToken(undefined)).toBeNull();
    });

     test('decryptToken should return null for null input', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      expect(decryptToken(null)).toBeNull();
    });

    test('decryptToken should return null for undefined input', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      expect(decryptToken(undefined)).toBeNull();
    });
  });

  describe('without TOKEN_ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      // Ensure the key is not set for these tests
      delete process.env.TOKEN_ENCRYPTION_KEY;
    });

    test('encryptToken should return null if TOKEN_ENCRYPTION_KEY is missing', () => {
      const { encryptToken } = require('./cfCryptoUtils');
      expect(encryptToken(ORIGINAL_TEXT)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("CF: TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
    });

    test('decryptToken should return null if TOKEN_ENCRYPTION_KEY is missing', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      // We need some dummy encrypted-like string, as it first checks the input.
      const dummyEncrypted = Buffer.from("dummy").toString('base64'); 
      expect(decryptToken(dummyEncrypted)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("CF: TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
    });

    test('encryptToken should return null for empty string if key is missing', () => {
      const { encryptToken } = require('./cfCryptoUtils');
      expect(encryptToken('')).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("CF: TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
    });

    test('decryptToken should return null for empty string if key is missing', () => {
      const { decryptToken } = require('./cfCryptoUtils');
      expect(decryptToken('')).toBeNull(); // It will be null because input is not null/undefined but key is missing
      expect(consoleErrorSpy).toHaveBeenCalledWith("CF: TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
    });
  });
});
