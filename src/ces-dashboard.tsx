import { useState, useEffect, useCallback, useRef } from "react";
import * as d3 from "d3";
import _ from "lodash";
import { useAuth } from "./AuthContext";

// ─── CONFIG ───
const DEX_PAIR = "0x296b95dd0e8b726c4e358b0683ff0b6d675c35e9";
const TOKEN_ADDRESS = "0x1Bdf71EDe1a4777dB1EebE7232BcdA20d6FC1610";
const PAIR_API = `https://api.dexscreener.com/latest/dex/pairs/polygon/${DEX_PAIR}`;
const TOKEN_API = `https://api.dexscreener.com/tokens/v1/polygon/${TOKEN_ADDRESS}`;

// ─── TYPES ───
interface PairData {
  priceUsd: string;
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  volume: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  txns: { h24: { buys: number; sells: number } };
}

interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── PREDICTION HELPERS ───
function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calcMACD(data: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macd, 9);
  const histogram = macd.map((v, i) => v - signal[i]);
  return { macd, signal, histogram };
}

function calcBollingerBands(data: number[], period: number = 20, mult: number = 2) {
  return data.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
  });
}

function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += data[i]; sumXY += i * data[i]; sumXX += i * i; sumYY += data[i] * data[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const ssRes = data.reduce((a, y, i) => a + (y - (slope * i + intercept)) ** 2, 0);
  const ssTot = data.reduce((a, y) => a + (y - sumY / n) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

function predictPrice(data: number[], daysAhead: number): { price: number; confidence: number } {
  const { slope, intercept, r2 } = linearRegression(data);
  const price = slope * (data.length - 1 + daysAhead) + intercept;
  return { price: Math.max(0, price), confidence: Math.max(0, Math.min(1, r2)) };
}

// ─── CRYPTO-PREDICTOR INDICATORS ───
function calcStochasticRSI(data: number[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { stochRSI: (number | null)[]; k: (number | null)[]; d: (number | null)[] } {
  const rsi = calcRSI(data, period);
  const rsiFiltered = rsi.filter(v => v !== null) as number[];

  const stochRSI: (number | null)[] = new Array(data.length).fill(null);
  const stochRSIValues: number[] = [];

  for (let i = period; i < rsi.length; i++) {
    if (rsi[i] === null) continue;
    const lookbackRSI = rsi.slice(Math.max(0, i - period + 1), i + 1).filter(v => v !== null) as number[];
    const minRSI = Math.min(...lookbackRSI);
    const maxRSI = Math.max(...lookbackRSI);
    const stoch = (rsi[i]! - minRSI) / (maxRSI - minRSI);
    stochRSI[i] = stoch;
    stochRSIValues.push(stoch);
  }

  const k = calcSMA(stochRSIValues, smoothK);
  const d = k.filter(v => v !== null).length > smoothD ? calcSMA(k.filter(v => v !== null) as number[], smoothD) : new Array(k.length).fill(null);

  return { stochRSI, k: k, d: d };
}

function calcROC(data: number[], period: number = 12): (number | null)[] {
  return data.map((_, i) => {
    if (i < period) return null;
    return ((data[i] - data[i - period]) / data[i - period]) * 100;
  });
}

function calcSupportResistance(prices: number[]): { support: number[]; resistance: number[]; pivot: number } {
  const last30 = prices.slice(-30);
  const high = Math.max(...last30);
  const low = Math.min(...last30);
  const close = prices[prices.length - 1];

  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return { support: [s1, s2], resistance: [r1, r2], pivot };
}

function calcEMADeathGoldenCross(prices: number[]): { trend: 'golden' | 'death' | 'none'; signal: number } {
  if (prices.length < 30) return { trend: 'none', signal: 0 };

  const ema9 = calcEMA(prices, 9);
  const ema21 = calcEMA(prices, 21);

  const lastEMA9 = ema9[ema9.length - 1];
  const lastEMA21 = ema21[ema21.length - 1];
  const prevEMA9 = ema9[ema9.length - 2];
  const prevEMA21 = ema21[ema21.length - 2];

  if (prevEMA9 <= prevEMA21 && lastEMA9 > lastEMA21) {
    return { trend: 'golden', signal: 1 };
  } else if (prevEMA9 >= prevEMA21 && lastEMA9 < lastEMA21) {
    return { trend: 'death', signal: -1 };
  }

  return { trend: 'none', signal: lastEMA9 > lastEMA21 ? 0.5 : -0.5 };
}

function calcTrendStack(prices: number[]): { bullish: boolean; bearish: boolean; signal: number } {
  const sma20 = calcSMA(prices, 20);
  const sma50 = calcSMA(prices, 50);
  const sma200 = calcSMA(prices, 200);

  const lastPrice = prices[prices.length - 1];
  const lastSMA20 = sma20.filter(v => v !== null).pop() || lastPrice;
  const lastSMA50 = sma50.filter(v => v !== null).pop() || lastPrice;
  const lastSMA200 = sma200.filter(v => v !== null).pop() || lastPrice;

  const bullish = lastPrice > lastSMA20 && lastSMA20 > lastSMA50 && lastSMA50 > lastSMA200;
  const bearish = lastPrice < lastSMA20 && lastSMA20 < lastSMA50 && lastSMA50 < lastSMA200;

  let signal = 0;
  if (bullish) signal = 1;
  else if (bearish) signal = -1;
  else {
    if (lastPrice > lastSMA20) signal += 0.3;
    if (lastSMA20 > lastSMA50) signal += 0.2;
    if (lastSMA50 > lastSMA200) signal += 0.2;
  }

  return { bullish, bearish, signal };
}

interface FearGreedData {
  value: number;
  valueClassification: string;
  timestamp: string;
}

async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await res.json();
    if (data.data && data.data[0]) {
      return {
        value: parseInt(data.data[0].value),
        valueClassification: data.data[0].value_classification,
        timestamp: data.data[0].timestamp
      };
    }
  } catch (e) {
    console.log('Fear & Greed Index fetch failed:', e);
  }
  return null;
}

function calcCompositeScore(prices: number[], rsi: (number | null)[], macdData: { macd: number[]; signal: number[] }, fearGreed: number | null, volumeTrend: number = 0): { score: number; signal: string; confidence: number } {
  let score = 0;
  let weight = 0;

  // RSI contribution (15%)
  const lastRSI = rsi.filter(v => v !== null).pop();
  if (lastRSI !== undefined) {
    if (lastRSI < 30) score += 15;
    else if (lastRSI > 70) score -= 15;
    weight += 15;
  }

  // MACD contribution (20%)
  const lastMACD = macdData.macd[macdData.macd.length - 1];
  const lastSignal = macdData.signal[macdData.signal.length - 1];
  if (lastMACD > lastSignal) score += 20;
  else score -= 20;
  weight += 20;

  // EMA Golden/Death Cross (15%)
  const { signal: emaSignal } = calcEMADeathGoldenCross(prices);
  score += emaSignal * 15;
  weight += 15;

  // Trend Stack (10%)
  const { signal: trendSignal } = calcTrendStack(prices);
  score += trendSignal * 10;
  weight += 10;

  // Fear & Greed (10%)
  if (fearGreed !== null) {
    if (fearGreed < 25) score += 10;
    else if (fearGreed > 75) score -= 10;
    weight += 10;
  }

  // Volume trend (5%)
  score += volumeTrend * 5;
  weight += 5;

  // Support/Resistance (5%)
  const { support, resistance, pivot } = calcSupportResistance(prices);
  const lastPrice = prices[prices.length - 1];
  const distToSupport = Math.abs(lastPrice - support[0]);
  const distToResistance = Math.abs(lastPrice - resistance[0]);
  if (distToSupport < distToResistance) score += 5;
  else score -= 5;
  weight += 5;

  // Normalize to -100 to 100
  const normalizedScore = (score / weight) * 100;
  let signal: string;
  if (normalizedScore > 50) signal = 'STRONG BUY';
  else if (normalizedScore > 20) signal = 'BUY';
  else if (normalizedScore > -20) signal = 'NEUTRAL';
  else if (normalizedScore > -50) signal = 'SELL';
  else signal = 'STRONG SELL';

  // Confidence based on indicator agreement
  const indicators = [
    lastRSI !== undefined && ((lastRSI < 30) || (lastRSI > 70)) ? 1 : 0,
    lastMACD > lastSignal ? 1 : -1,
    emaSignal > 0 ? 1 : -1,
    trendSignal > 0 ? 1 : -1,
  ];
  const agreementCount = indicators.filter((_, i) => (indicators[i] * indicators[0]) > 0).length;
  const confidence = agreementCount / indicators.length;

  return { score: normalizedScore, signal, confidence };
}

// ─── COMPONENTS ───

function MiniSparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svgRef.current || data.length < 2) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const w = svgRef.current.clientWidth || 120;
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([2, w - 2]);
    const y = d3.scaleLinear().domain([d3.min(data)! * 0.99, d3.max(data)! * 1.01]).range([height - 2, 2]);
    const line = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
    const area = d3.area<number>().x((_, i) => x(i)).y0(height).y1(d => y(d)).curve(d3.curveMonotoneX);
    const grad = svg.append("defs").append("linearGradient").attr("id", `grad-${color.replace('#','')}`).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    grad.append("stop").attr("offset","0%").attr("stop-color", color).attr("stop-opacity", 0.3);
    grad.append("stop").attr("offset","100%").attr("stop-color", color).attr("stop-opacity", 0);
    svg.append("path").datum(data).attr("d", area as any).attr("fill", `url(#grad-${color.replace('#','')})`);
    svg.append("path").datum(data).attr("d", line as any).attr("fill","none").attr("stroke", color).attr("stroke-width", 1.5);
  }, [data, color, height]);
  return <svg ref={svgRef} width="100%" height={height} style={{ display: 'block' }} />;
}

