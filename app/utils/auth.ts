// Utility functions for authentication

/**
 * Generates a cryptographically secure random string (nonce).
 * @param length The desired length of the nonce string (default: 32).
 * @returns A random string.
 */
export function generateNonce(length: number = 32): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);

  // Convert byte array to hex string
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}