// email-productivity-tool/nextjs-app/lib/cryptoUtils.js
import CryptoJS from 'crypto-js';

const getEncryptionKey = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    console.error("TOKEN_ENCRYPTION_KEY is not set. Token encryption/decryption will fail.");
    // In a real app, you might throw an error or have a fallback for local dev (not recommended for prod)
    // For this setup, we'll proceed and it will likely fail if key is missing, alerting the dev.
  }
  return key;
};

export const encryptToken = (tokenText) => {
  const key = getEncryptionKey();
  if (!tokenText || !key) return null; // Or throw error
  try {
    return CryptoJS.AES.encrypt(tokenText, key).toString();
  } catch (error) {
    console.error("Encryption failed:", error);
    return null; // Or re-throw
  }
};

export const decryptToken = (encryptedText) => {
  const key = getEncryptionKey();
  if (!encryptedText || !key) return null; // Or throw error
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || null; // Ensure empty string if decryption results in nothing
  } catch (error) {
    console.error("Decryption failed (possibly not an encrypted token or wrong key):", error);
    // It's common for this to fail if trying to decrypt an already plain text token
    // or if the key is incorrect. Return null or the original text if it's deemed plain.
    return null; 
  }
};