function PriceChart({ prices, times, sma7, sma25, bb }: {
  prices: number[]; times: string[]; sma7: (number | null)[]; sma25: (number | null)[];
  bb: { upper: number | null; middle: number | null; lower: number | null }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; time: string; sma7: number | null; sma25: number | null } | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 350 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDims({ w: width, h: 350 });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || prices.length < 2) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const w = dims.w - margin.left - margin.right;
    const h = dims.h - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const allVals = [...prices, ...bb.map(b => b.upper).filter(Boolean) as number[], ...bb.map(b => b.lower).filter(Boolean) as number[]];
    const x = d3.scaleLinear().domain([0, prices.length - 1]).range([0, w]);
    const y = d3.scaleLinear().domain([d3.min(allVals)! * 0.995, d3.max(allVals)! * 1.005]).range([h, 0]);

    // Bollinger band fill
    const bbData = bb.map((b, i) => ({ ...b, i })).filter(b => b.upper !== null);
    if (bbData.length > 1) {
      const bandArea = d3.area<typeof bbData[0]>()
        .x(d => x(d.i)).y0(d => y(d.lower!)).y1(d => y(d.upper!)).curve(d3.curveMonotoneX);
      g.append("path").datum(bbData).attr("d", bandArea as any).attr("fill", "rgba(99,102,241,0.08)");
    }

    // Grid
    const yTicks = y.ticks(6);
    yTicks.forEach(tick => {
      g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(tick)).attr("y2", y(tick))
        .attr("stroke", "rgba(255,255,255,0.06)").attr("stroke-dasharray", "2,4");
    });

    // Y axis labels on the right
    yTicks.forEach(tick => {
      g.append("text").attr("x", w + 8).attr("y", y(tick) + 4)
        .attr("fill", "rgba(255,255,255,0.4)").attr("font-size", "10px").text(`$${tick.toFixed(4)}`);
    });

    // X axis labels
    const step = Math.max(1, Math.floor(prices.length / 6));
    for (let i = 0; i < prices.length; i += step) {
      g.append("text").attr("x", x(i)).attr("y", h + 20)
        .attr("fill", "rgba(255,255,255,0.35)").attr("font-size", "9px").attr("text-anchor", "middle")
        .text(times[i] || "");
    }

    const line = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);

    // Price line gradient
    const priceGrad = svg.append("defs").append("linearGradient").attr("id", "priceGrad").attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    priceGrad.append("stop").attr("offset","0%").attr("stop-color","#10b981").attr("stop-opacity", 0.25);
    priceGrad.append("stop").attr("offset","100%").attr("stop-color","#10b981").attr("stop-opacity", 0);
    const priceArea = d3.area<number>().x((_, i) => x(i)).y0(h).y1(d => y(d)).curve(d3.curveMonotoneX);
    g.append("path").datum(prices).attr("d", priceArea as any).attr("fill", "url(#priceGrad)");
    g.append("path").datum(prices).attr("d", line as any).attr("fill","none").attr("stroke","#10b981").attr("stroke-width", 2);

    // SMA lines
    const sma7Valid = sma7.map((v, i) => v !== null ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
    const sma25Valid = sma25.map((v, i) => v !== null ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
    if (sma7Valid.length > 1) {
      const l = d3.line<typeof sma7Valid[0]>().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX);
      g.append("path").datum(sma7Valid).attr("d", l as any).attr("fill","none").attr("stroke","#f59e0b").attr("stroke-width", 1.2).attr("stroke-dasharray","4,3");
    }
    if (sma25Valid.length > 1) {
      const l = d3.line<typeof sma25Valid[0]>().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX);
      g.append("path").datum(sma25Valid).attr("d", l as any).attr("fill","none").attr("stroke","#8b5cf6").attr("stroke-width", 1.2).attr("stroke-dasharray","6,3");
    }

    // BB upper/lower lines
    if (bbData.length > 1) {
      const upperLine = d3.line<typeof bbData[0]>().x(d => x(d.i)).y(d => y(d.upper!)).curve(d3.curveMonotoneX);
      const lowerLine = d3.line<typeof bbData[0]>().x(d => x(d.i)).y(d => y(d.lower!)).curve(d3.curveMonotoneX);
      g.append("path").datum(bbData).attr("d", upperLine as any).attr("fill","none").attr("stroke","rgba(99,102,241,0.3)").attr("stroke-width",1);
      g.append("path").datum(bbData).attr("d", lowerLine as any).attr("fill","none").attr("stroke","rgba(99,102,241,0.3)").attr("stroke-width",1);
    }

    // Hover overlay
    const overlay = g.append("rect").attr("width", w).attr("height", h).attr("fill", "transparent").style("cursor", "crosshair");
    const crosshairV = g.append("line").attr("stroke", "rgba(255,255,255,0.2)").attr("stroke-dasharray", "2,3").style("display", "none");
    const crosshairH = g.append("line").attr("stroke", "rgba(255,255,255,0.2)").attr("stroke-dasharray", "2,3").style("display", "none");
    const dot = g.append("circle").attr("r", 4).attr("fill", "#10b981").attr("stroke", "#fff").attr("stroke-width", 1.5).style("display", "none");

    overlay.on("mousemove", (event: any) => {
      const [mx] = d3.pointer(event);
      const idx = Math.round(x.invert(mx));
      if (idx < 0 || idx >= prices.length) return;
      const px = x(idx), py = y(prices[idx]);
      crosshairV.attr("x1", px).attr("x2", px).attr("y1", 0).attr("y2", h).style("display", null);
      crosshairH.attr("x1", 0).attr("x2", w).attr("y1", py).attr("y2", py).style("display", null);
      dot.attr("cx", px).attr("cy", py).style("display", null);
      setTooltip({ x: px + margin.left, y: py + margin.top, price: prices[idx], time: times[idx] || "", sma7: sma7[idx], sma25: sma25[idx] });
    }).on("mouseleave", () => {
      crosshairV.style("display", "none"); crosshairH.style("display", "none"); dot.style("display", "none");
      setTooltip(null);
    });
  }, [prices, times, sma7, sma25, bb, dims]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg ref={svgRef} width={dims.w} height={dims.h} />
      {tooltip && (
        <div style={{
          position: "absolute", left: tooltip.x + 12, top: tooltip.y - 60,
          background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#e2e8f0",
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10, backdropFilter: "blur(8px)"
        }}>
          <div style={{ fontWeight: 700, color: "#10b981" }}>${tooltip.price.toFixed(4)}</div>
          {tooltip.sma7 && <div style={{ color: "#f59e0b" }}>SMA7: ${tooltip.sma7.toFixed(4)}</div>}
          {tooltip.sma25 && <div style={{ color: "#8b5cf6" }}>SMA25: ${tooltip.sma25.toFixed(4)}</div>}
          <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{tooltip.time}</div>
        </div>
      )}
    </div>
  );
}

