import React from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { Button } from "@/shared/Button";

// Custom button component
const CustomConnectButton: React.FC = () => {
  const { open } = useAppKit();
  const { isConnected } = useAccount();

  const handleConnect = async () => {
    try {
      await open();
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handleDisconnect = () => {
    open({ view: "Account" });
  };

  return (
    <div className="flex items-center w-full">
      {isConnected ? (
        <div>
          <Button  className="disconnect-button" onClick={handleDisconnect} variant="destructive" size="sm">
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          variant="customBlue"
          size="sm"
            className="connect-button"
        >
          Connect Wallet
        </Button>
      )}
    </div>
  );
};

export default CustomConnectButton;
