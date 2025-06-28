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

  // Debug logging for Wagmi state
  useEffect(() => {
    console.log("Wagmi state:", { address, isConnected, chainId });
  }, [address, isConnected, chainId]);

  // Check authentication status on mount and when wallet changes
  useEffect(() => {
    checkAuthStatus();
  }, [address, isConnected]);

  // Auto logout when wallet disconnects
  useEffect(() => {
    if (!isConnected && authState.isAuthenticated) {
      // Clear auth state when wallet disconnects
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [isConnected, authState.isAuthenticated]);

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // With httpOnly cookies, we don't check local tokens
      // Instead, we try to get user data from backend (cookies will be sent automatically)
      if (!address) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Try to get user data - if cookies are valid, this will work
      const userData: User = await WagmiAuthService.getUserByWallet(address);

      setAuthState({
        isAuthenticated: true,
        user: userData,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Auth check failed:", error);
      // If request fails, user is not authenticated
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null, // Don't show error for failed auth check
      });
    }
  }, [address]);

  const login = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error("Wallet not connected");
    }

    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Step 1: Get nonce from backend using service
      const nonce = await WagmiAuthService.generateNonce(address);

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

      console.log("SIWE message creation:", {
        domain,
        address,
        chainId,
        nonce,
      });

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
      console.log("Message to sign:", messageToSign);

      // Step 3: Sign the message with Wagmi
      const signature = await signMessageAsync({
        message: messageToSign,
      });

      // Step 4: Verify signature with backend using service
      const authResult: AuthResponse = await WagmiAuthService.verifySignature(
        messageToSign,
        signature,
        address
      );

      if (authResult.success && authResult.user) {
        // Backend handles auth token in httpOnly cookies automatically
        // No need to store tokens on frontend
        setAuthState({
          isAuthenticated: true,
          user: authResult.user,
          isLoading: false,
          error: null,
        });
      } else {
        throw new Error(authResult.message || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Login failed",
      }));
      throw error;
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  const logout = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      // Call logout endpoint using service (will clear httpOnly cookies)
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
      // With httpOnly cookies, we just re-check auth status
      await checkAuthStatus();
    } catch (error) {
      console.error("Auth refresh failed:", error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [checkAuthStatus]);

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
