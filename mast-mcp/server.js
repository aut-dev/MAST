#!/usr/bin/env node
// MAST dashboard — serves a live, profile-styled view of today's
// commitments, the timelog, and balances. Read-only; never exposes
// the private key. Binds to 0.0.0.0 by default (public), requires
// secret token in URL (?token=...) or Authorization header.
//
// Usage: node server.js [port] [--local-only]
// ENV: MAST_PUBLIC_PORT, MAST_TOKEN (generates random if not set)

import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import crypto from "crypto";
import url from "url";
import { ethers } from "ethers";

const MAST_DIR = path.join(os.homedir(), ".mast");
const TOKEN_FILE = path.join(MAST_DIR, "frontend-token");
const PORT = parseInt(process.env.MAST_PUBLIC_PORT || process.argv[2] || "7777", 10);
const LOCAL_ONLY = process.argv.includes("--local-only");

// Token management: persist across restarts, regenerate with --new-token
function getOrCreateToken() {
  if (process.argv.includes("--new-token")) {
    const token = crypto.randomBytes(24).toString("hex");
    fs.writeFileSync(TOKEN_FILE, token);
    console.log(`Generated new token: ${token}`);
    return token;
  }
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, "utf-8").trim();
  const token = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(TOKEN_FILE, token);
  return token;
}

const TOKEN = process.env.MAST_TOKEN || getOrCreateToken();

const config = JSON.parse(fs.readFileSync(path.join(MAST_DIR, "config.json"), "utf-8"));
const provider = new ethers.JsonRpcProvider(config.rpc || "https://base-rpc.publicnode.com");
const escrow = new ethers.Contract(config.escrowContract, [
  "function getUserInfo(address) view returns (uint256, uint256)",
  "function platformBalance() view returns (uint256)",
], provider);
const usdc = new ethers.Contract("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ["function balanceOf(address) view returns (uint256)"], provider);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(MAST_DIR, file), "utf-8")); }
  catch { return fallback; }
}

function parseTimeTarget(title) {
  const m = title.match(/^(.+?)\s*—\s*(\d+)\s*min/i);
  return m ? { project: m[1].trim().toLowerCase(), targetMinutes: parseInt(m[2], 10) } : null;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutesLogged(project, isoDate) {
  const file = path.join(MAST_DIR, "timelog.jsonl");
  if (!fs.existsSync(file)) return { mins: 0, running: false };
  let mins = 0, running = false;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.project !== project || e.start.slice(0, 10) !== isoDate) continue;
    if (!e.stop) running = true;
    mins += ((e.stop ? new Date(e.stop) : new Date()) - new Date(e.start)) / 60000;
  }
  return { mins, running };
}

let balanceCache = { at: 0, data: null };
async function balances() {
  if (Date.now() - balanceCache.at < 30000 && balanceCache.data) return balanceCache.data;
  const [[avail, locked], wallet, platform] = await Promise.all([
    escrow.getUserInfo(config.address),
    usdc.balanceOf(config.address),
    escrow.platformBalance(),
  ]);
  const f = (v) => Number(v) / 1e6;
  balanceCache = { at: Date.now(), data: { wallet: f(wallet), escrowAvailable: f(avail), locked: f(locked), platform: f(platform) } };
  return balanceCache.data;
}

async function state() {
  const commitments = readJson("commitments.json", {});
  const profile = readJson("profile.json", {});
  const today = todayIso();
  const items = [];
  let returned = 0, forfeited = 0, periods = 0;

  for (const c of Object.values(commitments)) {
    for (const h of c.history || []) {
      periods += 1;
      if (h.prorata) { returned += h.prorata.earned; forfeited += h.prorata.forfeited; }
      else returned += c.amount_usd;
    }
    if (c.status !== "active") continue;
    const t = parseTimeTarget(c.title);
    const log = t && c.period_date === today ? minutesLogged(t.project, today) : { mins: 0, running: false };
    items.push({
      title: c.title,
      amount: c.amount_usd,
      strictness: c.strictness,
      periodDate: c.period_date,
      deadline: c.deadline_utc,
      target: t ? t.targetMinutes : null,
      minutes: Math.round(log.mins * 10) / 10,
      running: log.running,
      done: t ? log.mins >= t.targetMinutes : false,
    });
  }
  items.sort((a, b) => (b.target || 0) - (a.target || 0));
  return { profile, today, items, lifetime: { periods, returned, forfeited }, balances: await balances() };
}

