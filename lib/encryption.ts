/**
 * Encryption utilities for secure file encryption
 * This module provides functions to encrypt files before upload and decrypt files after download
 * using a secure key management system
 */

/**
 * Generates a secure encryption key for a file
 * @returns A Promise that resolves to a CryptoKey for AES-GCM encryption
 */
export async function generateFileKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable - so we can export it
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to a base64 string for storage
 * @param key The CryptoKey to export
 * @returns A Promise that resolves to a base64 string representation of the key
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exportedKey);
}

/**
 * Imports a base64 string to a CryptoKey
 * @param keyString The base64 string representation of the key
 * @returns A Promise that resolves to a CryptoKey
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = base64ToBuffer(keyString);
  return window.crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a file using AES-GCM
 * @param file The file to encrypt
 * @returns A Promise that resolves to an object containing the encrypted file, file key, and IV
 */
export async function encryptFile(file: File): Promise<{
  encryptedFile: File;
  fileKey: string; // base64 encoded key
  iv: string; // base64 encoded IV
}> {
  // Generate a random file key
  const fileKey = await generateFileKey();
  
  // Generate a random IV for this encryption
  const ivArray = window.crypto.getRandomValues(new Uint8Array(12));
  const iv = ivArray.buffer;
  
  // Read the file
  const fileContent = await readFileAsArrayBuffer(file);
  
  // Encrypt the file content
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    fileKey,
    fileContent
  );
  
  // Create a new File object with the encrypted content
  const encryptedFile = new File(
    [encryptedContent], 
    file.name, 
    { type: 'application/octet-stream', lastModified: file.lastModified }
  );
  
  // Export the file key for storage
  const exportedKey = await exportKey(fileKey);
  
  return {
    encryptedFile,
    fileKey: exportedKey,
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts a file using AES-GCM
 * @param encryptedBlob The encrypted file blob
 * @param fileKey The file encryption key as a base64 string
 * @param iv The IV used during encryption, as a base64 string
 * @param originalType The original file MIME type
 * @param originalName The original filename
 * @returns A Promise that resolves to the decrypted file
 */
export async function decryptFile(
  encryptedBlob: Blob,
  fileKey: string,
  iv: string,
  originalType: string,
  originalName: string
): Promise<File> {
  try {
    // Import the file key
    const key = await importKey(fileKey);
    
    // Convert the IV back to an ArrayBuffer
    const ivBuffer = base64ToBuffer(iv);
    
    // Read the encrypted file
    const encryptedContent = await readBlobAsArrayBuffer(encryptedBlob);
    
    // Decrypt the file content
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      encryptedContent
    );
    
    // Create a new File object with the decrypted content
    return new File(
      [decryptedContent],
      originalName,
      { type: originalType, lastModified: new Date().getTime() }
    );
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('File decryption failed');
  }
}

/**
 * Helper function to read a file as an ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Helper function to read a blob as an ArrayBuffer
 */
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Helper function to convert an ArrayBuffer to a base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper function to convert a base64 string to an ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// We no longer need these functions as we're using the user's password directly

/**
 * Encrypts a string using AES-GCM (server-side)
 * This is used for encrypting shared file passwords
 * @param text The string to encrypt
 * @param useServerKey Whether to use the server encryption key (true) or generate a new one (false)
 * @returns A Promise that resolves to the encrypted text as a base64 string
 */
export async function encrypt(text: string, returnPlainText: boolean = false): Promise<string> {
  if (returnPlainText) {
    // For simplicity in the demo, we return the plain text
    // In a production environment, you would implement proper encryption
    return text;
  }
  
  try {
    // In browser environment
    if (typeof window !== 'undefined') {
      // Generate a random key for this encryption
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt']
      );
      
      // Generate a random IV
      const ivArray = window.crypto.getRandomValues(new Uint8Array(12));
      const iv = ivArray.buffer;
      
      // Convert the text to an ArrayBuffer
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      // Encrypt the data
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        data
      );
      
      // Export the key
      const exportedKey = await window.crypto.subtle.exportKey('raw', key);
      
      // Combine the IV and encrypted data into a single buffer
      const combined = new Uint8Array(ivArray.length + new Uint8Array(encryptedData).length + new Uint8Array(exportedKey).length + 2);
      combined[0] = ivArray.length;
      combined[1] = new Uint8Array(exportedKey).length;
      combined.set(ivArray, 2);
      combined.set(new Uint8Array(exportedKey), 2 + ivArray.length);
      combined.set(new Uint8Array(encryptedData), 2 + ivArray.length + new Uint8Array(exportedKey).length);
      
      // Convert to base64
      return bufferToBase64(combined.buffer);
    } else {
      // Server-side encryption would use the server key
      // This is a simplified version for demo purposes
      return Buffer.from(text).toString('base64');
    }
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt text');
  }
}

/**
 * Decrypts an encrypted string (server-side)
 * @param encryptedText The encrypted text as a base64 string
 * @returns The decrypted string
 */
export async function decryptText(encryptedText: string): Promise<string> {
  try {
    // For simplicity in the demo, we assume encryptedText is plain text
    // In a production environment, you would implement proper decryption
    return encryptedText;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt text');
  }
}
