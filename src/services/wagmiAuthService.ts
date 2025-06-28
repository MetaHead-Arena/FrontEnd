import { API_ENDPOINTS, apiClient } from "../app/lib/api";
import {
  NonceResponse,
  AuthResponse,
  VerifyRequest,
  User,
} from "../types/auth";

/**
 * Wagmi-optimized SIWE Authentication Service
 * Provides clean API layer for authentication operations
 */
export class WagmiAuthService {
  /**
   * Generate nonce for SIWE message
   * @param walletAddress - The connected wallet address
   * @returns Promise<string> - The nonce string
   */
  static async generateNonce(walletAddress: string): Promise<string> {
    try {
      // Get domain and origin for the nonce request
      const domain =
        typeof window !== "undefined"
          ? window.location.host || "localhost:3001"
          : "localhost:3001";

      const origin =
        typeof window !== "undefined"
          ? window.location.origin || "http://localhost:3001"
          : "http://localhost:3001";

      // Send the fields that the backend expects (without nonce - backend will generate it)
      const requestData = {
        domain: domain,
        address: walletAddress,
        uri: origin,
        version: "1",
        chainId: 43113, // Avalanche Fuji - update if needed
        statement: "Sign in to HeadBall Web3 Game",
        issuedAt: new Date().toISOString(),
        // Note: No nonce field - backend will generate it
      };

      console.log("Nonce request data:", requestData);

      // Use POST for nonce generation (most common SIWE pattern)
      const response = await apiClient.post(
        API_ENDPOINTS.auth.nonce,
        requestData
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Nonce request failed:", errorText);
        throw new Error(
          `Failed to get nonce: ${response.status} - ${errorText}`
        );
      }

      // Backend returns nonce as plain text according to your code
      const nonce = await response.text();

      if (!nonce) {
        throw new Error("Invalid nonce response from server");
      }

      console.log("Received nonce:", nonce);
      return nonce;
    } catch (error) {
      console.error("Nonce generation failed:", error);
      throw new Error(
        `Nonce generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Alternative: Generate nonce using simple GET (no CORS preflight)
   * Use this if your backend expects GET and you want to avoid OPTIONS preflight
   */
  static async generateNonceSimple(walletAddress: string): Promise<string> {
    try {
      // Use simple GET without CORS-triggering headers
      const response = await apiClient.getSimple(API_ENDPOINTS.auth.nonce);

      if (!response.ok) {
        throw new Error(`Failed to get nonce: ${response.status}`);
      }

      const { nonce, success }: NonceResponse = await response.json();

      if (!success || !nonce) {
        throw new Error("Invalid nonce response from server");
      }

      return nonce;
    } catch (error) {
      console.error("Nonce generation failed:", error);
      throw new Error(
        `Nonce generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Verify SIWE signature with backend
   * @param message - The SIWE message that was signed
   * @param signature - The signature from wallet
   * @param walletAddress - The wallet address that signed
   * @returns Promise<AuthResponse> - Authentication result with user data
   */
  static async verifySignature(
    message: string,
    signature: string,
    walletAddress: string
  ): Promise<AuthResponse> {
    try {
      // Backend expects just message and signature
      const verifyData = {
        message,
        signature,
      };

      console.log("Verify request data:", verifyData);

      const response = await apiClient.post(
        API_ENDPOINTS.auth.verify,
        verifyData
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Verification failed: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Verify response:", result);

      // Transform backend response to match frontend AuthResponse interface
      const authResult: AuthResponse = {
        success: result.success,
        user: result.data?.user
          ? {
              id: result.data.user.id,
              walletAddress: result.data.user.walletAddress,
              username: result.data.user.username,
              profileImage: result.data.user.profileImage,
              gameStats: result.data.user.gameStats,
              createdAt: result.data.user.createdAt || new Date().toISOString(),
              updatedAt: result.data.user.updatedAt || new Date().toISOString(),
            }
          : undefined,
        message: result.message,
        token: undefined, // Backend uses httpOnly cookies, no token in response
      };

      if (!authResult.success) {
        throw new Error(
          authResult.message || "Authentication verification failed"
        );
      }

      return authResult;
    } catch (error) {
      console.error("Signature verification failed:", error);
      throw error;
    }
  }

  /**
   * Logout user and invalidate session
   * @returns Promise<void>
   */
  static async logout(): Promise<void> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.auth.logout);

      // Don't throw on logout errors - always clear local state
      if (!response.ok) {
        console.warn(
          "Logout endpoint failed, but continuing with local cleanup"
        );
      }
    } catch (error) {
      console.warn("Logout request failed:", error);
      // Don't throw - logout should always succeed locally
    }
  }

  /**
   * Get current user profile by user ID
   * @param userId - The user ID
   * @returns Promise<User> - User profile data
   */
  static async getCurrentUser(userId: string): Promise<User> {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.users.getProfile(userId)
      );

      if (!response.ok) {
        throw new Error(`Failed to get user profile: ${response.status}`);
      }

      const userData: User = await response.json();
      return userData;
    } catch (error) {
      console.error("Get user failed:", error);
      throw new Error(
        `Failed to get user profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get user by wallet address
   * @param walletAddress - The wallet address
   * @returns Promise<User> - User profile data
   */
  static async getUserByWallet(walletAddress: string): Promise<User> {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.users.getByWallet(walletAddress)
      );

      if (!response.ok) {
        throw new Error(`Failed to get user by wallet: ${response.status}`);
      }

      const userData: User = await response.json();
      return userData;
    } catch (error) {
      console.error("Get user by wallet failed:", error);
      throw new Error(
        `Failed to get user by wallet: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Refresh authentication token
   * @returns Promise<AuthResponse> - Refreshed authentication result
   */
  static async refreshAuth(): Promise<AuthResponse> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.auth.refresh);

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const authResult: AuthResponse = await response.json();

      if (!authResult.success) {
        throw new Error(authResult.message || "Token refresh failed");
      }

      return authResult;
    } catch (error) {
      console.error("Token refresh failed:", error);
      throw error;
    }
  }
}

// Export individual functions for convenience
export const {
  generateNonce,
  generateNonceSimple,
  verifySignature,
  logout,
  getCurrentUser,
  getUserByWallet,
  refreshAuth,
} = WagmiAuthService;
