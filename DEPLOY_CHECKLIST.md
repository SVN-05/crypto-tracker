# ✅ GitHub Pages Deployment Checklist

Follow this checklist to deploy your app with Firebase secrets.

## Pre-Deployment (One Time)

### 1. Add GitHub Secrets
- [ ] Go to GitHub repo Settings
- [ ] Click "Secrets and variables" → "Actions"
- [ ] Add these 7 secrets (from your local `.env`):
  - [ ] `FIREBASE_API_KEY`
  - [ ] `FIREBASE_AUTH_DOMAIN`
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `FIREBASE_STORAGE_BUCKET`
  - [ ] `FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `FIREBASE_APP_ID`
  - [ ] `FIREBASE_DATABASE_URL`

### 2. Verify GitHub Pages Settings
- [ ] Go to Settings → "Pages"
- [ ] Confirm "Deploy from a branch" is selected
- [ ] Branch is set to `gh-pages`

### 3. Configure Vite (Already Done!)
- [x] `vite.config.ts` has `base: "/ces-price-tracker/"`
- [x] `vite.config.ts` has `outDir: "dist"`
- [x] Workflow uses `npm run build:dashboard`

## Deploy (Every Push)

### 1. Commit Your Changes
```bash
git add .
git commit -m "Add multi-wallet support"
git push origin main
```

### 2. GitHub Actions Automatically:
- [ ] Triggers "Deploy Dashboard to GitHub Pages" workflow
- [ ] Creates `.env` file from GitHub Secrets
- [ ] Runs `npm run build:dashboard`
- [ ] Uploads `dist/` folder as artifact
- [ ] Deploys to `gh-pages` branch

### 3. Check Deployment Status
- [ ] Go to **Actions** tab
- [ ] Click latest "Deploy Dashboard to GitHub Pages"
- [ ] Wait for both "build" and "deploy" jobs to show ✅
- [ ] Should take 2-3 minutes total

## Verify Deployment

### 1. Check Website is Live
- [ ] Visit: `https://your-username.github.io/ces-price-tracker/`
- [ ] Should load without errors

### 2. Test Firebase Connection
- [ ] Click **Register** → Create test account
- [ ] Should connect to Firebase successfully
- [ ] Data should save to database

### 3. Test Wallet Connection
- [ ] Click **+ Connect Wallet**
- [ ] Scan with TokenPocket
- [ ] Should fetch balance from blockchain

## Troubleshooting Quick Links

| Problem | Guide |
|---------|-------|
| Build fails | See GITHUB_PAGES_DEPLOYMENT.md → Troubleshooting |
| Blank page | Check `vite.config.ts` base path |
| Firebase not working | Check secrets are added correctly |
| Wallet not connecting | Check Polygon network (Chain 137) |

## One-Liner Deploy

After first-time setup:
```bash
git add . && git commit -m "Update" && git push origin main
# Then wait 2-3 min for GitHub Actions to deploy
```

## Useful GitHub Actions URLs

- **Actions Log**: `https://github.com/YOUR-USERNAME/ces-price-tracker/actions`
- **Secrets**: `https://github.com/YOUR-USERNAME/ces-price-tracker/settings/secrets/actions`
- **Pages Settings**: `https://github.com/YOUR-USERNAME/ces-price-tracker/settings/pages`
- **Live Site**: `https://YOUR-USERNAME.github.io/ces-price-tracker/`

## Emergency: Redeploy

If something goes wrong and you need to redeploy:

```bash
# Trigger a rebuild without code changes
git commit --allow-empty -m "Rebuild"
git push origin main
```

---

**🎉 You're all set!** Your app deploys automatically on every push.

For detailed help: See `GITHUB_PAGES_DEPLOYMENT.md`
