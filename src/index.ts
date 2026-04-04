import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Run mode: "check" (threshold only) or "update" (periodic + threshold)
const RUN_MODE = process.env.RUN_MODE || "check";

// CES token on Polygon — contract: 0x1Bdf71EDe1a4777dB1EebE7232BcdA20d6FC1610
const DEX_PAIR_ADDRESS = "0x296b95dd0e8b726c4e358b0683ff0b6d675c35e9";
const DEX_API_URL = `https://api.dexscreener.com/latest/dex/pairs/polygon/${DEX_PAIR_ADDRESS}`;

const COINGECKO_API_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=whalebit&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true";

const STATE_FILE = path.join(__dirname, "..", "state.json");
const HISTORY_FILE = path.join(__dirname, "..", "price_history.csv");

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface PriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  source: string;
  timestamp: number;
}

interface AlertThreshold {
  id: string;
  type: "above" | "below";
  price: number;
  label: string;
  triggered: boolean;
}

interface State {
  lastPrice: number;
  lastCheckAt: string;
  thresholds: AlertThreshold[];
}

// ─────────────────────────────────────────────
// PRICE FETCHING
// ─────────────────────────────────────────────

async function fetchFromDexScreener(): Promise<PriceData | null> {
  try {
    const res = await fetch(DEX_API_URL);
    const data = (await res.json()) as any;
    const pair = data?.pairs?.[0];
    if (!pair) return null;

    return {
      price: parseFloat(pair.priceUsd),
      priceChange24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      source: "DEX Screener",
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("DEX Screener failed:", err);
    return null;
  }
}

async function fetchFromCoinGecko(): Promise<PriceData | null> {
  try {
    const res = await fetch(COINGECKO_API_URL);
    const data = (await res.json()) as any;
    const info = data?.whalebit;
    if (!info) return null;

    return {
      price: info.usd,
      priceChange24h: info.usd_24h_change ?? 0,
      volume24h: info.usd_24h_vol ?? 0,
      liquidity: 0,
      source: "CoinGecko",
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("CoinGecko failed:", err);
    return null;
  }
}

async function fetchPrice(): Promise<PriceData> {
  const dex = await fetchFromDexScreener();
  if (dex) return dex;

  const gecko = await fetchFromCoinGecko();
  if (gecko) return gecko;

  throw new Error("All price sources failed");
}

// ─────────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────────

async function sendTelegram(chatId: string, message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error(`Telegram failed [${chatId}]:`, await res.text());
    } else {
      console.log(`Message sent to ${chatId}`);
    }
  } catch (err) {
    console.error(`Telegram error [${chatId}]:`, err);
  }
}

async function broadcast(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not set!");
    return;
  }
  if (TELEGRAM_CHAT_IDS.length === 0) {
    console.error("No TELEGRAM_CHAT_IDS configured!");
    return;
  }
  await Promise.all(TELEGRAM_CHAT_IDS.map((id) => sendTelegram(id, message)));
}

