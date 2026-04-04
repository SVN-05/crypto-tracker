# 🚀 Deploying to GitHub Pages with Firebase Secrets

This guide explains how to deploy your CES Portfolio Tracker to GitHub Pages with environment variables securely stored as GitHub Secrets.

## Overview

```
Your Local Machine          GitHub Repository          GitHub Pages
    .env ← → GitHub Secrets ← → Action Build ← → dist/ ← → Hosted Site
(local only)   (encrypted)      (CI/CD)          (public)  (https://)
```

**Key Points:**
- ✅ Your `.env` file stays local (in `.gitignore`)
- ✅ Firebase credentials stored securely in GitHub Secrets
- ✅ GitHub Actions builds the app with those secrets
- ✅ Built app deployed to GitHub Pages automatically

---

## Step 1: Add GitHub Secrets

### 1.1 Get Your Firebase Credentials

You already have these in your local `.env`:
```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_DATABASE_URL=...
```

### 1.2 Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** button

**Add these 7 secrets** (copy values from your `.env` file):

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_API_KEY` | From your `.env` |
| `FIREBASE_AUTH_DOMAIN` | From your `.env` |
| `FIREBASE_PROJECT_ID` | From your `.env` |
| `FIREBASE_STORAGE_BUCKET` | From your `.env` |
| `FIREBASE_MESSAGING_SENDER_ID` | From your `.env` |
| `FIREBASE_APP_ID` | From your `.env` |
| `FIREBASE_DATABASE_URL` | From your `.env` |

**Example:**
```
Secret: FIREBASE_API_KEY
Value:  AIzaSyCwh7FNGX8Rxx-KOb5wLFoz0FBAgCnOzhY
```

✅ After adding all 7, you should see them listed in the Secrets section.

---

## Step 2: Update Your Workflow (Already Done!)

The `.github/workflows/deploy-dashboard.yml` file now includes:

```yaml
- name: Create .env file from secrets
  run: |
    cat > .env << EOF
    REACT_APP_FIREBASE_API_KEY=${{ secrets.FIREBASE_API_KEY }}
    REACT_APP_FIREBASE_AUTH_DOMAIN=${{ secrets.FIREBASE_AUTH_DOMAIN }}
    ...
    EOF
```

This step:
1. Creates a `.env` file at build time
2. Fills it with values from GitHub Secrets
3. Used by Vite during the build process

---

## Step 3: Deploy

### Automatic Deployment (Every Push)

Once secrets are added, every push to `main` triggers:

1. **Build** → Checkout code, install deps, build with secrets
2. **Deploy** → Push to `gh-pages` branch
3. **Live** → Your site updates at `https://your-username.github.io/ces-price-tracker/`

### Manual Deployment

1. Go to **Actions** tab in GitHub
2. Click **Deploy Dashboard to GitHub Pages**
3. Click **Run workflow** → **Run workflow**
4. Wait 1-2 minutes for build and deploy

---

## Step 4: Verify Deployment

### Check if Live

Visit: `https://your-username.github.io/ces-price-tracker/`

### Check GitHub Pages Settings

1. Go to Settings → **Pages**
2. Verify **Source** is set to **Deploy from a branch**
3. Verify **Branch** is **gh-pages** (or where you deploy to)

### Check Deployment Status

1. Go to **Actions** tab
2. Look for recent "Deploy Dashboard to GitHub Pages" workflow
3. Should show ✅ green checkmark
4. Click to see detailed logs

---

## Troubleshooting

### Build Failed: "Cannot find module 'firebase'"

**Cause:** npm dependencies not installed properly

**Fix:**
```bash
npm ci
npm install
git push
```

### Build Failed: "REACT_APP_FIREBASE_API_KEY is undefined"

**Cause:** Secrets not added to GitHub, or named incorrectly

**Fix:**
- Go to Settings → Secrets and check all 7 are present
- Verify secret names match exactly (case-sensitive):
  - `FIREBASE_API_KEY` (not `REACT_APP_FIREBASE_API_KEY`)
  - Workflow prefixes with `REACT_APP_` automatically