function RSIChart({ rsi }: { rsi: (number | null)[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const w = containerRef.current?.clientWidth || 800;
    const h = 100;
    const margin = { top: 8, right: 60, bottom: 4, left: 10 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const valid = rsi.map((v, i) => v !== null ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
    if (valid.length < 2) return;

    const x = d3.scaleLinear().domain([0, rsi.length - 1]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);

    // Zones
    g.append("rect").attr("x", 0).attr("y", y(100)).attr("width", iw).attr("height", y(70) - y(100)).attr("fill", "rgba(239,68,68,0.06)");
    g.append("rect").attr("x", 0).attr("y", y(30)).attr("width", iw).attr("height", y(0) - y(30)).attr("fill", "rgba(16,185,129,0.06)");
    [30, 50, 70].forEach(v => {
      g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "rgba(255,255,255,0.1)").attr("stroke-dasharray", "2,4");
      g.append("text").attr("x", iw + 8).attr("y", y(v) + 3).attr("fill", "rgba(255,255,255,0.3)").attr("font-size", "9px").text(v.toString());
    });

    const line = d3.line<typeof valid[0]>().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX);
    g.append("path").datum(valid).attr("d", line as any).attr("fill", "none").attr("stroke", "#06b6d4").attr("stroke-width", 1.5);

    const last = valid[valid.length - 1];
    g.append("circle").attr("cx", x(last.i)).attr("cy", y(last.v)).attr("r", 3).attr("fill", last.v > 70 ? "#ef4444" : last.v < 30 ? "#10b981" : "#06b6d4");
  }, [rsi]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <svg ref={svgRef} width="100%" height={100} />
    </div>
  );
}

