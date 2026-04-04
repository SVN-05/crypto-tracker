# 🐋 CES Portfolio Tracker - Multi-Wallet Integration

## ✨ What's New

Your CES Dashboard now has **enterprise-grade portfolio management** with:

### 🔐 Authentication System
- **Email/Password Login** — Secure account creation via Firebase
- **Account-Based Access** — All your data is tied to your account
- **Session Management** — Stay logged in across browser sessions

### 💼 Multi-Wallet Support
- **WalletConnect Integration** — Connect directly with TokenPocket or any Web3 wallet
- **Switch Between Wallets** — One account, multiple Polygon wallets
- **Add/Remove Wallets** — Manage your wallet portfolio easily
- **Auto-Fetch Balances** — Real-time CES token balance from blockchain

### 📊 Portfolio Persistence
- **Firebase Realtime Database** — All data synced to cloud
- **Per-Wallet Tracking** — Holdings and buy prices stored separately for each wallet
- **Cross-Device Sync** — Access your portfolio from any device
- **Automatic Backups** — Your data is safely stored in Firebase

### 🌍 Multi-Wallet Dashboard
- **Current Wallet Display** — See which wallet you're viewing
- **Quick Wallet Switching** — Dropdown menu to switch between connected wallets
- **Individual Metrics** — Track P&L, value, and projections per wallet
- **Unified Analysis** — Technical indicators and predictions work with any connected wallet

---

## 🚀 Quick Start

### 1. Set Up Firebase (5 minutes)
Follow the detailed guide in [`SETUP_FIREBASE.md`](./SETUP_FIREBASE.md)

### 2. Install & Run
```bash
npm install
npm run dev
```

### 3. Create Account
1. Click **"Register"** on the login page
2. Enter email and password
3. Account created! ✓

### 4. Connect Your Wallet
1. Click **"+ Connect Wallet"** in the navbar
2. Select **WalletConnect** → Opens QR code
3. Scan with **TokenPocket** or other WalletConnect wallet
4. Approve connection on mobile
5. Your wallet is now connected! 💼

### 5. View Your Portfolio
1. Go to **Portfolio** tab
2. See your auto-fetched CES balance
3. Enter your average buy price
4. Click **💾 Save to Firebase**
5. Done! Your portfolio is synced

---

## 📱 Features

### Login/Register Page
- Clean, minimal auth interface
- Email/password validation
- Link to switch between login/register

### Navbar Features
```
┌─────────────────────────────────────────────────┐
│ 🐋 CES Tracker │ 💼 0x1234...5678▼ │ Logout    │
└─────────────────────────────────────────────────┘
```
- Current wallet display
- Wallet dropdown with:
  - Switch between wallets
  - Remove wallet option
  - Add new wallet button
- User email
- Logout button

### Portfolio Tab Enhancements
- **Connected Wallet Info** — Shows current wallet address
- **Auto-Fetched Holdings** — Real-time balance from blockchain
- **Manual Holdings Input** — For custom amounts
- **Buy Price Tracking** — Per-wallet average cost basis
- **Save to Firebase** — Persist data to your account
- **What-if Scenarios** — Price projections
- **P&L Tracking** — Per-wallet profit/loss

### Multi-Wallet Management
Each wallet tracked separately:
- ✓ Holdings
- ✓ Buy price
- ✓ Current value
- ✓ P&L metrics
- ✓ Technical analysis (updated per wallet)

---

## 🔄 Data Flow

```
┌─────────────┐
│ TokenPocket │  (WalletConnect)
└──────┬──────┘
       │ (scan QR → approve)
       ↓
┌──────────────────┐
│  Your App        │  (ethers.js + web3 provider)
└──────┬───────────┘
       │ (fetch balance)
       ↓
┌──────────────────────┐
│  Polygon Blockchain  │  (Token contract)
└──────────────────────┘
       ↓ (balance returned)
┌──────────────────┐
│  Your App        │
└──────┬───────────┘
       │ (send data)
       ↓
┌──────────────────────┐
│  Firebase Database   │  (Real-time sync)
└──────────────────────┘
```

