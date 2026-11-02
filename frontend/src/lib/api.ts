
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiError {
  success?: boolean;
  message?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data as ApiError | null;

    throw new ApiRequestError(
      error?.message || "Something went wrong. Please try again.",
      response.status
    );
  }

  return data as T;
}


export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface AuthResponse {
  success: boolean;
  data: AuthUser;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>("/api/auth/me");
  return response.data;
}

export async function logoutUser(): Promise<void> {
  await apiRequest("/api/auth/logout", {
    method: "POST",
  });
}

