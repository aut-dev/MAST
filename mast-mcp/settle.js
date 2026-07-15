#!/usr/bin/env node
// Nightly settlement for MAST recurring time-logged commitments.
// Run just AFTER midnight (launchd 00:01): settles every active daily
// commitment whose period deadline has passed — full return if the
// timelog shows the target met, pro-rata otherwise — then locks the
// next allowed period. Minutes are capped at the period's midnight.
//
// Usage: node settle.js [--dry-run] [--warn]
//   --warn: don't settle; post a macOS notification for any running
//           period that is short of target (run at ~23:45).

import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { ethers } from "ethers";

const MAST_DIR = path.join(os.homedir(), ".mast");
const config = JSON.parse(fs.readFileSync(path.join(MAST_DIR, "config.json"), "utf-8"));
const COMMITMENTS_FILE = path.join(MAST_DIR, "commitments.json");
const TIMELOG_FILE = path.join(MAST_DIR, "timelog.jsonl");
const LOG_FILE = path.join(MAST_DIR, "settle.log");

const DRY = process.argv.includes("--dry-run");
const WARN_ONLY = process.argv.includes("--warn");

const RPC = config.rpc || "https://base-rpc.publicnode.com";
const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(config.privateKey, provider);
const escrow = new ethers.Contract(config.escrowContract, [
  "function deposit(uint256) external",
  "function commit(bytes32, uint256, uint256) external",
  "function complete(bytes32) external",
  "function expire(bytes32) external",
  "function getUserInfo(address) view returns (uint256, uint256)",
], wallet);
const usdc = new ethers.Contract(USDC_ADDR, [
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
], wallet);

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function notify(title, msg) {
  try {
    execSync(`osascript -e 'display notification ${JSON.stringify(msg)} with title ${JSON.stringify(title)} sound name "Glass"'`);
  } catch { /* headless */ }
}

function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTimeTarget(title) {
  const m = title.match(/^(.+?)\s*—\s*(\d+)\s*min/i);
  return m ? { project: m[1].trim().toLowerCase(), targetMinutes: parseInt(m[2], 10) } : null;
}

// Minutes for a project on a date; open/overrunning sessions capped at the
// end of that date so post-midnight work never leaks into the prior period.
function minutesLogged(project, isoDate) {
  if (!fs.existsSync(TIMELOG_FILE)) return 0;
  const dayEnd = new Date(isoDate + "T00:00:00");
  dayEnd.setDate(dayEnd.getDate() + 1);
  let total = 0;
  for (const line of fs.readFileSync(TIMELOG_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.project !== project || e.start.slice(0, 10) !== isoDate) continue;
    const stop = Math.min(e.stop ? new Date(e.stop).getTime() : Date.now(), dayEnd.getTime());
    total += Math.max(0, (stop - new Date(e.start).getTime()) / 60000);
  }
  return total;
}

function isAllowedDay(date, days, vacationDates) {
  if (days && days.length && !days.includes(DAY_KEYS[date.getDay()])) return false;
  if (vacationDates && vacationDates.includes(localIsoDate(date))) return false;
  return true;
}

