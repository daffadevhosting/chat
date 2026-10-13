export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://daffa-ai.mvstream.workers.dev";

export interface AuthUser {
  username?: string;
  email?: string;
  githubAvatar?: string;
}

export async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Permintaan gagal (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
