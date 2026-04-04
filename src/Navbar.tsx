import { useState } from "react";
import { useAuth } from "./AuthContext";
import { WalletConnectModal } from "./WalletConnect";

export function Navbar({
  onWalletSwitch,
}: {
  onWalletSwitch?: () => void;
}) {
  const { user, portfolio, currentWallet, logout, switchWallet, removeWallet } = useAuth();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const shortenAddress = (addr: string) => {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  return (
    <>
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "100%",
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: 700 }}>
          <span>🐋</span>
          <span>CES Tracker</span>
        </div>

        {/* Right: Wallet & Auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Current Wallet Selector */}
          {currentWallet && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#10b981",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                💼 {shortenAddress(currentWallet)}
                <span>{walletDropdownOpen ? "▲" : "▼"}</span>
              </button>

              {walletDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    background: "#080812",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    marginTop: 4,
                    minWidth: 200,
                    zIndex: 100,
                  }}
                >
                  {portfolio?.wallets.map((wallet) => (
                    <div key={wallet.address}>
                      <button
                        onClick={() => {
                          switchWallet(wallet.address);
                          setWalletDropdownOpen(false);
                          onWalletSwitch?.();
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          textAlign: "left",
                          background:
                            currentWallet === wallet.address ? "rgba(16,185,129,0.2)" : "transparent",
                          border: "none",
                          color: "#e2e8f0",
                          cursor: "pointer",
                          fontSize: 12,
                          fontFamily: "inherit",
                          borderBottom:
                            wallet === portfolio?.wallets[portfolio.wallets.length - 1]
                              ? "none"
                              : "1px solid rgba(255,255,255,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{shortenAddress(wallet.address)}</span>
                        {currentWallet === wallet.address && <span>✓</span>}
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      setWalletModalOpen(true);
                      setWalletDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      textAlign: "left",
                      background: "rgba(255,255,255,0.05)",
                      border: "none",
                      color: "#10b981",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    + Add Wallet
                  </button>
                </div>
              )}
            </div>
          )}

          {!currentWallet && (
            <button
              onClick={() => setWalletModalOpen(true)}
              style={{
                background: "#10b981",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#000",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              + Connect Wallet
            </button>
          )}

          {/* User Email */}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {user?.email && shortenAddress(user.email)}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <WalletConnectModal
        isOpen={walletModalOpen}
        onClose={() => {
          setWalletModalOpen(false);
          // Trigger dashboard refresh when wallet is added
          onWalletSwitch?.();
        }}
      />
    </>
  );
}
