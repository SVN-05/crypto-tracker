# 🐋 CES (Whalebit) Price Tracker

GitHub Actions–powered price tracker for CES/Whalebit on Polygon. Sends alerts to Telegram when price crosses thresholds, plus hourly updates.

**Token:** `0x1Bdf71EDe1a4777dB1EebE7232BcdA20d6FC1610` (Polygon)  
**Pair:** CES/USDT0 on DEX Screener

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  GitHub Actions (cron)                              │
│                                                     │
│  Every 5 min ──► Fetch price ──► Check thresholds   │
│                       │              │              │
│  Every 1 hour ──► Fetch price ──► Send update       │
│                       │              │              │
│                       ▼              ▼              │
│               price_history.csv   Telegram Bot API  │
│               state.json                            │
└─────────────────────────────────────────────────────┘
```

- **price-check.yml** — Runs every 5 min, checks if price crossed any threshold, sends alert if triggered
- **periodic-update.yml** — Runs every hour, sends full price summary to Telegram
- **state.json** — Tracks which thresholds have fired (committed back to repo)
- **price_history.csv** — Append-only log of all price checks

## Setup

### 1. Create a Telegram Bot

1. Open Telegram → search **@BotFather**
2. Send `/newbot`, follow the prompts
3. Copy the **bot token** (e.g. `7123456789:AAG_xxxxx`)
4. Send a message to your bot to activate it

### 2. Get Chat IDs

- DM **@userinfobot** on Telegram → it replies with your chat ID
- For **group chats**: add the bot to the group, then open  
  `https://api.telegram.org/bot<TOKEN>/getUpdates`  
  and find the negative chat ID

### 3. Create GitHub Repo

```bash
# Clone / init
git clone <your-repo> && cd ces-price-tracker

# Or push this project
git init
git remote add origin https://github.com/<you>/ces-price-tracker.git
git add .
git commit -m "init: CES price tracker"
git push -u origin main
```

### 4. Add Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name          | Value                              |
|---------------------|------------------------------------|
| `TELEGRAM_BOT_TOKEN` | `7123456789:AAG_your_bot_token`    |
| `TELEGRAM_CHAT_IDS`  | `111111111,222222222` (comma-separated) |

### 5. Enable Workflows

- Go to **Actions** tab → enable workflows if prompted
- Click **"CES Price Check"** → **"Run workflow"** to test manually

## Customizing Thresholds

Edit `state.json` directly and push:

```json
{
  "lastPrice": 0,
  "lastCheckAt": "",
  "thresholds": [
    { "id": "buy_zone", "type": "below", "price": 0.70, "label": "Buy zone! CES under $0.70", "triggered": false },
    { "id": "target_1", "type": "above", "price": 1.20, "label": "Target 1 hit — $1.20", "triggered": false },
    { "id": "moon", "type": "above", "price": 5.00, "label": "CES mooning past $5!", "triggered": false }
  ]
}
```

Thresholds auto-reset when price moves 2% back past the level, so they can fire again.

## Adjusting Schedules

Edit the `cron` in `.github/workflows/*.yml`:

```yaml
# Every 2 minutes (aggressive)
- cron: "*/2 * * * *"

# Every 15 minutes
- cron: "*/15 * * * *"

# Every 6 hours
- cron: "0 */6 * * *"

# Twice a day at 9 AM and 9 PM IST (3:30 AM / 3:30 PM UTC)
- cron: "30 3,15 * * *"
```

> ⚠️ GitHub Actions cron can have 1–5 min delays during peak load. Not suitable for high-frequency trading.

## Telegram Message Examples

**Hourly Update:**
```
🐋 CES Price Update

💰 Price: $0.8239
🟢 24h Change: +5.23%
📊 24h Volume: $551.00K
💧 Liquidity: $81.00K
📌 Since last check: +0.45% ($0.8202)

📡 DEX Screener
🕐 04/04/2026, 2:00:00 pm IST
```

**Threshold Alert:**
```
🚨 CES PRICE ALERT

📈 ABOVE $1.0000
💰 Current: $1.0234
🏷 CES crossed $1.00

📡 DEX Screener
🕐 04/04/2026, 2:05:00 pm IST
```

## Cost

**$0** — GitHub Actions gives 2,000 free minutes/month for private repos (unlimited for public). This tracker uses ~15 seconds per run, so roughly:
- 5-min checks: ~288 runs/day × 0.25 min = ~72 min/day = ~2,160 min/month
- Hourly updates: ~24 runs/day × 0.25 min = ~6 min/day

For a **private repo**, this is tight. Consider using 10-min intervals or making the repo public for unlimited minutes.

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main tracker logic |
| `state.json` | Threshold state (auto-updated) |
| `price_history.csv` | Price log (auto-appended) |
| `.github/workflows/price-check.yml` | 5-min threshold check |
| `.github/workflows/periodic-update.yml` | Hourly Telegram update |
