export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function savePreference(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export type AgeStatus = 'UNKNOWN' | 'MINOR' | 'ADULT';

export function getAgeStatus(): AgeStatus {
  const cookie = getCookie('nox-age-status');
  if (cookie === 'MINOR' || cookie === 'ADULT') return cookie;
  const local = readPreference('nox-age-status');
  if (local === 'MINOR' || local === 'ADULT') return local;
  return 'UNKNOWN';
}

export function setAgeStatus(status: 'MINOR' | 'ADULT'): void {
  setCookie('nox-age-status', status);
  savePreference('nox-age-status', status);
}

export function getBlurNsfw(): boolean {
  const cookie = getCookie('nox-blur-nsfw');
  if (cookie !== null) return cookie !== 'false';
  const local = readPreference('nox-blur-nsfw');
  if (local !== null) return local !== 'false';
  return true; // Default: ALWAYS blur +18 covers
}

export function setBlurNsfw(blur: boolean): void {
  setCookie('nox-blur-nsfw', String(blur));
  savePreference('nox-blur-nsfw', String(blur));
}