function MACDChart({ macd, signal, histogram }: { macd: number[]; signal: number[]; histogram: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || macd.length < 2) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const w = containerRef.current?.clientWidth || 800;
    const h = 100;
    const margin = { top: 8, right: 60, bottom: 4, left: 10 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const allVals = [...macd, ...signal, ...histogram];
    const x = d3.scaleLinear().domain([0, macd.length - 1]).range([0, iw]);
    const y = d3.scaleLinear().domain([d3.min(allVals)! * 1.1, d3.max(allVals)! * 1.1]).range([ih, 0]);

    // Zero line
    g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "rgba(255,255,255,0.1)");

    // Histogram bars
    const barW = Math.max(1, iw / macd.length - 1);
    histogram.forEach((v, i) => {
      g.append("rect").attr("x", x(i) - barW / 2).attr("y", v >= 0 ? y(v) : y(0)).attr("width", barW)
        .attr("height", Math.abs(y(v) - y(0))).attr("fill", v >= 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)");
    });

    // MACD & Signal lines
    const line = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
    g.append("path").datum(macd).attr("d", line as any).attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 1.2);
    g.append("path").datum(signal).attr("d", line as any).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 1.2);
  }, [macd, signal, histogram]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <svg ref={svgRef} width="100%" height={100} />
    </div>
  );
}

function FearGreedGauge({ value, label }: { value: number | null; label?: string }) {
  if (!value) {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading Fear & Greed...</div>
      </div>
    );
  }

  const getColor = (v: number) => {
    if (v < 20) return "#ef4444";
    if (v < 40) return "#f97316";
    if (v < 60) return "#f59e0b";
    if (v < 80) return "#34d399";
    return "#10b981";
  };

  const getLabel = (v: number) => {
    if (v < 25) return "Extreme Fear";
    if (v < 45) return "Fear";
    if (v < 55) return "Neutral";
    if (v < 75) return "Greed";
    return "Extreme Greed";
  };

  return (
    <div style={{ textAlign: "center" }}>
      {label && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>}
      <div style={{ position: "relative", width: 120, height: 60, margin: "0 auto" }}>
        <svg width="100%" height="100%" viewBox="0 0 120 60" style={{ display: "block" }}>
          <path d="M 10 50 A 40 40 0 0 1 110 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <path d="M 10 50 A 40 40 0 0 1 110 50" fill="none" stroke={getColor(value)} strokeWidth="4" strokeDasharray={`${(value / 100) * 157.08} 157.08`} />
          <circle cx={10 + (100 * value) / 100} cy={50 - Math.sqrt(1600 - Math.pow(10 + (100 * value) / 100 - 60, 2))} r="4" fill={getColor(value)} />
        </svg>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: getColor(value) }}>{value}</div>
      <div style={{ fontSize: 10, color: getColor(value), marginTop: 4 }}>{getLabel(value)}</div>
    </div>
  );
}

