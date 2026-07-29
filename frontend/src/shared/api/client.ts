type ApiOptions = RequestInit & { token?: string };

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Body JSON yang menyertai respons galat.
 *
 * Tiga field pertama benar-benar dipakai pemanggil untuk bercabang (panel
 * status akun & alur verifikasi email di LoginPage/OAuthCallbackPage), jadi
 * diketikkan eksplisit. Index signature-nya menampung sisa field yang
 * dikirim backend tanpa memaksa tipe ini ikut berubah setiap kali endpoint
 * baru menambah sesuatu — tetap `unknown`, jadi tak bisa dipakai sembarangan.
 */
export interface ApiErrorBody {
  message?: string;
  account_status?: string;
  requires_email_verification?: boolean;
  [key: string]: unknown;
}

/** Error API yang membawa status HTTP & body respons agar pemanggil bisa
 *  membedakan kasus (mis. 403 dengan account_status saat login). */
export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Ambil pesan yang layak ditampilkan dari nilai apa pun yang tertangkap `catch`.
 *
 * `catch` di TypeScript memberi `unknown` — bukan `Error` — karena JavaScript
 * memang bisa melempar apa saja. Pola lama `catch (err: any)` lalu `err.message`
 * menutupi itu: kalau yang terlempar ternyata string atau objek biasa,
 * `err.message` diam-diam `undefined` dan pengguna melihat pesan kosong.
 * Helper ini membuat kasus itu jatuh ke `fallback`, bukan ke ketiadaan.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (apiBase.startsWith("http")) {
    const base = new URL(apiBase);
    const origin = `${base.protocol}//${base.host}`;
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path.startsWith("/") ? path : `${apiBase}/${path}`;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("siperah-token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("siperah-token");
      window.dispatchEvent(new CustomEvent("siperah-auth-expired"));
      window.location.hash = "#/login";
    }

    let msg = `API ${response.status}: ${response.statusText}`;
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
      if (body?.message) msg = body.message;
    } catch {}

    if (response.status === 401) {
      msg = "Sesi Anda telah habis. Silakan login kembali.";
    }

    throw new ApiError(msg, response.status, body);
  }

  return response.json() as Promise<T>;
}

/**
 * Unduh berkas (export CSV) lewat jalur yang sama dengan `api()`.
 *
 * Sebelumnya blok ini disalin di 4 halaman dengan dua gaya URL berbeda
 * (`${apiBase}/...` vs `apiUrl('/api/...')`) sehingga path-nya bisa menyimpang,
 * dan semuanya melewati `fetch` mentah — artinya melewati juga penanganan 401
 * terpusat, jadi sesi kedaluwarsa hanya memunculkan "Export gagal (401)".
 *
 * @param path Path relatif tanpa prefiks `/api`, mis. `/admin/users/export`.
 * @param filename Nama berkas yang diunduh.
 * @param params Query opsional; entri kosong/undefined diabaikan.
 */
export async function downloadFile(
  path: string,
  filename: string,
  params: Record<string, string | number | undefined | null> = {},
): Promise<void> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.append(key, String(value));
  }

  const headers = new Headers({ Accept: "text/csv" });
  const token = localStorage.getItem("siperah-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBase}${path}${query.size ? `?${query}` : ""}`, { headers });

  if (!response.ok) {
    // Perlakuan 401 disamakan dengan api(): sesi dibersihkan & pengguna
    // diarahkan login, bukan sekadar melempar kode status.
    if (response.status === 401) {
      localStorage.removeItem("siperah-token");
      window.dispatchEvent(new CustomEvent("siperah-auth-expired"));
      window.location.hash = "#/login";
      throw new ApiError("Sesi Anda telah habis. Silakan login kembali.", 401, null);
    }
    throw new ApiError(`Export gagal (${response.status})`, response.status, null);
  }

  const url = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Selalu dilepas, termasuk bila klik/anchor gagal — kalau tidak,
    // blob-nya menggantung di memori sampai tab ditutup.
    URL.revokeObjectURL(url);
  }
}
