export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('zabava_csrf='));
  return m ? decodeURIComponent(m.split('=')[1]) : '';
}
