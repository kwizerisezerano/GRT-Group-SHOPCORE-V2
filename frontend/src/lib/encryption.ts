import CryptoJS from 'crypto-js';

// In production, this should be stored in environment variables
// and fetched from Supabase Edge Functions or a secure backend
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'shopcore-default-key-change-in-production';

/**
 * Encrypt sensitive data before storing in database
 */
export function encryptData(data: string): string {
  if (!data) return '';
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt sensitive data retrieved from database
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

/**
 * Encrypt an object's sensitive fields
 */
export function encryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[]
): T {
  const encrypted = { ...data };
  sensitiveFields.forEach(field => {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptData(encrypted[field]) as any;
    }
  });
  return encrypted;
}

/**
 * Decrypt an object's sensitive fields
 */
export function decryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[]
): T {
  const decrypted = { ...data };
  sensitiveFields.forEach(field => {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decryptData(decrypted[field]) as any;
    }
  });
  return decrypted;
}
