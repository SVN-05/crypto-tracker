import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { polygonMumbai, polygon } from "@reown/appkit/networks";

// Get Project ID from environment
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is not set in .env");
}

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [polygon, polygonMumbai],
  projectId,
  features: {
    analytics: true,
    swaps: false,
    onramp: false,
  },
});

export default appKit;