---

## 🛡️ Security

### Authentication
- Firebase-secured email/password auth
- No private keys or seed phrases stored
- Session tokens managed by Firebase
- Users can only access their own data

### Database Rules
- User-based access control
- Each user can only read/write their own portfolio
- Automatic validation of portfolio structure
- Read-only public data (none currently exposed)

### Blockchain Integration
- Only **public wallet addresses** are stored
- **No signing/transaction** functionality
- Read-only balance fetching via public RPC
- No gas fees or wallet access beyond balance checking

---

## 🎯 Usage Scenarios

### Scenario 1: Multi-Address Portfolio Tracking
1. Create account
2. Connect first wallet (your main address)
3. Connect second wallet (alternative address)
4. Use navbar dropdown to switch between wallets
5. View P&L for each wallet separately
6. All data synced across devices

### Scenario 2: Account Recovery
1. Log out of the app
2. Log back in from different device
3. All your wallets and holdings appear automatically
4. Continue tracking

### Scenario 3: Replace Connected Wallet
1. In wallet dropdown, remove old wallet
2. Click "+ Connect Wallet"
3. Connect new wallet
4. Copy holdings/buy price from previous wallet
5. Save to Firebase

---

## 📂 New Files Created

```
src/
├── App.tsx                      # Main app wrapper with auth routing
├── AuthContext.tsx              # Auth & portfolio state management
├── AuthPages.tsx                # Login & Register pages
├── WalletConnect.tsx            # WalletConnect modal
├── Navbar.tsx                   # Navbar with wallet switcher
├── firebase-config.ts           # Firebase initialization
├── ces-dashboard.tsx            # Dashboard (updated with auth)
└── main.tsx                     # Entry point (updated)

root/
├── .env                         # Firebase credentials (YOU MUST CREATE)
├── .env.example                 # Template
├── SETUP_FIREBASE.md            # Detailed Firebase setup
└── WALLET_INTEGRATION_SUMMARY.md # This file
```

---

## ⚙️ Environment Variables

Create `.env` file with:
```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_DATABASE_URL=...
```

See `.env.example` for template.

---

## 🧪 Testing Checklist

- [ ] Register a new account
- [ ] Log in/out works
- [ ] Connect wallet via WalletConnect
- [ ] Auto-fetch balance shows correct value
- [ ] Can manually edit holdings
- [ ] Save to Firebase succeeds
- [ ] Refresh page - data persists
- [ ] Can add second wallet
- [ ] Can switch between wallets
- [ ] P&L recalculates per wallet
- [ ] Log out and log back in - data still there
- [ ] Technical analysis updates with wallet switch

---

## 🐛 Troubleshooting

### "Cannot read property 'address' of null"
- Wallet not connected yet - click "+ Connect Wallet"
- Check mobile device has TokenPocket installed

### "Firebase is not initialized"
- Missing or incorrect `.env` file
- See `SETUP_FIREBASE.md` for proper configuration

### "Balance always shows 0"
- Wallet might not have CES tokens yet
- Check address is correct in Polygon chain
- Verify token contract address in `AuthContext.tsx`

### "WalletConnect QR not showing"
- Disable adblocker
- Try different browser
- Check console for errors (F12)

---

## 📚 Learn More

- [Firebase Setup Guide](./SETUP_FIREBASE.md)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [Ethers.js Docs](https://docs.ethers.org/)
- [Polygon Network](https://polygon.technology/)

---

## 🎉 Ready to Go!

1. Follow [`SETUP_FIREBASE.md`](./SETUP_FIREBASE.md)
2. Run `npm run dev`
3. Register and connect your wallet
4. Start tracking your CES portfolio across multiple wallets!

Questions? Check troubleshooting section or review the code comments.

Happy tracking! 🚀
