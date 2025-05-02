import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';

// Using dynamic import to avoid top-level await issues
let _serverBuild: any = null;

export const onRequest = async (context: any) => {
  if (!_serverBuild) {
    // Only load the server build once
    try {
      // @ts-ignore - This module is generated at build time
      _serverBuild = await import('../build/server');
    } catch (error) {
      return new Response('Failed to load server build: ' + (error instanceof Error ? error.message : String(error)), { 
        status: 500 
      });
    }
  }

  // Create a handler with the dynamically loaded build
  const handleRequest = createPagesFunctionHandler({
    // @ts-ignore - Type issues with the dynamically loaded module
    build: _serverBuild
  });

  return handleRequest(context);
};
