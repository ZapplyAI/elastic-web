declare module '@remix-run/react' {
  // Re-export the Link component to prevent conflicts
  export const Link: React.ForwardRefExoticComponent<
    React.AnchorHTMLAttributes<HTMLAnchorElement> & React.RefAttributes<HTMLAnchorElement>
  >;

  // Add other exports that are being used in the project
  export function useSearchParams(): [URLSearchParams, (searchParams: URLSearchParams) => void];
  export function useLocation(): { pathname: string; search: string; hash: string };
  export function useNavigate(): (to: string, options?: { replace?: boolean }) => void;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string>>(): T;
  export function useLoaderData<T = unknown>(): T;
  export function useSubmit(): (data: FormData | URLSearchParams | { [name: string]: string } | null, options?: { method?: string; action?: string; replace?: boolean }) => void;

  export const Links: React.ComponentType;
  export const Meta: React.ComponentType;
  export const Outlet: React.ComponentType;
  export const Scripts: React.ComponentType;
  export const ScrollRestoration: React.ComponentType;
  export const RemixBrowser: React.ComponentType;
  export const RemixServer: React.ComponentType<{ context: unknown; url: string }>;
}
