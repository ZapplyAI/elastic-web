import React from 'react';
import { generateNonce } from '~/utils/auth';

// Use environment variables with fallbacks for local development
const AUTH_URI_BASE = import.meta.env.VITE_AUTH_URI_BASE || 'http://localhost:3000/session/auth';
const CALLBACK_URL = import.meta.env.VITE_AUTH_CALLBACK_URL || 'http://localhost:5173/auth/callback';
const NONCE_STORAGE_KEY = 'authNonce';

export function AuthScreen() {
  const handleLogin = () => {
    const nonce = generateNonce();

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(NONCE_STORAGE_KEY, nonce);
      }
    } catch (error) {
      console.error('Failed to store nonce in sessionStorage:', error);
      return;
    }

    const params = new URLSearchParams({
      state: nonce,
      callback_url: CALLBACK_URL,
    });
    const redirectUri = `${AUTH_URI_BASE}?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.location.href = redirectUri;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="mb-6">Please log in to access the application.</p>
        <button
          onClick={handleLogin}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition duration-200 ease-in-out"
        >
          Login
        </button>
      </div>
    </div>
  );
}
