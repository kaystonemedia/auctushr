// Secure token storage and management
class SecureTokenManager {
  constructor() {
    this.encryptionKey = null;
    this.initializeEncryption();
  }

  async initializeEncryption() {
    // Generate or retrieve encryption key
    const stored = await chrome.storage.local.get('encryptionSalt');
    if (!stored.encryptionSalt) {
      // Generate new salt for encryption
      const salt = crypto.getRandomValues(new Uint8Array(16));
      await chrome.storage.local.set({ 
        encryptionSalt: Array.from(salt) 
      });
    }
  }

  async encryptData(data) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));
      
      // Generate a random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Get encryption key
      const key = await this.getEncryptionKey();
      
      // Encrypt the data
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
      );
      
      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedData), iv.length);
      
      return Array.from(result);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  async decryptData(encryptedArray) {
    try {
      const encryptedData = new Uint8Array(encryptedArray);
      
      // Extract IV and encrypted content
      const iv = encryptedData.slice(0, 12);
      const encrypted = encryptedData.slice(12);
      
      // Get encryption key
      const key = await this.getEncryptionKey();
      
      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedData);
      
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  async getEncryptionKey() {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }
    
    const { encryptionSalt } = await chrome.storage.local.get('encryptionSalt');
    const saltArray = new Uint8Array(encryptionSalt);
    
    // Derive key from salt and extension ID
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(chrome.runtime.id),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltArray,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return this.encryptionKey;
  }

  async storeSecureToken(token, userId) {
    const tokenData = {
      token: token,
      userId: userId,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    const encryptedData = await this.encryptData(tokenData);
    await chrome.storage.local.set({ 
      secureAuthData: encryptedData 
    });
  }

  async getSecureToken() {
    try {
      const { secureAuthData } = await chrome.storage.local.get('secureAuthData');
      if (!secureAuthData) {
        return null;
      }
      
      const tokenData = await this.decryptData(secureAuthData);
      
      // Check if token is expired
      if (tokenData.expiresAt < Date.now()) {
        await this.clearSecureToken();
        return null;
      }
      
      return tokenData;
    } catch (error) {
      console.error('Failed to retrieve secure token:', error);
      return null;
    }
  }

  async clearSecureToken() {
    await chrome.storage.local.remove(['secureAuthData']);
  }
}

// Export the secure token manager
const secureTokenManager = new SecureTokenManager();

// Replace the old token functions
async function getAuthToken() {
  const tokenData = await secureTokenManager.getSecureToken();
  return tokenData?.token || null;
}

async function getUserId() {
  const tokenData = await secureTokenManager.getSecureToken();
  return tokenData?.userId || null;
}

async function storeAuthToken(token, userId) {
  await secureTokenManager.storeSecureToken(token, userId);
}

async function clearAuthToken() {
  await secureTokenManager.clearSecureToken();
} 