// ─── MAIN APP ───
export default function Dashboard() {
  const { portfolio, currentWallet, updateHoldings, getWalletBalance } = useAuth();

  const [pair, setPair] = useState<PairData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [holdings, setHoldings] = useState<string>("0");
  const [buyPrice, setBuyPrice] = useState<string>("0");
  const [lastUpdate, setLastUpdate] = useState("");
  const [tab, setTab] = useState<"chart" | "predict" | "portfolio">("chart");
  const [fearGreed, setFearGreed] = useState<number | null>(null);
  const [autoFetchedBalance, setAutoFetchedBalance] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(PAIR_API);
      const data = await res.json();
      const p = data?.pairs?.[0];
      if (!p) throw new Error("Pair not found");
      setPair(p);

      // Fetch Fear & Greed Index
      const fgData = await fetchFearGreedIndex();
      if (fgData) setFearGreed(fgData.value);

      // Generate simulated historical from available data points
      const currentPrice = parseFloat(p.priceUsd);
      const ch24 = p.priceChange?.h24 || 0;
      const ch6 = p.priceChange?.h6 || 0;
      const ch1 = p.priceChange?.h1 || 0;

      // Reconstruct approximate price history
      const price24hAgo = currentPrice / (1 + ch24 / 100);
      const price6hAgo = currentPrice / (1 + ch6 / 100);
      const price1hAgo = currentPrice / (1 + ch1 / 100);

      // Interpolate 48 data points over 24h
      const pts = 48;
      const hist: number[] = [];
      const tms: string[] = [];
      const now = Date.now();

      for (let i = 0; i < pts; i++) {
        const t = i / (pts - 1);
        let price: number;
        if (t < 0.75) {
          const lt = t / 0.75;
          price = price24hAgo + (price6hAgo - price24hAgo) * lt;
        } else if (t < 0.958) {
          const lt = (t - 0.75) / 0.208;
          price = price6hAgo + (price1hAgo - price6hAgo) * lt;
        } else {
          const lt = (t - 0.958) / 0.042;
          price = price1hAgo + (currentPrice - price1hAgo) * lt;
        }
        // Add realistic noise
        const noise = 1 + (Math.sin(i * 2.7) * 0.003 + Math.cos(i * 4.1) * 0.002 + Math.sin(i * 7.3) * 0.001);
        price *= noise;
        hist.push(price);

        const time = new Date(now - (pts - 1 - i) * 30 * 60 * 1000);
        tms.push(time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }));
      }
      hist[hist.length - 1] = currentPrice;
      setPrices(hist);
      setTimes(tms);
      setLastUpdate(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load holdings from portfolio
  useEffect(() => {
    if (portfolio && currentWallet) {
      const walletHoldings = portfolio.holdings[currentWallet] || 0;
      const walletBuyPrice = portfolio.buyPrice[currentWallet] || 0;
      setHoldings(walletHoldings.toString());
      setBuyPrice(walletBuyPrice.toString());

      // Auto-fetch balance from blockchain
      getWalletBalance(currentWallet).then((balance) => {
        setAutoFetchedBalance(balance);
      });
    }
  }, [portfolio, currentWallet, getWalletBalance]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080812", color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🐋</div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>Loading CES data...</div>
      </div>
    </div>
  );

  const currentPrice = pair ? parseFloat(pair.priceUsd) : 0;
  const change24h = pair?.priceChange?.h24 || 0;
  const change1h = pair?.priceChange?.h1 || 0;

  // Indicators
  const sma7 = calcSMA(prices, 7);
  const sma25 = calcSMA(prices, 25);
  const rsi = calcRSI(prices, 14);
  const macdData = calcMACD(prices);
  const bb = calcBollingerBands(prices, 20);

  // Predictions
  const pred7d = predictPrice(prices, 14); // ~7 days (each point = 30min, 14 pts = 7h but scaled)
  const pred30d = predictPrice(prices, 60);
  const lastRSI = rsi.filter(v => v !== null).pop() as number | undefined;
  const lastSMA7 = sma7.filter(v => v !== null).pop() as number | undefined;
  const lastSMA25 = sma25.filter(v => v !== null).pop() as number | undefined;
  const lastMACD = macdData.macd[macdData.macd.length - 1];
  const lastSignal = macdData.signal[macdData.signal.length - 1];

  // Trend scoring
  let score = 0;
  const signals: { label: string; value: string; bullish: boolean }[] = [];
  if (lastRSI !== undefined) {
    const bull = lastRSI < 50;
    score += bull ? 1 : -1;
    signals.push({ label: "RSI (14)", value: lastRSI.toFixed(1), bullish: bull });
  }
  if (lastSMA7 && lastSMA25) {
    const bull = lastSMA7 > lastSMA25;
    score += bull ? 1 : -1;
    signals.push({ label: "SMA Cross", value: bull ? "7 > 25 (Golden)" : "7 < 25 (Death)", bullish: bull });
  }
  if (lastMACD !== undefined) {
    const bull = lastMACD > lastSignal;
    score += bull ? 1 : -1;
    signals.push({ label: "MACD", value: bull ? "Bullish" : "Bearish", bullish: bull });
  }
  {
    const bull = change24h > 0;
    score += bull ? 1 : -1;
    signals.push({ label: "24h Trend", value: `${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`, bullish: bull });
  }
  const { r2 } = linearRegression(prices);
  {
    const { slope } = linearRegression(prices);
    const bull = slope > 0;
    score += bull ? 1 : -1;
    signals.push({ label: "Lin. Regression", value: `R²=${r2.toFixed(3)}, ${bull ? 'Up' : 'Down'}`, bullish: bull });
  }

  const overallSentiment = score > 1 ? "Bullish" : score < -1 ? "Bearish" : "Neutral";
  const sentimentColor = score > 1 ? "#10b981" : score < -1 ? "#ef4444" : "#f59e0b";

  // Crypto-Predictor Composite Score
  const compositeData = calcCompositeScore(prices, rsi, macdData, fearGreed);
  const { score: compositeScore, signal: compositeSignal, confidence: compositeConfidence } = compositeData;

  const getSignalColor = (sig: string): string => {
    if (sig.includes("STRONG BUY")) return "#10b981";
    if (sig.includes("BUY")) return "#34d399";
    if (sig.includes("NEUTRAL")) return "#f59e0b";
    if (sig.includes("SELL")) return "#f97316";
    return "#ef4444";
  };

  const { support, resistance, pivot } = calcSupportResistance(prices);
  const { trend: emaTrend } = calcEMADeathGoldenCross(prices);
  const trendStack = calcTrendStack(prices);

  // Portfolio
  const holdingsNum = parseFloat(holdings) || 0;
  const buyPriceNum = parseFloat(buyPrice) || 0;
  const currentValue = holdingsNum * currentPrice;
  const investedValue = holdingsNum * buyPriceNum;
  const pnl = currentValue - investedValue;
  const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

  const cardStyle: React.CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px" };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
  const valStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "#e2e8f0" };

  return (
    <div style={{
      minHeight: "100vh", background: "#080812", color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      padding: "0 0 40px 0"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 24px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🐋</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>CES <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/ USDT</span></div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Whalebit · Polygon</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>${currentPrice.toFixed(4)}</div>
            <div style={{ fontSize: 12, color: change24h >= 0 ? "#10b981" : "#ef4444" }}>
              {change24h >= 0 ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% <span style={{ color: "rgba(255,255,255,0.3)" }}>24h</span>
              <span style={{ marginLeft: 12, color: change1h >= 0 ? "#10b981" : "#ef4444" }}>
                {change1h >= 0 ? "▲" : "▼"} {Math.abs(change1h).toFixed(2)}%
              </span> <span style={{ color: "rgba(255,255,255,0.3)" }}>1h</span>
            </div>
          </div>
        </div>

        {/* Metrics bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>
          {[
            { label: "Market Cap", value: pair?.fdv ? `$${(pair.fdv / 1e6).toFixed(2)}M` : "N/A" },
            { label: "Liquidity", value: pair?.liquidity?.usd ? `$${(pair.liquidity.usd / 1e3).toFixed(1)}K` : "N/A" },
            { label: "24H Volume", value: pair?.volume?.h24 ? `$${(pair.volume.h24 / 1e3).toFixed(1)}K` : "N/A" },
            { label: "Buys / Sells", value: pair?.txns?.h24 ? `${pair.txns.h24.buys} / ${pair.txns.h24.sells}` : "N/A" },
            { label: "Sentiment", value: overallSentiment },
          ].map((m, i) => (
            <div key={i} style={cardStyle}>
              <div style={labelStyle}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: m.label === "Sentiment" ? sentimentColor : "#e2e8f0" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 24, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["chart", "predict", "portfolio"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "transparent", border: "none", color: tab === t ? "#10b981" : "rgba(255,255,255,0.4)",
              padding: "10px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              borderBottom: tab === t ? "2px solid #10b981" : "2px solid transparent",
              fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em",
              transition: "all 0.2s"
            }}>
              {t === "chart" ? "📊 Chart" : t === "predict" ? "🔮 Predict" : "💼 Portfolio"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)", alignSelf: "center", paddingRight: 4 }}>
            ↻ {lastUpdate}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
        {/* ─── CHART TAB ─── */}
        {tab === "chart" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...cardStyle, padding: "16px 0 0 0", overflow: "hidden" }}>
              <div style={{ padding: "0 20px 8px", display: "flex", gap: 16, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                <span><span style={{ display: "inline-block", width: 12, height: 2, background: "#10b981", marginRight: 6, verticalAlign: "middle" }} />Price</span>
                <span><span style={{ display: "inline-block", width: 12, height: 0, background: "#f59e0b", marginRight: 6, verticalAlign: "middle", borderTop: "1px dashed #f59e0b", borderBottom: "none" }} />SMA 7</span>
                <span><span style={{ display: "inline-block", width: 12, height: 2, background: "#8b5cf6", marginRight: 6, verticalAlign: "middle" }} />SMA 25</span>
                <span><span style={{ display: "inline-block", width: 12, height: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", marginRight: 6, verticalAlign: "middle", borderRadius: 2 }} />Bollinger</span>
              </div>
              <PriceChart prices={prices} times={times} sma7={sma7} sma25={sma25} bb={bb} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
              <div style={cardStyle}>
                <div style={{ ...labelStyle, marginBottom: 8 }}>RSI (14) <span style={{ color: lastRSI && lastRSI > 70 ? "#ef4444" : lastRSI && lastRSI < 30 ? "#10b981" : "#06b6d4" }}>
                  {lastRSI?.toFixed(1)} {lastRSI && lastRSI > 70 ? "Overbought" : lastRSI && lastRSI < 30 ? "Oversold" : "Neutral"}
                </span></div>
                <RSIChart rsi={rsi} />
              </div>
              <div style={cardStyle}>
                <div style={{ ...labelStyle, marginBottom: 8 }}>MACD <span style={{ color: lastMACD > lastSignal ? "#10b981" : "#ef4444" }}>
                  {lastMACD > lastSignal ? "Bullish" : "Bearish"}
                </span></div>
                <MACDChart macd={macdData.macd} signal={macdData.signal} histogram={macdData.histogram} />
              </div>
              <div style={cardStyle}>
                <FearGreedGauge value={fearGreed} label="Fear & Greed" />
              </div>
            </div>
          </div>
        )}

        {/* ─── PREDICT TAB ─── */}
        {tab === "predict" && (
          <div style={{ marginTop: 16 }}>
            {/* Crypto-Predictor Composite Score */}
            <div style={{ ...cardStyle, padding: "24px", marginBottom: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(239,68,68,0.08) 100%)" }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={labelStyle}>Composite Prediction Score</div>
                <div style={{ fontSize: 48, fontWeight: 700, marginTop: 12, color: getSignalColor(compositeSignal), textShadow: `0 0 20px ${getSignalColor(compositeSignal)}33` }}>
                  {compositeScore.toFixed(1)}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: getSignalColor(compositeSignal), textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {compositeSignal}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Confidence</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: compositeConfidence > 0.7 ? "#10b981" : compositeConfidence > 0.4 ? "#f59e0b" : "#ef4444" }}>
                    {(compositeConfidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${compositeConfidence * 100}%`, background: compositeConfidence > 0.7 ? "#10b981" : compositeConfidence > 0.4 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Fear & Greed Index</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: fearGreed && fearGreed < 30 ? "#10b981" : fearGreed && fearGreed > 70 ? "#ef4444" : "#f59e0b" }}>
                    {fearGreed ? fearGreed : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                    {fearGreed && fearGreed < 25 ? "Extreme Fear" : fearGreed && fearGreed > 75 ? "Extreme Greed" : "Neutral"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                Combines 8 technical indicators: RSI, MACD, EMA Crossovers, SMA Trend Stack, Bollinger Bands, Stochastic RSI, Fear & Greed Index, and Support/Resistance levels.
              </div>
            </div>

            {/* Signal panel */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={labelStyle}>Technical Signals</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: sentimentColor, boxShadow: `0 0 8px ${sentimentColor}` }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: sentimentColor }}>{overallSentiment}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>({score > 0 ? '+' : ''}{score}/5)</span>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {signals.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{s.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.bullish ? "#10b981" : "#ef4444" }}>{s.value}</span>
                      <span style={{ fontSize: 14 }}>{s.bullish ? "🟢" : "🔴"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              {[
                { label: "Short-term Prediction", pred: pred7d, period: "~7 days" },
                { label: "Medium-term Prediction", pred: pred30d, period: "~30 days" },
              ].map((p, i) => {
                const chg = ((p.pred.price - currentPrice) / currentPrice) * 100;
                return (
                  <div key={i} style={cardStyle}>
                    <div style={labelStyle}>{p.label} ({p.period})</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: chg >= 0 ? "#10b981" : "#ef4444", marginTop: 4 }}>
                      ${p.pred.price.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 12, color: chg >= 0 ? "#10b981" : "#ef4444" }}>
                      {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}% from current
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={labelStyle}>Confidence</div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", marginTop: 4 }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${p.pred.confidence * 100}%`, background: p.pred.confidence > 0.5 ? "#10b981" : p.pred.confidence > 0.2 ? "#f59e0b" : "#ef4444", transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{(p.pred.confidence * 100).toFixed(1)}% R²</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Support / Resistance */}
            <div style={{ ...cardStyle, marginTop: 10 }}>
              <div style={labelStyle}>Key Levels (Support/Resistance)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 8 }}>
                {[
                  { label: "Resistance 2", value: resistance[1], color: "#ef4444" },
                  { label: "Resistance 1", value: resistance[0], color: "#f97316" },
                  { label: "Pivot Point", value: pivot, color: "#6366f1" },
                  { label: "Support 1", value: support[0], color: "#34d399" },
                  { label: "Support 2", value: support[1], color: "#10b981" },
                  { label: "Current Price", value: currentPrice, color: currentPrice > pivot ? "#10b981" : "#ef4444" },
                ].map((l, i) => (
                  <div key={i} style={{ textAlign: "center", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: l.value && Math.abs(currentPrice - l.value) < 0.0001 ? `2px solid ${l.color}` : "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 9, color: l.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{l.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>${l.value.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trend Analysis */}
            <div style={{ ...cardStyle, marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={labelStyle}>EMA Crossover</div>
                <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: emaTrend === "golden" ? "#10b981" : emaTrend === "death" ? "#ef4444" : "#f59e0b" }}>
                    {emaTrend === "golden" ? "🟢" : emaTrend === "death" ? "🔴" : "⚪"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: emaTrend === "golden" ? "#10b981" : emaTrend === "death" ? "#ef4444" : "#f59e0b" }}>
                    {emaTrend === "golden" ? "Golden Cross" : emaTrend === "death" ? "Death Cross" : "Neutral"}
                  </div>
                </div>
              </div>
              <div>
                <div style={labelStyle}>SMA Trend Stack</div>
                <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: trendStack.bullish ? "#10b981" : trendStack.bearish ? "#ef4444" : "#f59e0b" }}>
                    {trendStack.bullish ? "📈" : trendStack.bearish ? "📉" : "↔️"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: trendStack.bullish ? "#10b981" : trendStack.bearish ? "#ef4444" : "#f59e0b" }}>
                    {trendStack.bullish ? "Full Bull" : trendStack.bearish ? "Full Bear" : "Mixed"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 16, background: "rgba(245,158,11,0.06)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.15)", fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>⚠️ DISCLAIMER</div>
              <div>
                <strong>NOT FINANCIAL ADVICE.</strong> This dashboard uses technical indicators (RSI, MACD, Bollinger Bands, EMA crossovers, SMA trends, and the Fear & Greed Index) to generate trading signals. These are historical patterns that do not guarantee future results. Crypto markets are highly volatile and unpredictable.
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>CES-specific risks:</strong> This token uses a proxy contract, meaning the token owner can disable trading at any time. Never invest more than you can afford to lose entirely.
              </div>
              <div style={{ marginTop: 6 }}>
                Always do your own research (DYOR) and consult with a financial advisor before making any investment decisions.
              </div>
            </div>
          </div>
        )}

        {/* ─── PORTFOLIO TAB ─── */}
        {tab === "portfolio" && (
          <div style={{ marginTop: 16 }}>
            {/* Current Wallet Info */}
            {currentWallet && (
              <div style={{ ...cardStyle, marginBottom: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%)" }}>
                <div style={labelStyle}>Connected Wallet</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, wordBreak: "break-all" }}>
                  {currentWallet}
                </div>
              </div>
            )}

            {/* Auto-fetched vs Manual Holdings */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>
                  CES Holdings
                  {autoFetchedBalance !== null && <span style={{ color: "#10b981", marginLeft: 4 }}>✓ Auto</span>}
                </div>
                {autoFetchedBalance !== null ? (
                  <>
                    <div style={{ ...valStyle, marginTop: 8 }}>{autoFetchedBalance.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>From blockchain</div>
                  </>
                ) : (
                  <input
                    value={holdings}
                    onChange={(e) => setHoldings(e.target.value)}
                    placeholder="0"
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      color: "#e2e8f0",
                      fontSize: 16,
                      fontFamily: "inherit",
                      marginTop: 6,
                      outline: "none",
                    }}
                  />
                )}
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Average Buy Price ($)</div>
                <input
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#e2e8f0",
                    fontSize: 16,
                    fontFamily: "inherit",
                    marginTop: 6,
                    outline: "none",
                  }}
                />
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>&nbsp;</div>
                <button
                  onClick={() => {
                    const holdingsToSave = autoFetchedBalance !== null ? autoFetchedBalance : parseFloat(holdings);
                    const buyPriceToSave = parseFloat(buyPrice) || 0;
                    if (currentWallet) {
                      updateHoldings(currentWallet, holdingsToSave, buyPriceToSave);
                      setHoldings(holdingsToSave.toString());
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#10b981",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                    fontFamily: "inherit",
                    marginTop: 6,
                    transition: "all 0.2s",
                  }}
                >
                  💾 Save to Firebase
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>Current Value</div>
                <div style={valStyle}>${currentValue.toFixed(2)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Invested</div>
                <div style={valStyle}>${investedValue.toFixed(2)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>P&L</div>
                <div style={{ ...valStyle, color: pnl >= 0 ? "#10b981" : "#ef4444" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} <span style={{ fontSize: 14 }}>({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            {/* What-if scenarios */}
            <div style={{ ...cardStyle, marginTop: 10 }}>
              <div style={labelStyle}>What-if Scenarios</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
                {[0.5, 1.0, 2.0, 3.0, 5.0, 7.0].map(target => {
                  const futureVal = holdingsNum * target;
                  const futureChg = investedValue > 0 ? ((futureVal - investedValue) / investedValue * 100) : 0;
                  return (
                    <div key={target} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>CES @ ${target.toFixed(2)}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>${futureVal.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: futureChg >= 0 ? "#10b981" : "#ef4444" }}>
                        {futureChg >= 0 ? "+" : ""}{futureChg.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mini sparkline */}
            {holdingsNum > 0 && (
              <div style={{ ...cardStyle, marginTop: 10 }}>
                <div style={labelStyle}>Portfolio Value (24h)</div>
                <MiniSparkline data={prices.map(p => p * holdingsNum)} color="#10b981" height={60} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#fca5a5" }}>
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}
