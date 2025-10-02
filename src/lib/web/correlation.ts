export function getCorrelationId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const KEY = 'zabava_corr_id';
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 0) return existing;
    const id = `corr-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Fallback to a volatile ID
    return `corr-${Math.random().toString(36).slice(2, 10)}`;
  }
}
