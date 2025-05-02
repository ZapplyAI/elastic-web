import { useStore } from '@nanostores/react';
import type {
  LinksFunction,
  LoaderFunctionArgs,
} from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

import { AuthScreen } from '~/components/auth/AuthScreen';
import { logStore } from './lib/stores/logs';
import { fetchUserProfile } from '~/lib/api/client';
import type { UserProfile } from '~/types/user';
import { setUserProfile } from './lib/stores/user';

const TOKEN_COOKIE_NAME = 'elastic_authToken';

// --- Server-Side Loader ---
export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = new Map<string, string>();
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.match(/(.*?)=(.*)$/);
      if (parts) {
        const name = parts[1].trim();
        const value = parts[2].trim();
        cookies.set(name, value);
      }
    });
  }
  
  const authToken = cookies.get(TOKEN_COOKIE_NAME);
  let isAuthenticated = false;
  let userProfile: UserProfile | null = null;

  if (authToken) {
    console.log(`[Loader] Auth token found. Fetching user profile...`);
    userProfile = await fetchUserProfile(authToken);
    // Consider user authenticated only if profile fetch is successful
    isAuthenticated = userProfile !== null; 
    if (!isAuthenticated) {
        console.warn('[Loader] Token found, but profile fetch failed. User treated as unauthenticated.')
        // Optionally clear the invalid cookie here?
    }
  } else {
    console.log(`[Loader] Auth token not found.`);
  }

  console.log(`[Loader] Auth check complete. isAuthenticated: ${isAuthenticated}`);
  logStore.logSystem('Loader auth check', {
    isAuthenticated,
    hasCookie: !!authToken,
    hasProfile: userProfile !== null,
    path: new URL(request.url).pathname,
  });
  
  // Return both auth status and user profile
  return json({ isAuthenticated, userProfile }); 
}
// --- End Server-Side Loader ---

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous' as const,
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('elasticApp_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  const theme = useStore(themeStore);
  const location = useLocation();
  const { isAuthenticated, userProfile } = useLoaderData<typeof loader>();

  useEffect(() => {
    setUserProfile(userProfile);

    logStore.logSystem('Application initialized (Client)', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      loaderAuthStatus: isAuthenticated,
      loaderUserProfile: userProfile
    });
  }, [theme, isAuthenticated, userProfile]);

  const isCallbackRoute = location.pathname === '/auth/callback';

  return (
    <Layout>
      {isCallbackRoute ? (
        <Outlet />
      ) : (
        isAuthenticated ? <Outlet /> : <AuthScreen />
      )}
    </Layout>
  );
}
