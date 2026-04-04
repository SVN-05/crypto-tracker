// Polyfills for Node.js APIs in browser
import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;

import { createRoot } from "react-dom/client";
import AppWrapper from "./App";
import { AuthProvider } from "./AuthContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <AppWrapper />
  </AuthProvider>
);
