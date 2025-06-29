import { useState } from "react";
import { useChainId, useChains, useSwitchChain } from "wagmi";

const NetworkSwitcher = () => {
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain, isPending } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);

  const availableNetworks = chains.filter(
    (network) => network.id === 43113 || network.id === 11155111
  );

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 43113:
        return "Avalanche";
      case 11155111:
        return "Sepolia";
      default:
        return "Unsupported";
    }
  };

  const getNetworkIcon = (chainId) => {
    switch (chainId) {
      case 43113:
        return "❄️";
      case 11155111:
        return "🔵";
      default:
        return "⚠️";
    }
  };

  const handleNetworkSwitch = (chainId) => {
    switchChain({ chainId });
    setIsOpen(false);
  };

  const currentNetwork = getNetworkName(chainId);
  const currentIcon = getNetworkIcon(chainId);

  const isSupportedNetwork = chainId === 43113 || chainId === 11155111;

  return (
    <div className="relative ml-3">
      {/* Compact Network Display */}
      <div
        className={`network-switcher flex items-center gap-1.5 px-2 py-2 border rounded-md cursor-pointer transition-all duration-200 text-xs font-medium ${
          isSupportedNetwork
            ? "bg-gray-700 border-gray-500 hover:bg-gray-600 text-white"
            : "bg-red-700 border-red-500 hover:bg-red-600 text-white"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm">{currentIcon}</span>
        <span className="hidden sm:inline">{currentNetwork}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </div>

      {/* Network Dropdown */}
      {isOpen && (
        <div className="network-switcher-dropdown absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
          <div className="p-2">
            <div className="text-gray-400 text-xs px-2 py-1 border-b border-gray-600 mb-1">
              Switch Network
            </div>
            {availableNetworks.map((network) => {
              const isCurrent = chainId === network.id;
              const icon = getNetworkIcon(network.id);
              const name = getNetworkName(network.id);

              return (
                <button
                  key={network.id}
                  onClick={() => handleNetworkSwitch(network.id)}
                  disabled={isCurrent || isPending}
                  className={`network-option w-full flex items-center gap-2 px-2 py-2 text-left rounded-md transition-all duration-200 text-sm ${
                    isCurrent
                      ? "bg-blue-600 text-white cursor-not-allowed"
                      : "text-white hover:bg-gray-700"
                  } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="text-sm">{icon}</span>
                  <div className="flex-1">
                    <div className="">{name}</div>
                    <div className="text-xs text-gray-400 font-normal">
                      ID: {network.id}
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-green-400 text-xs">✓</span>
                  )}
                  {isPending && (
                    <span className="text-yellow-400 text-xs">⏳</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default NetworkSwitcher;
