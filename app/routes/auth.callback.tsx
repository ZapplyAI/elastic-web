import React, { useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useNavigate, useSubmit } from '@remix-run/react';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only'; // Add ClientOnly back

const NONCE_STORAGE_KEY = 'authNonce';
const TOKEN_COOKIE_NAME = 'elastic_authToken'; // Updated cookie name

// Server-side Action to set the httpOnly cookie
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const token = formData.get('token');

    console.log('[Auth Callback] Processing authentication token');

    if (typeof token !== 'string' || !token) {
      console.error('[Auth Callback] Token missing or invalid');
      return json(
        {
          error: 'Token missing or invalid',
          requestId: new Date().getTime().toString(),
        },
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    // Validate token format (basic check for JWT format)
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
      console.error('[Auth Callback] Invalid token format');
      return json(
        {
          error: 'Invalid token format',
          requestId: new Date().getTime().toString(),
        },
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    console.log('[Auth Callback] Token validated, setting httpOnly cookie');

    // Set the httpOnly cookie with the new name
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7-day expiry

    const cookieValue = [
      `${TOKEN_COOKIE_NAME}=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      `Expires=${expiryDate.toUTCString()}`,

      // Add Secure flag in production environments
      import.meta.env.PROD ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    const headers = new Headers();
    headers.append('Set-Cookie', cookieValue);

    console.log('[Auth Callback] Cookie set successfully, redirecting to homepage');

    // Redirect to the homepage after setting the cookie
    return redirect('/', { headers });
  } catch (error) {
    console.error('[Auth Callback] Unexpected error in action:', error);

    return json(
      {
        error: 'Authentication failed due to an unexpected error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: new Date().getTime().toString(),
      },
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );
  }
}

// Client-side Component
export default function AuthCallback() {
  const submit = useSubmit();

  // const navigate = useNavigate(); // Likely not needed now, handled by action redirect
  const [message, setMessage] = useState('Verifying authentication...');
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState<string>(new Date().getTime().toString());

  // This function runs client-side after hydration
  const runVerification = () => {
    try {
      console.log('[Auth Callback] Running client-side verification...');

      const params = new URLSearchParams(window.location.search);
      const state = params.get('state');
      const token = params.get('token');

      // Log params without exposing full token for security
      const tokenPreview = token ? `${token.substring(0, 10)}...` : 'null';
      console.log('[Auth Callback] URL Parameters:', {
        state,
        tokenPresent: !!token,
        tokenPreview,
      });

      // Check for required parameters
      if (!state || !token) {
        console.error('[Auth Callback] Missing required URL parameters', {
          statePresent: !!state,
          tokenPresent: !!token,
          requestId,
        });
        setError('Authentication failed: Missing required parameters in callback URL.');
        setMessage('Error during authentication.');

        return;
      }

      // Validate token format (basic check for JWT format)
      if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
        console.error('[Auth Callback] Invalid token format', { requestId });
        setError('Authentication failed: Invalid token format.');
        setMessage('Error during authentication.');

        return;
      }

      // Get and validate nonce
      const expectedNonce = sessionStorage.getItem(NONCE_STORAGE_KEY);
      console.log('[Auth Callback] Retrieved nonce from session storage');

      if (!expectedNonce) {
        console.error('[Auth Callback] Missing expected nonce in session storage', { requestId });
        setError('Authentication failed: Security verification data not found.');
        setMessage('Error during authentication.');

        return;
      }

      // Clean up nonce regardless of outcome
      sessionStorage.removeItem(NONCE_STORAGE_KEY);
      console.log('[Auth Callback] Nonce removed from storage for security');

      // Verify nonce matches state parameter
      if (state !== expectedNonce) {
        console.error('[Auth Callback] State/nonce mismatch', {
          received: state,
          expected: expectedNonce,
          requestId,
        });
        setError('Authentication failed: Security check failed (state/nonce mismatch).');
        setMessage('Error during authentication.');

        return;
      }

      console.log('[Auth Callback] Verification successful, submitting token to server');
      setMessage('Verification successful. Finalizing login...');

      // Submit token to the server-side action
      const formData = new FormData();
      formData.append('token', token);
      formData.append('requestId', requestId);

      submit(formData, {
        method: 'post',
        action: '/auth/callback',
        replace: true,
      });
    } catch (error) {
      console.error('[Auth Callback] Unexpected error during verification:', error, { requestId });
      setError(`Authentication failed: ${error instanceof Error ? error.message : 'Unexpected error'}`);
      setMessage('Error during authentication.');
    }
  };

  // Wrap in ClientOnly to ensure useEffect runs client-side
  return (
    <ClientOnly
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
            <h1 className="text-2xl font-bold mb-4">Authentication Callback</h1>
            <p className="mb-6">Verifying authentication...</p>
          </div>
        </div>
      }
    >
      {() => {
        useEffect(() => {
          console.log('[Auth Callback] Component mounted, preparing verification');

          try {
            /*
             * Run verification logic only on the client after mount with a small delay
             * to ensure all browser APIs are available
             */
            const timerId = setTimeout(() => {
              try {
                runVerification();
              } catch (error) {
                console.error('[Auth Callback] Error in verification timeout callback:', error, { requestId });
                setError(
                  `Authentication process failed: ${error instanceof Error ? error.message : 'Unexpected error'}`,
                );
                setMessage('Error during authentication process.');
              }
            }, 100);

            // Cleanup function
            return () => {
              console.log('[Auth Callback] Component unmounting, clearing timeout');
              clearTimeout(timerId);
            };
          } catch (error) {
            console.error('[Auth Callback] Error in useEffect:', error, { requestId });
            setError(`Authentication setup failed: ${error instanceof Error ? error.message : 'Unexpected error'}`);
            setMessage('Error setting up authentication process.');

            // No cleanup needed in error case
            return undefined;
          }
        }, []); // Run only once

        // Render the UI part with improved error display
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center max-w-md w-full">
              <h1 className="text-2xl font-bold mb-4">Authentication Callback</h1>
              <p className="mb-6">{message}</p>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
                  <p className="text-red-600 dark:text-red-400 font-medium">Error</p>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Request ID: {requestId}</p>
                </div>
              )}

              {error && (
                <div className="mt-6">
                  <a
                    href="/"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Return to Home
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </ClientOnly>
  );
}
