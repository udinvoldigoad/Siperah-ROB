import { api } from "../api/client";

/**
 * Satu-satunya pintu baca/tulis sesi di localStorage.
 *
 * Sebelumnya blok `try { JSON.parse(localStorage.getItem("saibar-user")) }
 * catch {}` disalin di 9 file, masing-masing dengan bentuk tipe sendiri dan
 * pengecekan "sudah login" yang tidak seragam. Selain berulang, itu berarti
 * satu perubahan bentuk sesi harus dikejar ke sembilan tempat.
 *
 * PENTING â€” localStorage adalah CACHE, bukan sumber kebenaran. Isinya bisa
 * diubah siapa pun lewat DevTools. Otorisasi yang sesungguhnya ada di server:
 * `EnsureRole` membaca peran dari token Sanctum â†’ database, jadi peran palsu
 * di sini tidak pernah membuka satu endpoint pun. Yang dicegah `verifySession()`
 * adalah UI ikut mempercayai nilai palsu itu lalu menampilkan menu/halaman yang
 * sebenarnya tak boleh dilihat.
 */

const TOKEN_KEY = "saibar-token";
const USER_KEY = "saibar-user";

/** Dipancarkan tiap sesi berubah agar komponen yang sudah ter-mount ikut menyegarkan diri. */
export const SESSION_CHANGED_EVENT = "SAIBAR-session-changed";

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
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

/**
 * Tanyakan identitas asli ke server dan TIMPA cache lokal dengan jawabannya.
 *
 * Tanpa ini, mengubah `saibar-user.role` jadi "admin" di DevTools membuat UI
 * menampilkan menu & halaman admin (isinya tetap gagal 403, tapi tampilannya
 * menyesatkan dan membocorkan struktur halaman internal). Setelah ini, peran
 * yang dipakai UI selalu berasal dari `/auth/me`.
 *
 * Batas yang jujur: ini TIDAK membuat pengubahan mustahil â€” siapa pun bisa
 * memblokir request `/auth/me` dari DevTools dan menahan cache palsunya.
 * Satu-satunya penjaga sesungguhnya tetap otorisasi server.
 */
export async function verifySession(): Promise<SessionUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await api<{ data: SessionUser }>("/auth/me");
    setSession(token, response.data);
    return response.data;
  } catch {
    // 401 sudah dibersihkan & dialihkan oleh api(). Sisanya (mis. jaringan
    // putus) sengaja mempertahankan cache supaya pengguna sah tidak terlempar
    // keluar hanya karena koneksi sedang buruk.
    return getCurrentUser();
  }
}

