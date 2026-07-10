type ApiOptions = RequestInit & { token?: string };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
