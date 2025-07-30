import { API_ENDPOINTS, apiClient, tokenManager } from "../app/lib/api";
import { logger } from "../app/lib/logger";
import {
  NonceResponse,
  AuthResponse,
  VerifyRequest,
  User,
} from "../types/auth";

/**
 * Enhanced Wagmi-optimized SIWE Authentication Service
 * Provides robust authentication with improved error handling, security, and performance
 */
export class WagmiAuthService {
  private static isAuthenticating = false;
  private static authPromise: Promise<string> | null = null;
  
  // Rate limiting for security
  private static lastNonceRequest = 0;
  private static nonceRequestCount = 0;
  private static readonly NONCE_RATE_LIMIT = 5; // Max 5 requests per minute
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  /**
   * Generate nonce for SIWE message with rate limiting and enhanced security
   * @param walletAddress - The connected wallet address
   * @param chainId - The chain ID (defaults to Avalanche Fuji)
   * @returns Promise<string> - The nonce string
   */
  static async generateNonce(walletAddress: string, chainId: number = 43113): Promise<string> {
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - this.lastNonceRequest < this.RATE_LIMIT_WINDOW) {
        if (this.nonceRequestCount >= this.NONCE_RATE_LIMIT) {
          logger.warn("Nonce generation rate limit exceeded", {
            address: walletAddress,
            count: this.nonceRequestCount,
          });
          throw new Error("Rate limit exceeded. Please wait before requesting another nonce.");
        }
      } else {
        // Reset rate limit counter after window
        this.nonceRequestCount = 0;
      }

      this.lastNonceRequest = now;
      this.nonceRequestCount++;

      // Validate inputs
      if (!walletAddress || !this.isValidEthereumAddress(walletAddress)) {
        throw new Error("Invalid wallet address provided");
      }

      if (!this.isValidChainId(chainId)) {
        throw new Error("Invalid chain ID provided");
      }

      logger.auth("Generating nonce", { 
        address: this.maskAddress(walletAddress), 
        chainId,
        requestCount: this.nonceRequestCount 
      });

      // Get domain and origin securely
      const domain = this.getCurrentDomain();
      const origin = this.getCurrentOrigin();

      // Prepare request data with additional security fields
      const requestData = {
        domain: domain,
        address: walletAddress,
        uri: origin,
        version: "1",
        chainId: chainId,
        statement: "Sign in to HeadBall Web3 Game",
        issuedAt: new Date().toISOString(),
        // Add security context
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: now,
      };

      logger.auth("Sending nonce request", { 
        domain, 
        chainId, 
        addressMasked: this.maskAddress(walletAddress) 
      });