// ─────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatPeriodicUpdate(price: PriceData, state: State): string {
  const emoji = price.priceChange24h >= 0 ? "🟢" : "🔴";
  const sign = price.priceChange24h >= 0 ? "+" : "";
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // Calculate change from last check
  let changeFromLast = "";
  if (state.lastPrice > 0) {
    const pctChange = ((price.price - state.lastPrice) / state.lastPrice) * 100;
    const chSign = pctChange >= 0 ? "+" : "";
    changeFromLast = `\n📌 Since last check: ${chSign}${pctChange.toFixed(2)}% ($${state.lastPrice.toFixed(4)})`;
  }

  return [
    `🐋 <b>CES Price Update</b>`,
    ``,
    `💰 Price: <b>$${price.price.toFixed(4)}</b>`,
    `${emoji} 24h Change: ${sign}${price.priceChange24h.toFixed(2)}%`,
    `📊 24h Volume: $${formatNum(price.volume24h)}`,
    price.liquidity > 0 ? `💧 Liquidity: $${formatNum(price.liquidity)}` : "",
    changeFromLast,
    ``,
    `📡 ${price.source}`,
    `🕐 ${now} IST`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatThresholdAlert(price: PriceData, t: AlertThreshold): string {
  const dir = t.type === "above" ? "📈 ABOVE" : "📉 BELOW";
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return [
    `🚨 <b>CES PRICE ALERT</b>`,
    ``,
    `${dir} $${t.price.toFixed(4)}`,
    `💰 Current: <b>$${price.price.toFixed(4)}</b>`,
    `🏷 ${t.label}`,
    ``,
    `📡 ${price.source}`,
    `🕐 ${now} IST`,
  ].join("\n");
}

// ─────────────────────────────────────────────
// STATE MANAGEMENT (JSON file committed to repo)
// ─────────────────────────────────────────────

function loadState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      lastPrice: 0,
      lastCheckAt: "",
      thresholds: [],
    };
  }
}

function saveState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

// ─────────────────────────────────────────────
// PRICE HISTORY (CSV append)
// ─────────────────────────────────────────────

function logPriceHistory(price: PriceData): void {
  const header = "timestamp,price,change24h,volume24h,liquidity,source\n";
  const row = [
    new Date(price.timestamp).toISOString(),
    price.price.toFixed(6),
    price.priceChange24h.toFixed(2),
    price.volume24h.toFixed(2),
    price.liquidity.toFixed(2),
    price.source,
  ].join(",");

  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, header);
  }

  fs.appendFileSync(HISTORY_FILE, row + "\n");
}

// ─────────────────────────────────────────────
// THRESHOLD CHECKING
// ─────────────────────────────────────────────

async function checkThresholds(price: PriceData, state: State): Promise<boolean> {
  let stateChanged = false;

  for (const t of state.thresholds) {
    const shouldTrigger =
      (t.type === "above" && price.price >= t.price && !t.triggered) ||
      (t.type === "below" && price.price <= t.price && !t.triggered);

    // Reset if price moves 2% past the threshold in the other direction
    const shouldReset =
      (t.type === "above" && price.price < t.price * 0.98 && t.triggered) ||
      (t.type === "below" && price.price > t.price * 1.02 && t.triggered);

    if (shouldTrigger) {
      t.triggered = true;
      stateChanged = true;
      console.log(`🚨 Threshold triggered: ${t.label}`);
      await broadcast(formatThresholdAlert(price, t));
    }

    if (shouldReset) {
      t.triggered = false;
      stateChanged = true;
      console.log(`🔄 Threshold reset: ${t.label}`);
    }
  }

  return stateChanged;
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🐋 CES Price Tracker — Mode: ${RUN_MODE}`);
  console.log(`   Chat IDs: ${TELEGRAM_CHAT_IDS.join(", ") || "NONE"}`);
  console.log(`   Bot token: ${TELEGRAM_BOT_TOKEN ? "✅ Set" : "❌ Missing"}\n`);

  // Fetch price
  const price = await fetchPrice();
  console.log(`💰 CES Price: $${price.price.toFixed(4)} (${price.source})`);

  // Load state
  const state = loadState();

  // Log price history
  logPriceHistory(price);

  // Check thresholds (runs in both modes)
  const thresholdChanged = await checkThresholds(price, state);

  // Send periodic update (only in "update" mode)
  if (RUN_MODE === "update") {
    console.log("📤 Sending periodic update...");
    await broadcast(formatPeriodicUpdate(price, state));
  }

  // Update state
  state.lastPrice = price.price;
  state.lastCheckAt = new Date().toISOString();
  saveState(state);

  // Set GitHub Actions output so the workflow knows if state changed
  const changed = thresholdChanged || state.lastPrice !== price.price;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `state_changed=${changed}\n`);
  }

  console.log("\n✅ Done");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
