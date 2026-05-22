import { useAccount, useDisconnect, useWalletClient, useChainId } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
import { ethers } from "ethers";
import { ARC_TESTNET } from "../utils/arc";

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { disconnect }           = useDisconnect();
  const { openConnectModal }     = useConnectModal();
  const { data: walletClient }   = useWalletClient();
  const chainId                  = useChainId();
  const isArcNetwork             = chainId === ARC_TESTNET.chainId;

  const signer = useMemo(() => {
    if (!walletClient) return null;
    try {
      const { account, chain, transport } = walletClient;
      const network = { chainId: chain.id, name: chain.name };
      const provider = new ethers.BrowserProvider(transport, network);
      return new ethers.JsonRpcSigner(provider, account.address);
    } catch (e) {
      console.error("Signer error:", e.message);
      return null;
    }
  }, [walletClient]);

  return {
    address,
    signer,
    chainId,
    isConnected,
    isArcNetwork,
    isConnecting: false,
    error: null,
    connect: openConnectModal || (() => {}),
    disconnect,
  };
}
