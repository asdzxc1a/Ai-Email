// gcp-functions/handleGmailNotification/cfCryptoUtils.js
const CryptoJS = require('crypto-js'); // Use require for CF

const getEncryptionKey = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    console.error("CF: TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
  }
  return key;
};

// Though CF primarily decrypts, including encryptToken for completeness or future use.
const encryptToken = (tokenText) => {
  const key = getEncryptionKey();
  if (!tokenText || !key) return null;
  try {
    return CryptoJS.AES.encrypt(tokenText, key).toString();
  } catch (error) { 
    console.error("CF Encryption failed:", error); 
    return null; 
  }
};

const decryptToken = (encryptedText) => {
  const key = getEncryptionKey();
  if (!encryptedText || !key) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // If originalText is empty string, it means decryption resulted in empty, which is valid.
    // If it's null, it might mean the input was not a valid ciphertext for the key.
    return originalText || null; 
  } catch (error) {
    // This catch block is important. If an already plaintext token is passed,
    // or a token encrypted with a different key, decrypt will throw an error.
    console.error("CF Decryption failed (possibly wrong key, or input is not truly encrypted, or malformed ciphertext):", error.message);
    return null; // Return null on decryption error
  }
};

module.exports = { encryptToken, decryptToken };
