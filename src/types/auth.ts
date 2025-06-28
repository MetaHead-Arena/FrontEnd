export interface User {
  id: string;
  walletAddress: string;
  gameStats?: {
    level: number;
    experience: number;
    gamesPlayed: number;
    gamesWon: number;
    totalCoins: number;
  };
  profileImage?: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiweConfig {
  domain: string;
  uri: string;
  statement?: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
  token?: string;
  error?: string;
}

export interface WagmiAuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface NonceResponse {
  nonce: string;
  success: boolean;
  error?: string;
}

export interface VerifyRequest {
  message: string;
  signature: string;
  walletAddress: string;
}
