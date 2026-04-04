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
        setPortfolio(snapshot.val());
        const firstWallet = snapshot.val().wallets[0];
        setCurrentWallet(firstWallet?.address || null);
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
      if (!user || !portfolio) return;

      const newWallet: ConnectedWallet = {
        address: address.toLowerCase(),
        chainId,
        connectedAt: Date.now(),
      };

      const updatedPortfolio = {
        ...portfolio,
        wallets: [...portfolio.wallets, newWallet],
        holdings: { ...portfolio.holdings, [address.toLowerCase()]: 0 },
        buyPrice: { ...portfolio.buyPrice, [address.toLowerCase()]: 0 },
      };

      await set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio);
      setPortfolio(updatedPortfolio);
      setCurrentWallet(address.toLowerCase());
    },
    [user, portfolio]
  );

  const removeWallet = useCallback(
    async (address: string) => {
      if (!user || !portfolio) return;

      const updatedPortfolio = {
        ...portfolio,
        wallets: portfolio.wallets.filter((w) => w.address !== address.toLowerCase()),
      };

      const holdings = { ...portfolio.holdings };
      const buyPrice = { ...portfolio.buyPrice };
      delete holdings[address.toLowerCase()];
      delete buyPrice[address.toLowerCase()];

      updatedPortfolio.holdings = holdings;
      updatedPortfolio.buyPrice = buyPrice;

      await set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio);
      setPortfolio(updatedPortfolio);

      if (currentWallet === address.toLowerCase()) {
        setCurrentWallet(updatedPortfolio.wallets[0]?.address || null);
      }
    },
    [user, portfolio, currentWallet]
  );

  const switchWallet = useCallback((address: string) => {
    setCurrentWallet(address.toLowerCase());
  }, []);

  const updateHoldings = useCallback(
    async (walletAddress: string, holdings: number, buyPrice: number) => {
      if (!user || !portfolio) return;

      const updatedPortfolio = {
        ...portfolio,
        holdings: { ...portfolio.holdings, [walletAddress.toLowerCase()]: holdings },
        buyPrice: { ...portfolio.buyPrice, [walletAddress.toLowerCase()]: buyPrice },
      };

      await set(ref(db, `users/${user.uid}/portfolio`), updatedPortfolio);
      setPortfolio(updatedPortfolio);
    },
    [user, portfolio]
  );

  const getWalletBalance = useCallback(async (walletAddress: string): Promise<number> => {
    try {
      const provider = new (window as any).ethers.providers.JsonRpcProvider(
        "https://polygon-rpc.com/"
      );

      const TOKEN_ADDRESS = "0x1Bdf71EDe1a4777dB1EebE7232BcdA20d6FC1610";
      const TOKEN_ABI = ["function balanceOf(address account) external view returns (uint256)"];

      const contract = new (window as any).ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);

      return parseFloat((window as any).ethers.utils.formatUnits(balance, 18));
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