function nextAllowedDate(from, days, vacationDates) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 366; i++) {
    if (isAllowedDay(d, days, vacationDates)) return d;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

async function ensureAvailable(amount) {
  let [available] = await escrow.getUserInfo(config.address);
  if (available >= amount) return;
  const walletBal = await usdc.balanceOf(config.address);
  if (walletBal <= 0n) return;
  const need = amount - available;
  const depositAmount = walletBal < need ? walletBal : need;
  const allowance = await usdc.allowance(config.address, config.escrowContract);
  if (allowance < depositAmount) await (await usdc.approve(config.escrowContract, depositAmount)).wait();
  await (await escrow.deposit(depositAmount)).wait();
}

async function commitWithRetry(taskId, amount, deadline) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await (await escrow.commit(taskId, amount, deadline)).wait();
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

async function forfeitToPlatform(idBase, amountUsd) {
  const taskId = ethers.id(idBase);
  const latest = await provider.getBlock("latest");
  const deadline = latest.timestamp + 8;
  await commitWithRetry(taskId, ethers.parseUnits(amountUsd.toFixed(2), 6), deadline);
  for (let i = 0; i < 30; i++) {
    const b = await provider.getBlock("latest");
    if (b.timestamp > deadline) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return (await (await escrow.expire(taskId)).wait()).hash;
}

const commitments = JSON.parse(fs.readFileSync(COMMITMENTS_FILE, "utf-8"));
const now = new Date();
let touched = false;

for (const [id, c] of Object.entries(commitments)) {
  if (c.status !== "active" || c.cadence !== "daily") continue;
  const t = parseTimeTarget(c.title);
  if (!t) continue;

  const deadline = new Date(c.deadline_utc);
  const mins = minutesLogged(t.project, c.period_date);
  const short = Math.max(0, t.targetMinutes - mins);

  if (WARN_ONLY) {
    if (deadline > now && short > 0) {
      log(`WARN ${c.title}: ${mins.toFixed(1)}/${t.targetMinutes} min — ${short.toFixed(0)} short, $${c.amount_usd} at stake`);
      notify("MAST — deadline approaching", `${c.title}: ${short.toFixed(0)} min short. Finish or lose $${(c.amount_usd * short / t.targetMinutes).toFixed(2)} at midnight.`);
    }
    continue;
  }

  if (deadline > now) continue; // period still open — never settle early

  const fraction = Math.max(0, Math.min(1, mins / t.targetMinutes));
  const earned = Math.round(c.amount_usd * fraction * 100) / 100;
  const unearned = Math.round((c.amount_usd - earned) * 100) / 100;

  if (DRY) {
    log(`DRY ${c.title}: ${mins.toFixed(1)}/${t.targetMinutes} min → would return $${earned}, forfeit $${unearned}`);
    continue;
  }

  try {
    log(`SETTLE ${c.title}: ${mins.toFixed(1)}/${t.targetMinutes} min`);
    const completeTx = (await (await escrow.complete(c.taskId)).wait()).hash;

    let forfeitTx = null;
    if (c.forfeit_mode === "prorata" && unearned >= 0.01) {
      forfeitTx = await forfeitToPlatform(id + `-forfeit-${c.period_date}`, unearned);
      log(`  forfeited $${unearned} (${forfeitTx})`);
    }

    c.history = c.history || [];
    c.history.push({
      period_date: c.period_date,
      completed_at: new Date().toISOString(),
      complete_tx: completeTx,
      settled_by: "settle.js",
      ...(forfeitTx ? { prorata: { minutes: Math.round(mins * 10) / 10, target: t.targetMinutes, earned, forfeited: unearned, forfeit_tx: forfeitTx } } : {}),
    });

    const dayAfter = new Date(c.period_date + "T00:00:00");
    dayAfter.setDate(dayAfter.getDate() + 1);
    const nextDate = nextAllowedDate(dayAfter.getTime() > now.getTime() ? dayAfter : now, c.days, c.vacation_dates);
    const nextDeadline = Math.floor(new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate() + 1).getTime() / 1000);
    const amount = ethers.parseUnits(c.amount_usd.toFixed(2), 6);
    await ensureAvailable(amount);
    const nextTaskId = ethers.id(id + `-${localIsoDate(nextDate)}`);
    const receipt = await commitWithRetry(nextTaskId, amount, nextDeadline);

    c.taskId = nextTaskId;
    c.period_date = localIsoDate(nextDate);
    c.deadline_utc = new Date(nextDeadline * 1000).toISOString();
    c.tx_hash = receipt.hash;
    log(`  returned $${earned}, next period ${c.period_date}`);
    notify("MAST — settled", `${c.title}: $${earned} back${unearned >= 0.01 ? `, $${unearned} forfeited` : ""}. Next period locked.`);
    touched = true;
  } catch (e) {
    c.status = "renewal_failed";
    log(`  ERROR ${c.title}: ${e.message}`);
    notify("MAST — settlement error", `${c.title}: ${e.message.slice(0, 120)}`);
    touched = true;
  }
}

if (touched && !DRY) fs.writeFileSync(COMMITMENTS_FILE, JSON.stringify(commitments, null, 2));
log(WARN_ONLY ? "warn pass done" : DRY ? "dry-run done" : "settle pass done");
