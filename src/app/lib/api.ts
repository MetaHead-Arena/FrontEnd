import { logger } from './logger';

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
  // Game endpoints
  game: {
    stats: (userId: string) => `${API_BASE_URL}/api/game/stats/${userId}`,
    updateStats: (userId: string) => `${API_BASE_URL}/api/game/stats/${userId}`,
    leaderboard: `${API_BASE_URL}/api/game/leaderboard`,
  },
} as const;

// Enhanced token management with refresh logic
export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
  },

  setToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem("authToken", token);
    logger.auth("Token updated successfully");
  },

  removeToken: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    logger.auth("Token and user data cleared");
  },

  getUser: () => {
    if (typeof window === "undefined") return null;
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      logger.error("Failed to parse user data from localStorage", error);
      return null;
    }
  },

  setUser: (user: any): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("user", JSON.stringify(user));
      logger.auth("User data saved successfully");
    } catch (error) {
      logger.error("Failed to save user data to localStorage", error);
    }
  },

  isTokenValid: (): boolean => {
    const token = tokenManager.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      return !isExpired;
    } catch (error) {
      logger.warn("Failed to validate token", error);
      return false;
    }
  },

  getAuthHeaders: (): Record<string, string> => {
    const token = tokenManager.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  // New: Automatic token refresh
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(API_ENDPOINTS.auth.refresh, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tokenManager.getAuthHeaders(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          tokenManager.setToken(data.token);
          if (data.user) {
            tokenManager.setUser(data.user);
          }
          logger.auth("Token refreshed successfully");
          return true;
        }
      }
      
      logger.warn("Token refresh failed");
      return false;
    } catch (error) {
      logger.error("Token refresh error", error);
      return false;
    }
  },
};

// Enhanced API client with retry logic and better error handling
class ApiClient {
  private async makeRequest(
    url: string,
    options: RequestInit,
    retries: number = 3
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          timeout: 30000, // 30 second timeout
        });

        // Handle 401 errors with automatic token refresh
        if (response.status === 401 && i === 0) {
          const refreshed = await tokenManager.refreshToken();
          if (refreshed) {
            // Retry with new token
            const newHeaders = {
              ...options.headers,
              ...tokenManager.getAuthHeaders(),
            };
            continue;
          }
        }

        // Log non-2xx responses
        if (!response.ok) {
          logger.warn(`API request failed: ${response.status} ${response.statusText}`, {
            url,
            status: response.status,
            statusText: response.statusText,
          });
        }

        return response;
      } catch (error) {
        logger.error(`API request error (attempt ${i + 1}/${retries})`, {
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (i === retries - 1) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }

    throw new Error("Maximum retries exceeded");
  }

  async get(url: string, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(),
        ...options?.headers,
      },
      ...options,
    });
  }

  async getSimple(url: string, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "GET",
      ...options,
    });
  }

  async post(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async put(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async delete(url: string, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...tokenManager.getAuthHeaders(),
        ...options?.headers,
      },
      ...options,
    });
  }

  async postNoAuth(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.makeRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }
}

export const apiClient = new ApiClient();