      // Use enhanced API client with retry logic
      const response = await apiClient.postNoAuth(
        API_ENDPOINTS.auth.nonce,
        requestData
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Nonce generation failed", {
          status: response.status,
          error: errorText,
          address: this.maskAddress(walletAddress),
        });
        throw new Error(
          `Failed to get nonce: ${response.status} - ${errorText}`
        );
      }

      // Backend returns nonce as plain text
      const nonce = await response.text();

      if (!nonce || !this.isValidNonce(nonce)) {
        logger.error("Invalid nonce received from server", { 
          nonceLength: nonce?.length || 0 
        });
        throw new Error("Invalid nonce response from server");
      }

      logger.auth("Nonce generated successfully", { 
        nonceLength: nonce.length,
        address: this.maskAddress(walletAddress) 
      });

      return nonce;
    } catch (error) {
      logger.error("Nonce generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        address: this.maskAddress(walletAddress),
        chainId,
      });
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw error; // Re-throw rate limit errors as-is
        }
        if (error.message.includes('fetch')) {
          throw new Error("Network error. Please check your connection and try again.");
        }
      }
      
      throw new Error(
        `Authentication service unavailable: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Alternative nonce generation using simple GET
   * @param walletAddress - The connected wallet address
   * @returns Promise<string> - The nonce string
   */
  static async generateNonceSimple(walletAddress: string): Promise<string> {
    try {
      logger.auth("Generating nonce (simple method)", { 
        address: this.maskAddress(walletAddress) 
      });

      const response = await apiClient.getSimple(API_ENDPOINTS.auth.nonce);

      if (!response.ok) {
        logger.error("Simple nonce generation failed", {
          status: response.status,
          address: this.maskAddress(walletAddress),
        });
        throw new Error(`Failed to get nonce: ${response.status}`);
      }

      const data: NonceResponse = await response.json();

      if (!data.success || !data.nonce || !this.isValidNonce(data.nonce)) {
        logger.error("Invalid simple nonce response", { 
          success: data.success,
          nonceLength: data.nonce?.length || 0 
        });
        throw new Error("Invalid nonce response from server");
      }

      logger.auth("Simple nonce generated successfully", { 
        nonceLength: data.nonce.length 
      });

      return data.nonce;
    } catch (error) {
      logger.error("Simple nonce generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        address: this.maskAddress(walletAddress),
      });
      throw new Error(
        `Nonce generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Verify SIWE message and authenticate user with enhanced security
   * @param verifyRequest - The verification request containing message and signature
   * @returns Promise<AuthResponse> - The authentication response
   */
  static async verifyMessage(verifyRequest: VerifyRequest): Promise<AuthResponse> {
    // Prevent concurrent authentication attempts
    if (this.isAuthenticating) {
      if (this.authPromise) {
        logger.auth("Authentication already in progress, waiting for completion");
        return this.authPromise as Promise<AuthResponse>;
      }
    }

    this.isAuthenticating = true;

    try {
      this.authPromise = this._performVerification(verifyRequest);
      const result = await this.authPromise;
      
      logger.auth("Authentication completed successfully", {
        userId: result.user?.id,
        address: this.maskAddress(result.user?.walletAddress || ''),
      });
      
      return result;
    } finally {
      this.isAuthenticating = false;
      this.authPromise = null;
    }
  }

  private static async _performVerification(verifyRequest: VerifyRequest): Promise<AuthResponse> {
    try {
      // Validate the verification request
      this.validateVerifyRequest(verifyRequest);

      logger.auth("Starting message verification", {
        messageLength: verifyRequest.message?.length || 0,
        signatureLength: verifyRequest.signature?.length || 0,
      });

      // Add security context to the request
      const enhancedRequest = {
        ...verifyRequest,
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        origin: this.getCurrentOrigin(),
      };

      const response = await apiClient.postNoAuth(
        API_ENDPOINTS.auth.verify,
        enhancedRequest
      );

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        logger.error("Message verification failed", {
          status: response.status,
          error: errorData,
        });
        
        // Provide specific error messages based on status
        if (response.status === 401) {
          throw new Error("Invalid signature or message. Please try signing again.");
        } else if (response.status === 429) {
          throw new Error("Too many authentication attempts. Please wait and try again.");
        } else if (response.status >= 500) {
          throw new Error("Authentication service temporarily unavailable. Please try again later.");
        }
        
        throw new Error(`Authentication failed: ${errorData.message || 'Unknown error'}`);
      }

      const authResponse: AuthResponse = await response.json();

      // Validate the response
      this.validateAuthResponse(authResponse);

      // Store authentication data securely
      if (authResponse.token) {
        tokenManager.setToken(authResponse.token);
        logger.auth("Authentication token stored successfully");
      }

      if (authResponse.user) {
        tokenManager.setUser(authResponse.user);
        logger.auth("User data stored successfully", {
          userId: authResponse.user.id,
          address: this.maskAddress(authResponse.user.walletAddress),
        });
      }

      return authResponse;
    } catch (error) {
      logger.error("Message verification error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof Error) {
        throw error; // Re-throw known errors
      }
      
      throw new Error("Authentication verification failed");
    }
  }

  /**
   * Enhanced logout with proper cleanup
   * @returns Promise<boolean> - Success status
   */
  static async logout(): Promise<boolean> {
    try {
      logger.auth("Starting logout process");

      // Call logout endpoint if authenticated
      const token = tokenManager.getToken();
      if (token && tokenManager.isTokenValid()) {
        try {
          const response = await apiClient.post(API_ENDPOINTS.auth.logout);
          if (!response.ok) {
            logger.warn("Server logout failed, proceeding with local logout", {
              status: response.status,
            });
          } else {
            logger.auth("Server logout successful");
          }
        } catch (error) {
          logger.warn("Server logout error, proceeding with local logout", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Clear local storage
      tokenManager.removeToken();
      
      // Clear any auth-related data from session storage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('authNonce');
          sessionStorage.removeItem('authTimestamp');
        } catch (error) {
          logger.warn("Failed to clear session storage", { error });
        }
      }

      logger.auth("Logout completed successfully");
      return true;
    } catch (error) {
      logger.error("Logout error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      
      // Even if server logout fails, clear local data
      tokenManager.removeToken();
      return false;
    }
  }

  /**
   * Check current authentication status
   * @returns Promise<User | null> - Current user or null if not authenticated
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = tokenManager.getToken();
      if (!token || !tokenManager.isTokenValid()) {
        logger.auth("No valid token found");
        return null;
      }

      const user = tokenManager.getUser();
      if (!user) {
        logger.auth("No user data found in storage");
        return null;
      }

      // Optionally verify with server
      try {
        const response = await apiClient.get(API_ENDPOINTS.users.getProfile(user.id));
        if (response.ok) {
          const updatedUser = await response.json();
          tokenManager.setUser(updatedUser);
          return updatedUser;
        }
      } catch (error) {
        logger.warn("Failed to verify user with server", { error });
        // Return cached user data if server verification fails
      }

      return user;
    } catch (error) {
      logger.error("Get current user error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Refresh authentication token
   * @returns Promise<boolean> - Success status
   */
  static async refreshAuth(): Promise<boolean> {
    try {
      logger.auth("Refreshing authentication");
      return await tokenManager.refreshToken();
    } catch (error) {
      logger.error("Auth refresh error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  // Private utility methods for validation and security

  private static isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private static isValidChainId(chainId: number): boolean {
    return Number.isInteger(chainId) && chainId > 0 && chainId < 2147483647;
  }

  private static isValidNonce(nonce: string): boolean {
    return typeof nonce === 'string' && nonce.length >= 8 && nonce.length <= 64;
  }

  private static maskAddress(address: string): string {
    if (!address || address.length < 10) return 'invalid';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private static getCurrentDomain(): string {
    if (typeof window === "undefined") return "localhost:3001";
    return window.location.host || "localhost:3001";
  }

  private static getCurrentOrigin(): string {
    if (typeof window === "undefined") return "http://localhost:3001";
    return window.location.origin || "http://localhost:3001";
  }

  private static validateVerifyRequest(request: VerifyRequest): void {
    if (!request.message) {
      throw new Error("Message is required for verification");
    }
    if (!request.signature) {
      throw new Error("Signature is required for verification");
    }
    if (typeof request.message !== 'string' || typeof request.signature !== 'string') {
      throw new Error("Message and signature must be strings");
    }
    if (request.message.length > 10000) {
      throw new Error("Message too long");
    }
    if (request.signature.length > 1000) {
      throw new Error("Signature too long");
    }
  }

  private static validateAuthResponse(response: AuthResponse): void {
    if (!response.success) {
      throw new Error(response.message || "Authentication failed");
    }
    if (!response.token) {
      throw new Error("No authentication token received");
    }
    if (!response.user || !response.user.id) {
      throw new Error("Invalid user data received");
    }
  }

  private static async parseErrorResponse(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return { message: text };
      }
    } catch (error) {
      return { message: `HTTP ${response.status} ${response.statusText}` };
    }
  }

  /**
   * Get authentication health status
   * @returns Object with authentication status information
   */
  static getAuthStatus(): {
    isAuthenticated: boolean;
    hasValidToken: boolean;
    user: User | null;
    tokenExpiry: number | null;
  } {
    const token = tokenManager.getToken();
    const isValidToken = token ? tokenManager.isTokenValid() : false;
    const user = tokenManager.getUser();
    
    let tokenExpiry = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        tokenExpiry = payload.exp * 1000; // Convert to milliseconds
      } catch (error) {
        logger.warn("Failed to parse token expiry", { error });
      }
    }

    return {
      isAuthenticated: isValidToken && !!user,
      hasValidToken: isValidToken,
      user,
      tokenExpiry,
    };
  }
}
