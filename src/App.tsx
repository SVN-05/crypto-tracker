import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { LoginPage, RegisterPage } from "./AuthPages";
import Dashboard from "./ces-dashboard";
import { Navbar } from "./Navbar";
import "./reown-config"; // Initialize Reown AppKit

export default function AppWrapper() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [dashboardKey, setDashboardKey] = useState(0);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080812",
          color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐋</div>
          <div style={{ fontSize: 14, opacity: 0.6 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {authMode === "login" ? (
          <LoginPage onSwitchToRegister={() => setAuthMode("register")} />
        ) : (
          <RegisterPage onSwitchToLogin={() => setAuthMode("login")} />
        )}
      </>
    );
  }

  return (
    <div>
      <Navbar onWalletSwitch={() => setDashboardKey((k) => k + 1)} />
      <Dashboard key={dashboardKey} />
    </div>
  );
}
