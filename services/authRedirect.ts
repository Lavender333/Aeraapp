/** Email links must open a public website, never capacitor://localhost. */
export function getAuthRedirectUrl(path = '/', origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  const webOrigin = /^https?:\/\//i.test(origin) ? origin : 'https://getaeraapp.com';
  return new URL(path, webOrigin).toString();
}
