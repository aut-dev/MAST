#!/usr/bin/env node
// One-shot MAST status board: balances, today's commitments vs the
// timelog, and lifetime settlement history. Read-only.

import fs from "fs";
import os from "os";
import path from "path";
import { ethers } from "ethers";

const MAST_DIR = path.join(os.homedir(), ".mast");
const config = JSON.parse(fs.readFileSync(path.join(MAST_DIR, "config.json"), "utf-8"));
const commitments = JSON.parse(fs.readFileSync(path.join(MAST_DIR, "commitments.json"), "utf-8"));
const TIMELOG_FILE = path.join(MAST_DIR, "timelog.jsonl");

function parseTimeTarget(title) {
  const m = title.match(/^(.+?)\s*—\s*(\d+)\s*min/i);
  return m ? { project: m[1].trim().toLowerCase(), targetMinutes: parseInt(m[2], 10) } : null;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutesLogged(project, isoDate) {
  if (!fs.existsSync(TIMELOG_FILE)) return { mins: 0, running: false };
  let mins = 0, running = false;
  for (const line of fs.readFileSync(TIMELOG_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.project !== project || e.start.slice(0, 10) !== isoDate) continue;
    if (!e.stop) running = true;
    mins += ((e.stop ? new Date(e.stop) : new Date()) - new Date(e.start)) / 60000;
  }
  return { mins, running };
}

const provider = new ethers.JsonRpcProvider(config.rpc || "https://base-rpc.publicnode.com");
const escrow = new ethers.Contract(config.escrowContract, [
  "function getUserInfo(address) view returns (uint256, uint256)",
  "function platformBalance() view returns (uint256)",
], provider);
const usdc = new ethers.Contract("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ["function balanceOf(address) view returns (uint256)"], provider);

const [[escrowAvail, locked], walletBal, platformBal] = await Promise.all([
  escrow.getUserInfo(config.address),
  usdc.balanceOf(config.address),
  escrow.platformBalance(),
]);
const fmt = (v) => (Number(v) / 1e6).toFixed(2);

console.log("═══ MAST STATUS ═══════════════════════════════");
console.log(`Wallet $${fmt(walletBal)}  |  Escrow available $${fmt(escrowAvail)}  |  Locked $${fmt(locked)}`);
console.log(`Total yours: $${fmt(walletBal + escrowAvail + locked)}  |  Platform (forfeits): $${fmt(platformBal)}`);
console.log("");
console.log(`─── Today (${todayIso()}) ──────────────────────`);

const today = todayIso();
let dueToday = 0, doneToday = 0;
for (const c of Object.values(commitments)) {
  if (c.status !== "active") continue;
  const t = parseTimeTarget(c.title);
  const deadline = new Date(c.deadline_utc);
  const hoursLeft = ((deadline - Date.now()) / 3600000).toFixed(1);
  if (t && c.period_date === today) {
    const { mins, running } = minutesLogged(t.project, today);
    const done = mins >= t.targetMinutes;
    if (done) doneToday += 1;
    dueToday += 1;
    const bar = "█".repeat(Math.min(20, Math.round((mins / t.targetMinutes) * 20))).padEnd(20, "░");
    console.log(
      `${done ? "✓" : running ? "▶" : "·"} ${c.title.padEnd(28)} ${bar} ${mins.toFixed(0)}/${t.targetMinutes}m  $${c.amount_usd}  [${c.strictness}] ${hoursLeft}h left`
    );
  } else {
    console.log(`· ${c.title.padEnd(28)} $${c.amount_usd} [${c.strictness}] — period ${c.period_date || "one-off"}, ${hoursLeft}h left`);
  }
}
console.log(`\n${doneToday}/${dueToday} targets met so far today`);

let returned = 0, forfeited = 0, periods = 0;
for (const c of Object.values(commitments)) {
  for (const h of c.history || []) {
    periods += 1;
    if (h.prorata) { returned += h.prorata.earned; forfeited += h.prorata.forfeited; }
    else returned += c.amount_usd;
  }
  if (c.status === "cancelled") returned += 0; // cancels return in full, not counted as settled periods
}
console.log(`\n─── Lifetime ───────────────────────────────────`);
console.log(`${periods} settled periods  |  $${returned.toFixed(2)} returned  |  $${forfeited.toFixed(2)} forfeited`);
