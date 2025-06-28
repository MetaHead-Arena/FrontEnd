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
  const [hasExplicitlyDisconnected, setHasExplicitlyDisconnected] =
    useState(false);

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

  // Reset explicit disconnect flag when wallet connects for the first time
  useEffect(() => {
    if (isConnected && hasExplicitlyDisconnected) {
      // Only reset the flag if user manually reconnects
      // This prevents auto-auth after explicit disconnect
      setHasExplicitlyDisconnected(false);
    }
  }, [isConnected, hasExplicitlyDisconnected]);

  // Auto-trigger SIWE authentication when wallet connects (but not after explicit disconnect)
  useEffect(() => {
    const handleAutoAuth = async () => {
      if (
        isConnected &&
        !isAuthenticated &&
        !isLoading &&
        address &&
        !isConnecting &&
        !hasExplicitlyDisconnected // ⭐ Don't auto-auth after explicit disconnect
      ) {
        try {
          setIsConnecting(true);
          await login();
        } catch (error: any) {
          console.error("Auto-authentication failed:", error);

          // Check if user cancelled authentication
          if (
            error?.code === "USER_CANCELLED" ||
            error?.message?.includes("User cancelled authentication")
          ) {
            // User cancelled authentication - disconnect wallet and return to connect state
            console.log(
              "User cancelled authentication, disconnecting wallet..."
            );
            disconnect();
            setHasExplicitlyDisconnected(true);
          }
          // For other errors, let the component handle them in its error state
        } finally {
          setIsConnecting(false);
        }
      }
    };

    // Small delay to ensure wallet connection is fully established
    const timer = setTimeout(handleAutoAuth, 500);
    return () => clearTimeout(timer);
  }, [
    isConnected,
    isAuthenticated,
    isLoading,
    address,
    login,
    disconnect,
    isConnecting,
    hasExplicitlyDisconnected,
  ]);

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
      setHasExplicitlyDisconnected(true); // ⭐ Mark as explicitly disconnected

      // First, logout from backend (clear localStorage)
      if (isAuthenticated) {
        await logout();
      }

      // Then disconnect wallet using wagmi disconnect function
      // This works regardless of whether AppKit is used or not
      disconnect();
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
        {error && error !== "CANCELLED_BY_USER" && (
          <div className="text-xs text-red-600 px-2">{error}</div>
        )}
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
  if (
    isConnected &&
    !isAuthenticated &&
    error &&
    error !== "CANCELLED_BY_USER"
  ) {
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