### Site Shows Blank Page

**Cause:** Wrong base path in vite config, or build path wrong

**Fix:** Check `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/ces-price-tracker/',  // If repo name is ces-price-tracker
  // ...
})
```

### Firebase Connection Fails on Hosted Site

**Cause:** Firebase security rules blocking requests

**Fix:** Check Firebase → Database → Rules

These rules allow all authenticated users:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### Login Page Works but Firebase Sync Fails

**Cause:** Secrets were updated but not used by build

**Fix:** Trigger a new build:
```bash
git commit --allow-empty -m "Trigger rebuild"
git push
```

---

## Security Best Practices

### ✅ DO

- ✅ Store credentials in GitHub Secrets
- ✅ Keep `.env` in `.gitignore`
- ✅ Rotate credentials periodically
- ✅ Use environment-specific credentials (dev vs prod)
- ✅ Audit who has access to secrets

### ❌ DON'T

- ❌ Commit `.env` file to git
- ❌ Put secrets in code or comments
- ❌ Share `.env` file via email/chat
- ❌ Use same credentials for dev and prod
- ❌ Commit `.env.example` with real values

---

## Environment-Specific Secrets

If you want different Firebase projects for **dev** vs **production**:

1. Create a `.env.staging` (for staging/testing)
2. Add separate GitHub Secrets: `FIREBASE_*_STAGING`
3. Create a separate workflow that uses staging secrets
4. Deploy to different GitHub Pages branch

---

## Monitoring & Logs

### View Build Logs

1. Go to **Actions** tab
2. Click on the latest workflow run
3. Click on **build** job to see full output
4. Look for:
   - ✅ "Build dashboard" (should be green)
   - ✅ "Deploy to GitHub Pages" (should be green)

### Common Log Messages

| Message | Meaning |
|---------|---------|
| "Created .env from secrets" | Secrets loaded successfully |
| "npm ci" | Dependencies installed |
| "npm run build" | Build process running |
| "Upload artifact" | Built files prepared |
| "Deploy to GitHub Pages" | Files pushed live |

---

## Useful Commands

### Test Build Locally
```bash
# Build with your local .env
npm run build

# Preview the built site
npm run preview
```

### Force Rebuild
```bash
# Create empty commit to trigger workflow
git commit --allow-empty -m "Rebuild"
git push origin main
```

### Update a Secret
```bash
# Go to GitHub Settings → Secrets
# Click the secret
# Click "Update"
# Paste new value
```

---

## FAQ

**Q: Can I see my secrets in logs?**  
A: No! GitHub automatically masks secrets in logs. You'll see `***` instead.

**Q: Do I need to add .env to git?**  
A: No! Keep it in `.gitignore`. GitHub Secrets is the secure way.

**Q: What if I change a secret?**  
A: Changes take effect immediately. Next build will use the new value.

**Q: Can I use the same Firebase project locally and on GitHub Pages?**  
A: Yes! That's the whole point. Same `.env` values, deployed via secrets.

**Q: What's the difference between .env and GitHub Secrets?**  
A: `.env` is local-only, never committed. GitHub Secrets are encrypted on GitHub's servers, used during build.

---

## Next Steps

1. ✅ Add all 7 Firebase secrets to GitHub
2. ✅ Verify `.github/workflows/deploy-dashboard.yml` is updated
3. ✅ Push code to main branch
4. ✅ Check Actions tab - build should start automatically
5. ✅ Visit your GitHub Pages URL when build is green ✓

---

## Summary

| Scenario | Solution |
|----------|----------|
| Local development | Use `.env` file |
| Sharing code | Never commit `.env` |
| GitHub Pages | Use GitHub Secrets |
| CI/CD pipeline | Workflow reads secrets |
| Security | GitHub encrypts secrets |

Your app is now **secure, scalable, and production-ready!** 🚀

For more: [GitHub Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
