/**
 * Satu-satunya pintu baca/tulis sesi di localStorage.
 *
 * Sebelumnya blok `try { JSON.parse(localStorage.getItem("siperah-user")) }
 * catch {}` disalin di 9 file, masing-masing dengan bentuk tipe sendiri dan
 * pengecekan "sudah login" yang tidak seragam. Selain berulang, itu berarti
 * satu perubahan bentuk sesi harus dikejar ke sembilan tempat.
 */

const TOKEN_KEY = "siperah-token";
const USER_KEY = "siperah-user";

export interface SessionUser {
  id?: string;
  name: string;
  email?: string;
  role: string;
  status?: string;
  region_id?: string | null;
  region_name?: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Pengguna tersimpan, atau null bila belum login / datanya rusak. */
export function getCurrentUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser | null;
    // JSON valid tapi bukan objek pengguna (mis. sisa data versi lama).
    return parsed && typeof parsed === "object" && typeof parsed.role === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Login = punya token DAN data pengguna yang bisa dibaca. */
export function isLoggedIn(): boolean {
  return !!getToken() && !!getCurrentUser();
}

export function setSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
