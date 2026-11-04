/**
 * Resolve a path under `public/` against Vite's `base`.
 * Needed for GitHub Pages project sites (e.g. `/Robot-Wars/`).
 * Falls back to `/` outside Vite (Node scripts such as `npm run art:sheet`).
 */
export function publicUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const base = (import.meta.env as ImportMetaEnv | undefined)?.BASE_URL ?? '/';
  return `${base}${normalized}`;
}
