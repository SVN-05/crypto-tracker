import { useState } from "react";
import { useAuth } from "./AuthContext";
import { appKit } from "./reown-config";

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

      // Open Reown AppKit modal - it handles all the QR code and connection logic
      appKit.open();
    } catch (e: any) {
      console.error("Reown AppKit error:", e);
      setError("Failed to open wallet connection");
    } finally {
      setLoading(false);
    }
  };

  const confirmWalletConnection = async () => {
    try {
      setLoading(true);
      setError("");

      // Get the currently connected account from AppKit
      const account = appKit.getAccount();
      console.log("📱 Current account from AppKit:", account);

      if (!account?.address) {
        setError("No wallet connected. Please connect your wallet first.");
        setLoading(false);
        return;
      }

      console.log("💾 Adding wallet to Firebase:", account.address);
      // Add wallet to portfolio - wait for it to complete
      try {
        await addWallet(account.address, 137); // 137 = Polygon
        console.log("✅ Wallet added to Firebase successfully");
      } catch (e: any) {
        console.error("❌ Error in addWallet:", e);
        setError(e.message || "Failed to add wallet");
        setLoading(false);
        return;
      }

      // Give state updates time to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log("🔄 Wallet state should be updated, closing modal...");
      setLoading(false);
      onClose();

      // Give one more tick for modal to close
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log("✨ Modal closed, component should refresh");
    } catch (e: any) {
      console.error("❌ Error adding wallet:", e);
      setError(e.message || "Failed to add wallet to portfolio");
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
        zIndex: 999,
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
          <strong style={{ color: "#10b981" }}>Step 1:</strong> Click "Open Reown Connect" to open wallet selector
          <br />
          <strong style={{ color: "#10b981" }}>Step 2:</strong> Scan QR with TokenPocket and approve
          <br />
          <strong style={{ color: "#34d399" }}>Step 3:</strong> Click "Confirm & Save Wallet" to add to portfolio
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
          {loading ? "Opening..." : "📱 Open Reown Connect"}
        </button>

        <button
          onClick={confirmWalletConnection}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: loading ? "rgba(59,182,122,0.3)" : "#34d399",
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
          {loading ? "Confirming..." : "✓ Confirm & Save Wallet"}
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "transparent",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            transition: "all 0.2s",
            opacity: loading ? 0.5 : 1,
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
            lineHeight: 1.5,
          }}
        >
          <div>Powered by Reown • Polygon Network</div>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.25)" }}>
            Your wallet address will be saved to your Firebase account
          </div>
        </div>
      </div>
    </div>
  );
}
