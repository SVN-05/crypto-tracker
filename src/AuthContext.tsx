import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase-config";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import { appKit } from "./reown-config";

export interface ConnectedWallet {
  address: string;
  chainId: number;
  connectedAt: number;
}

export interface Portfolio {
  id: string;
  wallets: ConnectedWallet[];
  holdings: { [walletAddress: string]: number };
  buyPrice: { [walletAddress: string]: number };
  createdAt: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  portfolio: Portfolio | null;
  currentWallet: string | null;

  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  addWallet: (address: string, chainId: number) => Promise<void>;
  removeWallet: (address: string) => Promise<void>;
  switchWallet: (address: string) => Promise<void>;

  updateHoldings: (walletAddress: string, holdings: number, buyPrice: number) => Promise<void>;
  getWalletBalance: (walletAddress: string) => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);

  // Load portfolio from Firebase
  const loadPortfolio = useCallback(async (uid: string) => {
    try {
      const portfolioRef = ref(db, `users/${uid}/portfolio`);
      const snapshot = await get(portfolioRef);
      if (snapshot.exists()) {
        const portfolioData = snapshot.val();
        setPortfolio(portfolioData);
        const wallets = portfolioData?.wallets || [];
        const firstWallet = wallets[0];
        setCurrentWallet(firstWallet?.address || null);
      } else {
        // Initialize default portfolio if it doesn't exist
        const newPortfolio: Portfolio = {
          id: uid,
          wallets: [],
          holdings: {},
          buyPrice: {},
          createdAt: Date.now(),
        };
        await set(portfolioRef, newPortfolio);
        setPortfolio(newPortfolio);
        setCurrentWallet(null);
      }
    } catch (e) {
      console.error("Error loading portfolio:", e);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadPortfolio(firebaseUser.uid);
      } else {
        setUser(null);
        setPortfolio(null);
        setCurrentWallet(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadPortfolio]);

  const register = useCallback(async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Create default portfolio
      const newPortfolio: Portfolio = {
        id: uid,
        wallets: [],
        holdings: {},
        buyPrice: {},
        createdAt: Date.now(),
      };

      await set(ref(db, `users/${uid}/portfolio`), newPortfolio);
      setPortfolio(newPortfolio);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await loadPortfolio(userCredential.user.uid);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }, [loadPortfolio]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setPortfolio(null);
    setCurrentWallet(null);
  }, []);

  const addWallet = useCallback(
    async (address: string, chainId: number) => {
      try {
        if (!user) {
          throw new Error("User not authenticated. Please log in first.");
        }

        // Validate address
        if (!address || typeof address !== "string") {
          throw new Error("Invalid wallet address provided");
        }

        const cleanAddress = address.trim().toLowerCase();

        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
          throw new Error("Wallet address must be a valid Ethereum address (0x + 40 hex characters)");
        }

        // Validate chainId
        if (!chainId || typeof chainId !== "number" || chainId <= 0) {
          throw new Error("Invalid chain ID");
        }

        // Read current portfolio from state to avoid stale closure
        return new Promise<void>((resolve, reject) => {
          try {
            setPortfolio((currentPortfolio) => {
              try {
                if (!currentPortfolio) {
                  throw new Error("Portfolio not available. Please refresh and try again.");
                }

                if (!Array.isArray(currentPortfolio.wallets)) {
                  throw new Error("Portfolio wallets array is invalid");
                }

                // Check if wallet already exists
                if (currentPortfolio.wallets.some(w => w?.address === cleanAddress)) {
                  throw new Error("This wallet is already connected to your account");
                }

                const newWallet: ConnectedWallet = {
                  address: cleanAddress,
                  chainId,
                  connectedAt: Date.now(),
                };

                const updatedPortfolio: Portfolio = {
                  ...currentPortfolio,
                  wallets: [...currentPortfolio.wallets, newWallet],
                  holdings: { ...currentPortfolio.holdings, [cleanAddress]: 0 },
                  buyPrice: { ...currentPortfolio.buyPrice, [cleanAddress]: 0 },
                };

                // Save to Firebase
                set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio)
                  .then(() => {
                    setCurrentWallet(cleanAddress);
                    resolve();
                  })
                  .catch((err: any) => {
                    reject(new Error(`Failed to save wallet: ${err?.message || "Unknown error"}`));
                  });

                return updatedPortfolio;
              } catch (err: any) {
                reject(err);
                return currentPortfolio;
              }
            });
          } catch (err: any) {
            reject(err);
          }
        });
      } catch (err: any) {
        throw new Error(err?.message || "Failed to add wallet");
      }
    },
    [user]
  );

  const removeWallet = useCallback(
    async (address: string) => {
      try {
        if (!user) {
          throw new Error("User not authenticated");
        }

        if (!address || typeof address !== "string") {
          throw new Error("Invalid wallet address");
        }

        const cleanAddress = address.toLowerCase().trim();

        return new Promise<void>((resolve, reject) => {
          try {
            setPortfolio((currentPortfolio) => {
              try {
                if (!currentPortfolio) {
                  throw new Error("Portfolio not initialized");
                }

                if (!Array.isArray(currentPortfolio.wallets)) {
                  throw new Error("Portfolio wallets array is invalid");
                }

                const updatedPortfolio: Portfolio = {
                  ...currentPortfolio,
                  wallets: currentPortfolio.wallets.filter((w) => w?.address !== cleanAddress),
                };

                const holdings = { ...currentPortfolio.holdings };
                const buyPrice = { ...currentPortfolio.buyPrice };
                delete holdings[cleanAddress];
                delete buyPrice[cleanAddress];

                updatedPortfolio.holdings = holdings;
                updatedPortfolio.buyPrice = buyPrice;

                // Save to Firebase
                set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio)
                  .then(async () => {
                    // Disconnect from Reown if removing the current wallet
                    try {
                      if (appKit && typeof appKit.disconnect === 'function') {
                        await appKit.disconnect();
                      }
                    } catch (e) {
                      console.warn("Could not disconnect from Reown:", e);
                    }

                    if (currentWallet === cleanAddress) {
                      setCurrentWallet(updatedPortfolio.wallets[0]?.address || null);
                    }
                    resolve();
                  })
                  .catch((err: any) => {
                    reject(new Error(`Failed to remove wallet: ${err?.message || "Unknown error"}`));
                  });

                return updatedPortfolio;
              } catch (err: any) {
                reject(err);
                return currentPortfolio;
              }
            });
          } catch (err: any) {
            reject(err);
          }
        });
      } catch (err: any) {
        throw new Error(err?.message || "Failed to remove wallet");
      }
    },
    [user, currentWallet]
  );

  const switchWallet = useCallback((address: string) => {
    setCurrentWallet(address.toLowerCase());
  }, []);

  const updateHoldings = useCallback(
    async (walletAddress: string, holdings: number, buyPrice: number) => {
      if (!user) return;

      return new Promise<void>((resolve, reject) => {
        setPortfolio((currentPortfolio) => {
          if (!currentPortfolio) {
            reject(new Error("Portfolio not initialized"));
            return currentPortfolio;
          }

          const updatedPortfolio = {
            ...currentPortfolio,
            holdings: { ...currentPortfolio.holdings, [walletAddress.toLowerCase()]: holdings },
            buyPrice: { ...currentPortfolio.buyPrice, [walletAddress.toLowerCase()]: buyPrice },
          };

          // Save to Firebase
          set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio)
            .then(() => resolve())
            .catch(reject);

          return updatedPortfolio;
        });
      });
    },
    [user]
  );

  const getWalletBalance = useCallback(async (walletAddress: string): Promise<number> => {
    try {
      // Use Ankr's free Polygon RPC endpoint (more reliable than polygon-rpc.com)
      const provider = new JsonRpcProvider("https://rpc.ankr.com/polygon");

      const TOKEN_ADDRESS = "0x1Bdf71EDe1a4777dB1EebE7232BcdA20d6FC1610";
      const TOKEN_ABI = ["function balanceOf(address account) external view returns (uint256)"];

      const contract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);

      return parseFloat(formatUnits(balance, 18));
    } catch (e) {
      console.error("Error fetching balance:", e);
      return 0;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        portfolio,
        currentWallet,
        register,
        login,
        logout,
        addWallet,
        removeWallet,
        switchWallet,
        updateHoldings,
        getWalletBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
