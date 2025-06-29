"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAccount, useSignMessage, useChainId } from "wagmi";
import { SiweMessage } from "siwe";
import { User, WagmiAuthState, AuthResponse } from "../types/auth";
import { WagmiAuthService } from "../services/wagmiAuthService";
import { tokenManager } from "../app/lib/api";
import { socketService } from "../services/socketService";

interface AuthContextType extends WagmiAuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();

  const [authState, setAuthState] = useState<WagmiAuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  // Add a ref to track if login is in progress to prevent concurrent attempts
  const loginInProgress = React.useRef(false);
  // Add a ref to track previous authentication state to prevent loops
  const prevAuthState = React.useRef(false);

  // Check authentication status on mount and when wallet changes
  useEffect(() => {
    // Only check auth status if wallet is connected
    // This prevents the loop when user disconnects wallet
    if (isConnected && address) {
      checkAuthStatus();
    } else if (!isConnected) {
      // If wallet is disconnected, immediately clear auth state
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [address, isConnected]);

  // Auto logout when wallet disconnects - simplified
  useEffect(() => {
    if (!isConnected && prevAuthState.current) {
      // Clear auth state when wallet disconnects
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
      prevAuthState.current = false;
    }
  }, [isConnected]); // Removed authState.isAuthenticated from dependencies

  // Update the ref when auth state changes
  useEffect(() => {
    prevAuthState.current = authState.isAuthenticated;
  }, [authState.isAuthenticated]);

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check localStorage for valid token instead of making API calls
      if (!address) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Check if we have a valid token and user data in localStorage
      const isTokenValid = tokenManager.isTokenValid();
      const userData = tokenManager.getUser();

      if (isTokenValid && userData && userData.walletAddress === address) {
        // Token is valid and matches current wallet
        setAuthState({
          isAuthenticated: true,
          user: userData,
          isLoading: false,
          error: null,
        });
      } else {
        // No valid token or wallet mismatch - clear state
        tokenManager.removeToken();
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      // If anything fails, clear tokens and mark as unauthenticated
      tokenManager.removeToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [address]);

  const login = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error("Wallet not connected");
    }

    // Prevent concurrent login attempts
    if (loginInProgress.current) {
      return;
    }

    try {
      loginInProgress.current = true;
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Step 1: Get nonce from backend using service
      const nonce = await WagmiAuthService.generateNonce(address, chainId);

      // Step 2: Create SIWE message with validation
      const domain = window.location.host || "localhost:3001";
      const origin = window.location.origin || "http://localhost:3001";

      // Validate required fields
      if (!domain) {
        throw new Error("Domain is not available");
      }
      if (!address) {
        throw new Error("Wallet address is not available");
      }
      if (!chainId) {
        throw new Error("Chain ID is not available");
      }

      const siweMessage = new SiweMessage({
        domain: domain,
        address: address,
        statement: "Sign in to HeadBall Web3 Game",
        uri: origin,
        version: "1",
        chainId: chainId,
        nonce: nonce,
        issuedAt: new Date().toISOString(),
      });

      const messageToSign = siweMessage.prepareMessage();

      // Verify the nonce is correctly included in the message
      if (!messageToSign.includes(nonce)) {
        throw new Error(
          `Nonce mismatch: message doesn't contain expected nonce ${nonce}`
        );
      }

      // Step 3: Sign the message with Wagmi
      const signature = await signMessageAsync({
        message: messageToSign,
      });

      // Step 4: Verify signature with backend using service (this will store token automatically)
      const authResult: AuthResponse = await WagmiAuthService.verifySignature(
        messageToSign,
        signature,
        address
      );

      if (authResult.success && authResult.user) {
        // Token is automatically stored by WagmiAuthService.verifySignature
        setAuthState({
          isAuthenticated: true,
          user: authResult.user,
          isLoading: false,
          error: null,
        });

        // Connect to socket and emit join-game after successful authentication
        try {
          await socketService.connect();
          socketService.joinGame({
            userId: authResult.user.id,
            walletAddress: authResult.user.walletAddress,
            username: authResult.user.username,
          });
        } catch (socketError) {
          console.error("Socket connection failed:", socketError);
          // Don't throw here - authentication succeeded, socket is optional
        }
      } else {
        throw new Error(authResult.message || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Login failed:", error);

      // Check if the error is due to user cancellation/rejection
      const isUserCancellation =
        error?.code === 4001 || // MetaMask user rejection error code
        error?.code === "ACTION_REJECTED" ||
        error?.message?.toLowerCase().includes("user rejected") ||
        error?.message?.toLowerCase().includes("user denied") ||
        error?.message?.toLowerCase().includes("user cancelled") ||
        error?.message?.toLowerCase().includes("cancelled by user") ||
        error?.message?.toLowerCase().includes("signature denied") ||
        error?.message?.toLowerCase().includes("transaction rejected");

      if (isUserCancellation) {
        // If user cancelled, mark it as a cancellation instead of error
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: "CANCELLED_BY_USER", // Special error code for cancellation
        }));
        // Create a custom error to indicate user cancellation
        const cancellationError = new Error("User cancelled authentication");
        (cancellationError as any).code = "USER_CANCELLED";
        throw cancellationError;
      } else {
        // For other errors, keep the original behavior
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Login failed",
        }));
        throw error;
      }
    } finally {
      loginInProgress.current = false;
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  const logout = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      // Disconnect socket first
      socketService.disconnect();

      // Call logout service (will clear localStorage automatically)
      await WagmiAuthService.logout();

      // Clear local auth state
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Logout failed:", error);
      // Still clear local state even if backend call fails
      socketService.disconnect();
      tokenManager.removeToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      // For token-based auth, we can try to refresh the token
      const authResult = await WagmiAuthService.refreshAuth();

      if (authResult.success && authResult.user) {
        setAuthState({
          isAuthenticated: true,
          user: authResult.user,
          isLoading: false,
          error: null,
        });
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("Auth refresh failed:", error);
      // If refresh fails, clear everything
      tokenManager.removeToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
