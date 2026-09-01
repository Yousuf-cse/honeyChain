import { http, createConfig } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545";
const chainEnv = process.env.NEXT_PUBLIC_CHAIN;

const chains = chainEnv === "sepolia" ? [sepolia] : [hardhat];

export const config = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(RPC_URL),
    [hardhat.id]: http(RPC_URL),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
