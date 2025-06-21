import React from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
// Custom button component
const CustomConnectButton: React.FC = () => {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

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
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
            >
              Disconnect
            </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full sm:w-auto text-sm sm:text-base"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
};

export default CustomConnectButton;
