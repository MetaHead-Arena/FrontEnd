import React, { useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/shared/Button";
import { useAuth } from "@/contexts/AuthContext";

// Custom button component
const CustomConnectButton: React.FC = () => {
  const { open } = useAppKit();
  const { isConnected, address } = useAccount();
  const { isAuthenticated, login, logout, isLoading, error } = useAuth();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if we have project ID configured
  const hasProjectId =
    process.env.NEXT_PUBLIC_PROJECT_ID &&
    process.env.NEXT_PUBLIC_PROJECT_ID !== "your_project_id_here";

  // Reset connecting state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setIsConnecting(false);
    }
  }, [isConnected]);

  // Auto-trigger SIWE authentication when wallet connects
  useEffect(() => {
    const handleAutoAuth = async () => {
      if (
        isConnected &&
        !isAuthenticated &&
        !isLoading &&
        address &&
        !isConnecting
      ) {
        try {
          setIsConnecting(true);
          console.log("Auto-triggering SIWE authentication...");
          await login();
        } catch (error) {
          console.error("Auto-authentication failed:", error);
        } finally {
          setIsConnecting(false);
        }
      }
    };

    // Small delay to ensure wallet connection is fully established
    const timer = setTimeout(handleAutoAuth, 500);
    return () => clearTimeout(timer);
  }, [isConnected, isAuthenticated, isLoading, address, login, isConnecting]);

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);

      if (hasProjectId) {
        // Use AppKit if project ID is configured
        await open();
      } else {
        // Fallback: Direct MetaMask connection
        const metamaskConnector = connectors.find(
          (connector) =>
            connector.name.toLowerCase().includes("metamask") ||
            connector.id === "metaMask"
        );

        if (metamaskConnector) {
          connect({ connector: metamaskConnector });
        } else {
          // If no MetaMask connector, try injected
          const injectedConnector = connectors.find(
            (connector) => connector.id === "injected"
          );
          if (injectedConnector) {
            connect({ connector: injectedConnector });
          }
        }
      }
      // Note: SIWE authentication will be triggered automatically by useEffect
    } catch (error) {
      console.error("Connection error:", error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnecting(true); // Show loading state during disconnect
      console.log("Starting disconnect process...");

      // First, logout from backend (clear cookies)
      if (isAuthenticated) {
        console.log("Calling logout to clear backend session...");
        await logout();
      }

      // Then disconnect wallet
      console.log("Disconnecting wallet...");
      if (hasProjectId) {
        await open({ view: "Account" });
      } else {
        disconnect();
      }

      console.log("Disconnect process completed");
    } catch (error) {
      console.error("Disconnect error:", error);
      // Force disconnect even if logout fails
      disconnect();
    } finally {
      setIsConnecting(false);
    }
  };

  // Loading state - connecting or authenticating
  if (isConnecting || (isConnected && !isAuthenticated && isLoading)) {
    return (
      <div className="flex items-center w-full">
        <Button
          variant="customBlue"
          size="sm"
          disabled={true}
          className="connect-button"
        >
          {isConnected ? "Authenticating..." : "Connecting..."}
        </Button>
      </div>
    );
  }

  // Show connect wallet button if not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {error && <div className="text-xs text-red-600 px-2">{error}</div>}
        <Button
          onClick={handleConnectWallet}
          variant="customBlue"
          size="sm"
          className="connect-button"
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  // Show authenticated state with disconnect option
  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center w-full">
        <Button
          onClick={handleDisconnect}
          variant="destructive"
          size="sm"
          className="disconnect-button w-full"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Connected but authentication failed - show error and disconnect
  if (isConnected && !isAuthenticated && error) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="text-xs text-red-600 px-2">
          Authentication failed. Please disconnect and try again.
        </div>
        <Button
          onClick={handleDisconnect}
          variant="destructive"
          size="sm"
          className="disconnect-button"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return null;
};

export default CustomConnectButton;
