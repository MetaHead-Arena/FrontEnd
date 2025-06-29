import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { avalancheFuji, sepolia } from "@reown/appkit/networks";

// Get projectId from https://cloud.reown.com
export const projectId = `${process.env.NEXT_PUBLIC_PROJECT_ID}`;

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const networks = [avalancheFuji, sepolia];

//Set up the Wagmi Adapter (Config) - MetaMask only
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
  connectorImages: {
    metaMask: "https://avatars.githubusercontent.com/u/11744586?s=48&v=4",
  },
});

export const config = wagmiAdapter.wagmiConfig;
