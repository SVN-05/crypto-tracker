# 🚀 Quick Start Guide

## 1️⃣ Firebase Setup (Required - 5 minutes)

1. Go to https://console.firebase.google.com/
2. Create a new project
3. Enable **Authentication** (Email/Password)
4. Create **Realtime Database** (test mode)
5. Paste rules from `SETUP_FIREBASE.md`
6. Get your config from Project Settings → Your apps → Web
7. Create `.env` file with your Firebase credentials

**Detailed instructions:** See [`SETUP_FIREBASE.md`](./SETUP_FIREBASE.md)

---

## 2️⃣ Install & Run

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

---

## 3️⃣ First Time Usage

### Register Account
1. Click **Register**
2. Enter email & password
3. Click **Create Account**

### Connect Wallet
1. Click **+ Connect Wallet** in navbar
2. Select **WalletConnect**
3. Scan QR with **TokenPocket** (or any WalletConnect wallet)
4. Approve on mobile

### Track Portfolio
1. Go to **Portfolio** tab
2. See auto-fetched CES balance
3. Enter average buy price
4. Click **💾 Save to Firebase**
5. Done! ✓

---

## 📊 Three Tabs

| Tab | Purpose |
|-----|---------|
| **📊 Chart** | Real-time price, RSI, MACD, Bollinger Bands, Fear & Greed Index |
| **🔮 Predict** | Composite trading score, technical signals, support/resistance |
| **💼 Portfolio** | Holdings, P&L, what-if scenarios, per-wallet tracking |

---

## 💼 Multi-Wallet Features

### Switch Wallets
Click dropdown in navbar `💼 0x1234...5678 ▼`

### Add Another Wallet
1. Click wallet dropdown
2. Select **+ Add Wallet**
3. Scan with TokenPocket
4. New wallet added!

### Remove Wallet
Click wallet dropdown, then **Remove** on wallet

---

## 🔐 Switching Accounts

### Log Out
Click **Logout** in navbar

### Log Back In
1. Click **Sign In**
2. Enter credentials
3. All portfolios restored! ✓

---

## 🎯 Key Features

✅ **Account-based** — Your data follows you  
✅ **Multi-wallet** — Track multiple addresses  
✅ **Auto-fetch** — Real-time balance from blockchain  
✅ **Firebase sync** — Persistent cloud storage  
✅ **Advanced charts** — RSI, MACD, Bollinger Bands  
✅ **Trading signals** — AI composite score + Fear & Greed  
✅ **Portfolio metrics** — P&L, ROI, what-if scenarios  

---

## 📱 Wallet Support

- ✅ TokenPocket
- ✅ MetaMask
- ✅ TrustWallet
- ✅ Any WalletConnect-compatible wallet
- **Network:** Polygon (Chain 137)

---

## ⚙️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Auth:** Firebase Authentication
- **Database:** Firebase Realtime Database
- **Blockchain:** ethers.js + WalletConnect
- **Charts:** D3.js
- **Styling:** CSS-in-JS (no framework)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Firebase not initialized" | Check `.env` file has all 7 variables |
| "Can't connect wallet" | Install TokenPocket, use mobile |
| "Balance shows 0" | Check wallet has CES on Polygon |
| "Can't save to Firebase" | Make sure logged in & database rules set |

**Full troubleshooting:** See `SETUP_FIREBASE.md`

---

## 📞 Support

1. Check browser console (`F12`) for errors
2. Review `SETUP_FIREBASE.md` for detailed setup
3. Read `WALLET_INTEGRATION_SUMMARY.md` for architecture

---

## ✨ You're All Set!

Your multi-wallet portfolio tracker is ready. 

**Next steps:**
1. Follow Firebase setup → 5 mins
2. `npm run dev` → Start dev server
3. Register → Create account
4. Connect wallet → Scan QR
5. Track portfolio → Done! 🎉

Happy tracking! 🐋
