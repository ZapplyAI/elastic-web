// Utility functions for authentication

/**
 * Generates a cryptographically secure random string (nonce).
 * @param length The desired length of the nonce string (default: 32).
 * @returns A random string.
 */
export function generateNonce(length: number = 32): string {
  const array = new Uint8Array(length);

  if (typeof window !== 'undefined') {
    window.crypto.getRandomValues(array);
  } else {
    /*
     * Fallback for server environment
     * This is less secure but provides a fallback when window.crypto is not available
     */
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  // Convert byte array to hex string
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
