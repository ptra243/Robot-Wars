/**
 * Resolve a path under `public/` against Vite's `base`.
 * Needed for GitHub Pages project sites (e.g. `/Robot-Wars/`).
 */
export function publicUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${normalized}`;
}
