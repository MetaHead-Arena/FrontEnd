// API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication endpoints
  auth: {
    nonce: `${API_BASE_URL}/api/auth/nonce`,
    verify: `${API_BASE_URL}/api/auth/verify`,
    logout: `${API_BASE_URL}/api/auth/logout`,
    refresh: `${API_BASE_URL}/api/auth/refresh`,
  },
  // User endpoints
  users: {
    getByWallet: (address: string) =>
      `${API_BASE_URL}/api/users/wallet/${address}`,
    getProfile: (id: string) => `${API_BASE_URL}/api/users/profile/${id}`,
    updateProfile: (id: string) => `${API_BASE_URL}/api/users/profile/${id}`,
  },
  // Game endpoints (for future use)
  game: {
    stats: (userId: string) => `${API_BASE_URL}/api/game/stats/${userId}`,
    updateStats: (userId: string) => `${API_BASE_URL}/api/game/stats/${userId}`,
  },
} as const;

// Token management utilities
export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
  },

  setToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem("authToken", token);
  },

  removeToken: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  },

  getUser: () => {
    if (typeof window === "undefined") return null;
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser: (user: any): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem("user", JSON.stringify(user));
  },

  isTokenValid: (): boolean => {
    const token = tokenManager.getToken();
    if (!token) return false;

    try {
      // Basic JWT validation - decode payload and check expiry
      const payload = JSON.parse(atob(token.split(".")[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      return !isExpired;
    } catch {
      return false;
    }
  },

  getAuthHeaders: (): Record<string, string> => {
    const token = tokenManager.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

// API Client helper functions
export const apiClient = {
  get: async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(), // Add Authorization header
        ...options?.headers,
      },
      ...options,
    });
    return response;
  },

  // Simple GET without CORS-triggering headers (for nonce)
  getSimple: async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "GET",
      // No Content-Type header to avoid preflight
      ...options,
    });
    return response;
  },

  post: async (url: string, data?: any, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(), // Add Authorization header
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return response;
  },

  put: async (url: string, data?: any, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(), // Add Authorization header
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return response;
  },

  delete: async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(), // Add Authorization header
        ...options?.headers,
      },
      ...options,
    });
    return response;
  },

  // Special method for auth endpoints that don't need tokens
  postNoAuth: async (url: string, data?: any, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    return response;
  },
};
