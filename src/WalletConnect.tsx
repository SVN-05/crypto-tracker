import { useState } from "react";
import { useAuth } from "./AuthContext";
import WalletConnectProvider from "@walletconnect/web3-provider";

export function WalletConnectModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { addWallet } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connectWithWalletConnect = async () => {
    try {
      setLoading(true);
      setError("");

      const provider = new WalletConnectProvider({
        infuraId: "27e484dcd9e3efcfd25a83a78777cdf1",
        rpc: {
          137: "https://polygon-rpc.com/",
        },
        chainId: 137,
      });

      await provider.enable();

      const accounts = provider.accounts;
      const chainId = provider.chainId;

      if (accounts && accounts.length > 0) {
        await addWallet(accounts[0], chainId);
        setError("");
        onClose();
      } else {
        setError("No account found. Please check your wallet.");
      }
    } catch (e: any) {
      console.error("WalletConnect error:", e);
      setError(e.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#080812",
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          Connect Wallet
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          Use WalletConnect to connect your TokenPocket wallet or other Web3 wallet. This will allow
          auto-fetching your CES token balance.
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={connectWithWalletConnect}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: loading ? "rgba(16,185,129,0.3)" : "#10b981",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            marginBottom: 12,
            transition: "all 0.2s",
          }}
        >
          {loading ? "Connecting..." : "📱 WalletConnect"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "transparent",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          Cancel
        </button>

        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Supports: Polygon (137)
        </div>
      </div>
    </div>
  );
}
