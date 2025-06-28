// API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

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

// API Client helper functions
export const apiClient = {
  get: async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include", // Include cookies for auth
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
        ...options?.headers,
      },
      credentials: "include", // Include cookies for auth
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
        ...options?.headers,
      },
      credentials: "include",
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
        ...options?.headers,
      },
      credentials: "include",
      ...options,
    });
    return response;
  },
};