const HTML = () => {
  const p = readJson("profile.json", {});
  const primary = p.primaryColor || "#4ade80";
  const bg = p.backgroundColor || "#0a0a0f";
  const text = p.textColor || "#e0e0e8";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MAST</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${bg}; color:${text}; font-family:${p.font === "mono" ? "'SF Mono', Menlo, monospace" : "system-ui, sans-serif"}; padding:2rem; max-width:780px; margin:0 auto; }
  h1 { font-size:1rem; letter-spacing:.35em; text-transform:uppercase; color:${primary}; margin-bottom:.3rem; }
  .date { opacity:.4; font-size:.8rem; margin-bottom:2rem; }
  .balances { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:2rem; }
  .bal { flex:1; min-width:140px; border:1px solid ${primary}22; border-radius:8px; padding:1rem; background:${primary}08; }
  .bal .v { font-size:1.4rem; font-weight:700; color:${primary}; }
  .bal .l { font-size:.7rem; opacity:.5; text-transform:uppercase; letter-spacing:.1em; margin-top:.3rem; }
  .item { border:1px solid ${primary}18; border-radius:8px; padding:1rem 1.2rem; margin-bottom:.8rem; }
  .item .row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.5rem; }
  .item .t { font-weight:600; }
  .item .meta { font-size:.75rem; opacity:.5; }
  .track { height:8px; border-radius:4px; background:${primary}15; overflow:hidden; }
  .fill { height:100%; background:${primary}; border-radius:4px; transition:width .6s; }
  .done .fill { background:${primary}; }
  .done .t::after { content:" ✓"; color:${primary}; }
  .running .t::after { content:" ▶"; color:${primary}; animation:pulse 1.5s infinite; }
  @keyframes pulse { 50% { opacity:.3; } }
  .lifetime { margin-top:2rem; font-size:.85rem; opacity:.6; }
  .mantra { margin-top:3rem; text-align:center; font-style:italic; letter-spacing:.2em; opacity:.35; font-size:.85rem; }
</style></head>
<body>
  <h1>MAST</h1>
  <div class="date" id="date"></div>
  <div class="balances" id="balances"></div>
  <div id="items"></div>
  <div class="lifetime" id="lifetime"></div>
  <div class="mantra">${p.personalMantra || ""}</div>
<script>
async function refresh() {
  const s = await (await fetch("/api/state")).json();
  document.getElementById("date").textContent = s.today + " — " + new Date().toLocaleTimeString();
  const b = s.balances;
  document.getElementById("balances").innerHTML = [
    ["$" + b.locked.toFixed(2), "locked today"],
    ["$" + (b.wallet + b.escrowAvailable).toFixed(2), "available"],
    ["$" + s.lifetime.forfeited.toFixed(2), "forfeited (lifetime)"],
  ].map(([v,l]) => '<div class="bal"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>').join("");
  document.getElementById("items").innerHTML = s.items.map(i => {
    const pct = i.target ? Math.min(100, i.minutes / i.target * 100) : 0;
    const cls = i.done ? "done" : i.running ? "running" : "";
    const hoursLeft = ((new Date(i.deadline) - Date.now()) / 3600000).toFixed(1);
    return '<div class="item '+cls+'"><div class="row"><span class="t">'+i.title+'</span>' +
      '<span class="meta">$'+i.amount+' · '+i.strictness+' · '+hoursLeft+'h left</span></div>' +
      (i.target ? '<div class="track"><div class="fill" style="width:'+pct+'%"></div></div>' +
      '<div class="meta" style="margin-top:.4rem">'+i.minutes.toFixed(0)+' / '+i.target+' min</div>' : "") +
      '</div>';
  }).join("");
  document.getElementById("lifetime").textContent =
    s.lifetime.periods + " settled periods · $" + s.lifetime.returned.toFixed(2) +
    " returned · $" + s.lifetime.forfeited.toFixed(2) + " forfeited";
}
refresh(); setInterval(refresh, 5000);
</script>
</body></html>`;
};

function checkToken(req) {
  const u = new url.URL(req.url, `http://${req.headers.host}`);
  const tokenParam = u.searchParams.get("token");
  const authHeader = req.headers.authorization?.split(" ")[1];
  const provided = tokenParam || authHeader;
  return provided === TOKEN;
}

http.createServer(async (req, res) => {
  try {
    // All routes require token unless --local-only and on loopback
    const fromLoopback = req.socket.remoteAddress === "127.0.0.1" || req.socket.remoteAddress === "::1";
    if (!LOCAL_ONLY || !fromLoopback) {
      if (!checkToken(req)) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized: missing or invalid token");
        return;
      }
    }

    if (req.url.startsWith("/api/state")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(await state()));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HTML());
    }
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e.message));
  }
}).listen(PORT, LOCAL_ONLY ? "127.0.0.1" : "0.0.0.0", () => {
  const bind = LOCAL_ONLY ? "127.0.0.1" : "0.0.0.0";
  const url_local = `http://localhost:${PORT}`;
  const url_public = `http://<your-ip>:${PORT}?token=${TOKEN}`;
  console.log(`MAST dashboard:`);
  console.log(`  Local:  ${url_local}`);
  console.log(`  Public: ${url_public}`);
  console.log(`  Token:  ${TOKEN}`);
  console.log(`  Binding to: ${bind}:${PORT}`);
});
