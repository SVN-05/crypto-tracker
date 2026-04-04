# Firebase Setup Guide

This guide will help you set up Firebase for the CES Portfolio Tracker with multi-wallet support and portfolio persistence.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., "CES Tracker")
4. Select your region (preferably closest to your location)
5. Click **"Create project"**
6. Wait for the project to initialize

## Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Under **Sign-in method**, click **Email/Password**
4. Toggle **Enable** for both "Email/Password" and "Email link (passwordless sign-in)"
5. Click **Save**

## Step 3: Create Realtime Database

1. Go to **Realtime Database** (left sidebar)
2. Click **"Create Database"**
3. Choose your region (same as project for best performance)
4. Select **Start in test mode** (we'll secure it in Step 4)
5. Click **"Enable"**

## Step 4: Set Database Rules

1. In Realtime Database, go to the **Rules** tab
2. Replace all content with the following security rules:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "portfolio": {
          ".validate": "newData.hasChildren(['id', 'wallets', 'holdings', 'buyPrice', 'createdAt'])"
        }
      }
    }
  }
}
```

3. Click **"Publish"**

## Step 5: Get Your Firebase Config

1. In Firebase Console, go to **Project Settings** (⚙️ icon)
2. Click on **Your apps** section
3. Click **"</>Web"** to add a web app (if not already created)
4. Copy your Firebase config object - it should look like:

```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc...",
  databaseURL: "https://your-project.firebaseio.com"
}
```

## Step 6: Configure Your App

1. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

2. Fill in the values from your Firebase config:

```
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc...
REACT_APP_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

3. Save the file and **restart your development server**:

```bash
npm run dev
```

## Step 7: Test Your Setup

1. Open the app in your browser
2. Click **Register** to create an account
3. Try to connect a wallet via **WalletConnect**
4. Go to the **Portfolio** tab and enter holdings data
5. Click **Save to Firebase** to verify it's working
6. Log out and log back in - your data should persist!

## Troubleshooting

### "Firebase config not initialized"
- Check that all `.env` variables are set correctly
- Restart the development server: `npm run dev`
- Check browser console for specific errors

### "Authentication failed"
- Make sure you've enabled Email/Password auth in Firebase Console
- Try creating a new account from scratch

### "Unable to save to Firebase"
- Check Realtime Database rules are published
- Verify you're logged in and authenticated
- Check browser console for permission errors

### "WalletConnect not working"
- Make sure you have TokenPocket or another WalletConnect-compatible wallet installed
- Check that your wallet is on the Polygon network (Chain ID: 137)

## Database Structure

After setup, your Firebase will automatically create this structure for each user:

```
/users/
  /{uid}/
    portfolio/
      id: "user_id"
      wallets: [
        { address: "0x...", chainId: 137, connectedAt: 1234567890 },
        { address: "0x...", chainId: 137, connectedAt: 1234567891 }
      ]
      holdings: {
        "0x...": 100.5,
        "0x...": 50.0
      }
      buyPrice: {
        "0x...": 0.50,
        "0x...": 0.75
      }
      createdAt: 1234567890
```

## Security Notes

- Your Firebase API key is exposed in the frontend code - this is intentional and secure because we're using Firebase Authentication and Realtime Database rules
- Never commit your `.env` file to git
- The database rules ensure users can only read/write their own data
- Private keys or seed phrases are never stored - only public wallet addresses

## Support

If you encounter issues:

1. Check the browser **DevTools Console** (F12) for error messages
2. Verify all `.env` variables are correct
3. Check Firebase Console → Rules for any validation errors
4. Try clearing browser storage: `localStorage.clear()` in console

Happy tracking! 🐋
