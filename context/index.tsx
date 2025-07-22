"use client";

import { wagmiAdapter, projectId } from "../config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { avalancheFuji, sepolia } from "@reown/appkit/networks";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";
import { AuthProvider } from "../src/contexts/AuthContext";

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
  console.warn(
    "Project ID is not defined. Please set NEXT_PUBLIC_PROJECT_ID in .env.local"
  );
  console.warn("Get your project ID from https://cloud.reown.com");
}

// Set up metadata
const metadata = {
  name: "HeadBall Web3",
  description: "HeadBall Web3 Game",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://headball.game",
  icons: ["/logo.png"],
};

// Create the modal - MetaMask focused
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [avalancheFuji, sepolia],
    defaultNetwork: avalancheFuji,
    metadata: metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,

    },
    // MetaMask-only configuration
    featuredWalletIds: [
      "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
    ],
    themeMode: "light",
    themeVariables: {
      "--w3m-font-family": "monospace",
      "--w3m-border-radius-master": "4px",
    },
  });
}

function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig, cookies);

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
