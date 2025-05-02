import React, { useEffect, useState } from 'react';
import { useNavigate, useSubmit } from '@remix-run/react';
import type { ActionFunctionArgs } from '@remix-run/cloudflare'; 
import { json, redirect } from '@remix-run/cloudflare'; 
import { ClientOnly } from 'remix-utils/client-only'; // Add ClientOnly back

const NONCE_STORAGE_KEY = 'authNonce';
const TOKEN_COOKIE_NAME = 'elastic_authToken'; // Updated cookie name

// Server-side Action to set the httpOnly cookie
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get('token');

  if (typeof token !== 'string' || !token) {
    return json({ error: 'Token missing or invalid' }, { status: 400 });
  }

  console.log('[Server Action] Received token, setting httpOnly cookie...');

  // Set the httpOnly cookie with the new name
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); // 7-day expiry
  const cookieValue = [
    `${TOKEN_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Expires=${expiryDate.toUTCString()}`,
    // process.env.NODE_ENV === 'production' ? 'Secure' : '' // Add Secure flag in production
  ].filter(Boolean).join('; ');

  const headers = new Headers();
  headers.append('Set-Cookie', cookieValue);

  // Redirect to the homepage after setting the cookie
  return redirect('/', { headers });
}

// Client-side Component
export default function AuthCallback() {
  const submit = useSubmit(); 
  // const navigate = useNavigate(); // Likely not needed now, handled by action redirect
  const [message, setMessage] = useState('Verifying authentication...');
  const [error, setError] = useState<string | null>(null);

  // This function runs client-side after hydration
  const runVerification = () => { 
    console.log('[Client Callback - httpOnly] Running verification...');
    
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    const token = params.get('token');
    console.log('[Client Callback - httpOnly] Params:', { state, token });

    const expectedNonce = sessionStorage.getItem(NONCE_STORAGE_KEY);
    console.log('[Client Callback - httpOnly] Expected Nonce:', expectedNonce);

    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    console.log('[Client Callback - httpOnly] Nonce removed from storage.');

    if (!state || !token || !expectedNonce) {
      console.error('Auth callback error: Missing state, token, or expected nonce.');
      setError('Authentication failed: Invalid callback parameters.');
      setMessage('Error during authentication.');
      return;
    }

    if (state !== expectedNonce) {
      console.error('Auth callback error: State (nonce) mismatch.');
      console.error(`Received: ${state}, Expected: ${expectedNonce}`);
      setError('Authentication failed: Security check failed (nonce mismatch).');
      setMessage('Error during authentication.');
      return;
    }

    console.log('[Client Callback - httpOnly] Nonce matched. Submitting token...');
    setMessage('Verification successful. Finalizing login...');

    // Submit token to the server-side action
    const formData = new FormData();
    formData.append('token', token);
    submit(formData, {
      method: 'post',
      action: '/auth/callback', 
      replace: true, 
    });
  };

  return (
    // Wrap in ClientOnly to ensure useEffect runs client-side
    <ClientOnly fallback={<p>Verifying...</p>}>
      {() => {
        useEffect(() => {
          // Run verification logic only on the client after mount
          const timerId = setTimeout(runVerification, 0); 
          return () => clearTimeout(timerId);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []); // Run only once

        // Render the UI part
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
              <h1 className="text-2xl font-bold mb-4">Authentication Callback</h1>
              <p className="mb-6">{message}</p>
              {error && (
                <p className="text-red-600 dark:text-red-400 mt-4">Error: {error}</p>
              )}
            </div>
          </div>
        );
      }}
    </ClientOnly>
  );
} 