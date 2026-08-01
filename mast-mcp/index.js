#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// ── Config paths ──────────────────────────────────────────────────

const MAST_DIR = path.join(os.homedir(), ".mast");
const CONFIG_FILE = path.join(MAST_DIR, "config.json");
const COMMITMENTS_FILE = path.join(MAST_DIR, "commitments.json");
const PROFILE_FILE = path.join(MAST_DIR, "profile.json");
const PAGES_DIR = path.join(MAST_DIR, "pages");

// ── Contract ABI (only the functions we need) ─────────────────────

const ESCROW_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function commit(bytes32 taskId, uint256 amount, uint256 deadline) external",
  "function complete(bytes32 taskId) external",
  "function expire(bytes32 taskId) external",
  "function balances(address) view returns (uint256)",
  "function locked(address) view returns (uint256)",
  "function getUserInfo(address) view returns (uint256 available, uint256 lockedAmount)",
  "function getCommitment(bytes32 taskId) view returns (address user, uint256 amount, uint256 deadline, bool completed, bool expired)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_CONTRACT = "0xb279110b7a7F77344094721Bf4232dE46AFC1C42";
const DEFAULT_NETWORK = "base";

const NETWORKS = {
  "base-sepolia": {
    rpc: "https://sepolia.base.org",
    chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorer: "https://sepolia.basescan.org",
    name: "Base Sepolia (testnet)",
  },
  "base": {
    rpc: "https://base-rpc.publicnode.com",
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    name: "Base",
  },
};

// ── Local state ───────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(MAST_DIR)) fs.mkdirSync(MAST_DIR, { recursive: true });
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadCommitments() {
  if (!fs.existsSync(COMMITMENTS_FILE)) return {};
  return JSON.parse(fs.readFileSync(COMMITMENTS_FILE, "utf-8"));
}

function saveCommitments(commitments) {
  ensureDir();
  fs.writeFileSync(COMMITMENTS_FILE, JSON.stringify(commitments, null, 2));
}

function loadProfile() {
  if (!fs.existsSync(PROFILE_FILE)) return null;
  return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"));
}

function saveProfile(profile) {
  ensureDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

function ensurePages() {
  if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR, { recursive: true });
}

// ── Blockchain helpers ────────────────────────────────────────────

function getProvider(config) {
  const net = NETWORKS[config.network] || NETWORKS["base-sepolia"];
  return new ethers.JsonRpcProvider(config.rpc || net.rpc);
}

function getWallet(config) {
  return new ethers.Wallet(config.privateKey, getProvider(config));
}

function getEscrow(config) {
  return new ethers.Contract(config.escrowContract, ESCROW_ABI, getWallet(config));
}

function getUsdc(config) {
  const net = NETWORKS[config.network] || NETWORKS["base-sepolia"];
  return new ethers.Contract(net.usdc, USDC_ABI, getWallet(config));
}

function formatUsdc(raw) {
  return (Number(raw) / 1e6).toFixed(2);
}

function parseUsdc(dollars) {
  return ethers.parseUnits(dollars.toString(), 6);
}

function taskIdHash(id) {
  return ethers.id(id);
}

// ── Pod mode (CommitmentEscrowV2) ─────────────────────────────────
// Pods live on the V2 contract, separate from the user's solo escrow.
// The MCP acts as ONE pod member (this wallet); every member runs their
// own MCP. Goal names stay local — only integer goalIds go on-chain.

const DEFAULT_POD_CONTRACT = "0xA836A23a939D8BdaF334D0CE0DecfEBF3f01905b";
// publicnode blocks receipt polling without a paid token, so pod ops use a
// receipt-friendly RPC by default. Override with config.podRpc.
const DEFAULT_POD_RPC = "https://mainnet.base.org";
const PODS_FILE = path.join(MAST_DIR, "pods.json");

// ResolutionKind enum in the contract.
const RESOLUTION = { none: 0, winner: 1, charity: 2, anticharity: 3, recall: 4, burn: 5, split: 6, rollover: 7 };
const RESOLUTION_NAME = Object.fromEntries(Object.entries(RESOLUTION).map(([k, v]) => [v, k]));

const POD_ABI = [
  // shared with solo escrow
  "function deposit(uint256) external",
  "function withdraw(uint256) external",
  "function complete(bytes32) external",
  "function expire(bytes32) external",
  "function getUserInfo(address) view returns (uint256, uint256)",
  // solo forfeit plans
  "function setForfeitPlan(address[], uint16[]) external",
  "function clearForfeitPlan() external",
  "function getForfeitPlan(address) view returns (address[], uint16[])",
  "function BURN_ADDRESS() view returns (address)",
  // pods
  "function createPod(bytes32, address[], uint256, uint32, uint64, uint64) external",
  "function commitPod(bytes32, bytes32, uint256, uint256) external",
  "function logProgress(bytes32, uint256, uint16, uint32) external",
  "function votePeriod(bytes32, uint256, uint8, address) external",
  "function votePeriodSplit(bytes32, uint256, uint16[]) external",
  "function resolvePeriod(bytes32, uint256) external",
  "function refundPeriod(bytes32, uint256) external",
  "function periodOf(bytes32, uint256) view returns (uint256)",
  "function periodEnd(bytes32, uint256) view returns (uint256)",
  "function getPod(bytes32) view returns (address[], uint256, uint32, uint64, uint64)",
  "function podPool(bytes32, uint256) view returns (uint256)",
  "function getVote(bytes32, uint256, address) view returns (uint8, address, bool)",
  "function isPodMember(bytes32, address) view returns (bool)",
];

function getPodProvider(config) {
  return new ethers.JsonRpcProvider(config.podRpc || DEFAULT_POD_RPC);
}
function getPodWallet(config) {
  return new ethers.Wallet(config.privateKey, getPodProvider(config));
}
function getPodContract(config) {
  return new ethers.Contract(config.podContract || DEFAULT_POD_CONTRACT, POD_ABI, getPodWallet(config));
}
function getPodUsdc(config) {
  const net = NETWORKS[config.network] || NETWORKS["base"];
  return new ethers.Contract(net.usdc, USDC_ABI, getPodWallet(config));
}
function podContractAddress(config) {
  return config.podContract || DEFAULT_POD_CONTRACT;
}

function loadPods() {
  if (!fs.existsSync(PODS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PODS_FILE, "utf-8"));
}
function savePods(pods) {
  ensureDir();
  fs.writeFileSync(PODS_FILE, JSON.stringify(pods, null, 2));
}
// Deterministic pod id from a human label, so all members derive the same id.
function podIdHash(label) {
  return ethers.id("mastpod:" + label.trim().toLowerCase());
}

// Look up a pod by label or on-chain id (hex). Returns [id, record] or [id, null].
function resolvePod(arg) {
  const pods = loadPods();
  if (arg && arg.startsWith("0x") && arg.length === 66) return [arg, pods[arg] || null];
  const id = podIdHash(arg || "");
  return [id, pods[id] || null];
}

// Retry transient RPC reverts (load-balanced nodes lag a just-mined tx during
// gas estimation). thunk must return a FRESH tx promise each attempt.
async function sendPodTx(thunk) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await (await thunk()).wait();
    } catch (e) {
      const msg = e.shortMessage || e.message || "";
      // Retry only transient lag on load-balanced RPCs. "no such pod" / "not a
      // member" / "waiting for votes" are transient right after the state they
      // depend on was written on another replica; a genuinely wrong pod or
      // non-member just fails after the retries elapse.
      const transient = /waiting for votes|no such pod|not a member|exceeds allowance|insufficient balance|could not coalesce|timeout|SERVER_ERROR|missing revert/i.test(msg);
      if (attempt >= 5 || !transient) throw e;
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}

function fmtDuration(seconds) {
  seconds = Number(seconds);
  if (seconds % 86400 === 0) return `${seconds / 86400} day(s)`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`;
  return `${Math.round(seconds / 60)} min`;
}

// Retry a view call — load-balanced RPCs occasionally drop a read in a burst
// ("missing revert data" with no revert reason).
async function podRead(fn) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= 4) throw e; await new Promise((r) => setTimeout(r, 1200)); }
  }
}

// Ensure `amount` (bigint) is available in the pod contract's escrow for this
// wallet; top up from the wallet's USDC if short.
async function ensurePodAvailable(config, amount) {
  const escrow = getPodContract(config);
  const usdc = getPodUsdc(config);
  const [available] = await escrow.getUserInfo(config.address);
  if (available >= amount) return;
  const need = amount - available;
  const walletBal = await usdc.balanceOf(config.address);
  if (walletBal < need) {
    throw new Error(
      `Not enough USDC. Need $${formatUsdc(need)} more in the pod escrow, ` +
      `wallet holds $${formatUsdc(walletBal)}. Fund ${config.address} with USDC on Base.`
    );
  }
  const spender = podContractAddress(config);
  const allowance = await usdc.allowance(config.address, spender);
  if (allowance < need) await sendPodTx(() => usdc.approve(spender, need));
  await sendPodTx(() => escrow.deposit(need));
}

// ── Recurring schedule helpers ────────────────────────────────────

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isAllowedDay(date, days, vacationDates) {
  if (days && days.length && !days.includes(DAY_KEYS[date.getDay()])) return false;
  if (vacationDates && vacationDates.includes(localIsoDate(date))) return false;
  return true;
}

// First allowed date on or after `from`. Returns a date at local midnight.
function nextAllowedDate(from, days, vacationDates) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 366; i++) {
    if (isAllowedDay(d, days, vacationDates)) return d;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// Deadline for a daily period: midnight at the end of the period's day.
function periodDeadline(periodDate) {
  const end = new Date(periodDate.getFullYear(), periodDate.getMonth(), periodDate.getDate() + 1, 0, 0, 0);
  return Math.floor(end.getTime() / 1000);
}

// ── Time log (written by mast-timer) ──────────────────────────────

const TIMELOG_FILE = path.join(MAST_DIR, "timelog.jsonl");

// "Writing — 20 minutes" → { project: "writing", targetMinutes: 20 }
function parseTimeTarget(title) {
  const m = title.match(/^(.+?)\s*—\s*(\d+)\s*min/i);
  return m ? { project: m[1].trim().toLowerCase(), targetMinutes: parseInt(m[2], 10) } : null;
}

// Total minutes logged for a project on a given local ISO date.
function minutesLogged(project, isoDate) {
  if (!fs.existsSync(TIMELOG_FILE)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(TIMELOG_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.project !== project || e.start.slice(0, 10) !== isoDate) continue;
    const stop = e.stop ? new Date(e.stop) : new Date();
    total += (stop - new Date(e.start)) / 60000;
  }
  return total;
}

// ── MCP Server ────────────────────────────────────────────────────

const server = new Server(
  { name: "mast", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {} } }
);

// ── Tools ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "mast_setup",
      description:
        "First-time MAST setup. Generates a local wallet and configures the escrow contract. " +
        "No arguments needed — uses Base mainnet and the official MAST contract by default. " +
        "Run this before any other MAST tool. If already set up, returns current config.",
      inputSchema: {
        type: "object",
        properties: {
          network: {
            type: "string",
            enum: ["base-sepolia", "base"],
            description: "Network to use. Default: 'base' (mainnet).",
            default: "base",
          },
          escrow_contract: {
            type: "string",
            description: "Address of the CommitmentEscrow contract. Default: official MAST contract on Base.",
          },
          default_strictness: {
            type: "string",
            enum: ["iron", "firm", "moderate", "flexible", "chill"],
            description: "Default strictness for new commitments (can be overridden per task).",
            default: "firm",
          },
        },
      },
    },
    {
      name: "mast_save_profile",
      description:
        "Save the user's personal profile for generating commitment pages. " +
        "The agent should have a conversation with the user to learn about them BEFORE calling this. " +
        "Ask about: their name, what drives them, what they struggle with, their aesthetic preferences. " +
        "Use what you already know about the user from conversation to fill in details. " +
        "This only needs to be called once — the profile is saved permanently.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "User's first name or nickname — what they want to see on their pages.",
          },
          motivation: {
            type: "string",
            description: "A sentence about what drives them, in their own words. e.g. 'I want to be the kind of person who follows through.'",
          },
          primary_color: {
            type: "string",
            description: "Primary accent color as hex. Choose based on their personality/preferences. e.g. '#6366f1'",
          },
          background_color: {
            type: "string",
            description: "Background color as hex. e.g. '#0a0a0f' for dark, '#fafafa' for light.",
          },
          text_color: {
            type: "string",
            description: "Text color as hex. e.g. '#e0e0e8' for dark bg, '#1a1a2e' for light bg.",
          },
          font: {
            type: "string",
            description: "Font preference. e.g. 'serif', 'sans-serif', 'mono', or a specific Google Font name.",
          },
          tone: {
            type: "string",
            description: "The emotional tone for their commitment pages. e.g. 'fierce', 'calm', 'playful', 'stoic', 'warm'.",
          },
          personal_mantra: {
            type: "string",
            description: "A personal mantra or quote that resonates with them. Shown on every commitment page.",
          },
        },
        required: ["name", "motivation", "primary_color", "background_color", "text_color", "tone"],
      },
    },
    {
      name: "mast_fund",
      description:
        "Show the user's wallet address so they can send USDC on Base to fund their account. " +
        "Users send USDC from any wallet (Coinbase, MetaMask, Rainbow, etc). " +
        "Funds sent to this address are auto-deposited into the escrow contract when a commitment is made.",
      inputSchema: {
        type: "object",
        properties: {
          amount_usd: {
            type: "number",
            description: "Suggested funding amount in USD. Shows the recommended amount on the funding page.",
          },
        },
      },
    },
    {
      name: "mast_deposit_to_escrow",
      description:
        "Manually deposit USDC from the wallet into the escrow contract. " +
        "Usually not needed — mast_commit auto-deposits when making a commitment. " +
        "Use this only if you want to deposit without committing.",
      inputSchema: {
        type: "object",
        properties: {
          amount_usd: {
            type: "number",
            description: "Amount in USD to deposit into escrow.",
          },
        },
        required: ["amount_usd"],
      },
    },
    {
      name: "mast_balance",
      description:
        "Check the user's current balance: available for commitments, locked in active commitments, and total.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "mast_commit",
      description:
        "Create a commitment backed by real money. The user's deposit is locked — " +
        "returned on completion, forfeited if the deadline passes. " +
        "Supports one-off and recurring (daily/weekly) commitments. " +
        "For recurring, the deposit amount is per period (e.g. $1/day). " +
        "Auto-deposits wallet funds into the contract if needed. " +
        "USE THIS when the user makes a promise, sets a goal, or says they'll do something.",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "What the user is committing to do.",
          },
          amount_usd: {
            type: "number",
            description: "Deposit amount in USD. For recurring commitments, this is the amount per period.",
          },
          cadence: {
            type: "string",
            enum: ["once", "daily", "weekly"],
            description: "How often this commitment repeats. 'once' = one-off (default). 'daily' = resets at midnight. 'weekly' = resets Monday midnight.",
            default: "once",
          },
          deadline_hours: {
            type: "number",
            description: "Hours from now until the deadline. Default 24. For recurring commitments, this is ignored — deadline is midnight (daily) or Monday midnight (weekly).",
            default: 24,
          },
          strictness: {
            type: "string",
            enum: ["iron", "firm", "moderate", "flexible", "chill"],
            description:
              "How hard it is to back out of THIS commitment. " +
              "'iron' = cannot cancel even if user begs. Late reports not accepted. " +
              "'firm' = hard to back out. Late reports accepted. " +
              "'chill' = cancel anytime (use for stretch goals). " +
              "If omitted, uses the default from setup.",
          },
          message: {
            type: "string",
            description:
              "A personal message for the commitment page, written by you (the agent) for this specific commitment. " +
              "Speak directly to the user. Reference what they told you. Make it real. " +
              "e.g. 'You said mornings are when you feel weakest. This is you fighting back.'",
          },
          days: {
            type: "array",
            items: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
            description:
              "For daily cadence: which days of the week this commitment applies. " +
              "Default: every day. Weekdays only: [\"mon\",\"tue\",\"wed\",\"thu\",\"fri\"]. " +
              "Skipped days are free — no deadline, no money at stake.",
          },
          vacation_dates: {
            type: "array",
            items: { type: "string" },
            description: "ISO dates (YYYY-MM-DD) excluded from a recurring schedule — vacation days with no deadline.",
          },
          start_date: {
            type: "string",
            description: "ISO date (YYYY-MM-DD) for the first period of a recurring commitment. Default: today (or the next allowed day).",
          },
          forfeit_mode: {
            type: "string",
            enum: ["binary", "prorata"],
            default: "binary",
            description:
              "What happens to the stake when a period falls short. 'binary' (default): all-or-nothing. " +
              "'prorata': for recurring TIME-LOGGED commitments only (title like 'Writing — 20 minutes'), " +
              "the earned fraction (minutes logged / target) returns and only the rest forfeits — settled " +
              "when mast_complete is called before the deadline. One-off commitments must stay binary.",
          },
        },
        required: ["title", "amount_usd"],
      },
    },
    {
      name: "mast_complete",
      description:
        "Mark a commitment as completed and return the money to the user's balance. " +
        "USE THIS when you've verified the user actually followed through. " +
        "Ask for evidence before completing: screenshots, links, descriptions of what they did. " +
        "For forfeit_mode 'prorata' commitments, call this BEFORE the deadline even when the " +
        "target wasn't fully met — it settles the period pro-rata from the time log " +
        "(earned fraction returned, rest forfeited). Missing the deadline entirely still forfeits everything.",
      inputSchema: {
        type: "object",
        properties: {
          commitment_id: {
            type: "string",
            description: "The ID of the commitment to complete.",
          },
        },
        required: ["commitment_id"],
      },
    },
    {
      name: "mast_cancel",
      description:
        "Cancel an active commitment and return the money — no forfeit, no renewal. " +
        "GATE THIS BY THE COMMITMENT'S STRICTNESS before calling: " +
        "'iron' = NEVER call this, no exceptions. " +
        "'firm' = push back hard; only call for a genuinely compelling reason. " +
        "'moderate' = ask why once, then respect the answer. " +
        "'flexible' = quick 'are you sure?', then call. " +
        "'chill' = call immediately. " +
        "Always appropriate regardless of strictness when the underlying task no longer exists (e.g. already done, obligation removed).",
      inputSchema: {
        type: "object",
        properties: {
          commitment_id: {
            type: "string",
            description: "The ID of the commitment to cancel.",
          },
          reason: {
            type: "string",
            description: "Why this is being cancelled — recorded on the commitment.",
          },
        },
        required: ["commitment_id", "reason"],
      },
    },
    {
      name: "mast_commitments",
      description:
        "List all active commitments with their deadlines and amounts. " +
        "Shows what the user has on the line right now.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "mast_set_default_strictness",
      description:
        "Set the DEFAULT strictness for new commitments. Each commitment can override this. " +
        "This just saves the user from specifying it every time.",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "string",
            enum: ["iron", "firm", "moderate", "flexible", "chill"],
            description:
              "'iron' = cannot back out. 'firm' = hard to back out. " +
              "'moderate' = one nudge. 'flexible' = quick confirm. 'chill' = instant cancel.",
          },
        },
        required: ["level"],
      },
    },
    {
      name: "mast_withdraw",
      description:
        "Withdraw available funds. Moves USDC from the smart contract back to the wallet. " +
        "Only uncommitted funds can be withdrawn. Use this when the user wants their money back.",
      inputSchema: {
        type: "object",
        properties: {
          amount_usd: {
            type: "number",
            description: "Amount in USD to withdraw from escrow.",
          },
        },
        required: ["amount_usd"],
      },
    },
    {
      name: "mast_set_forfeit_plan",
      description:
        "Set where THIS user's forfeited stakes go on the pod contract (CommitmentEscrowV2). " +
        "By default forfeits go to the platform. A plan routes them to any mix of: an address " +
        "you control, a charity, an anticharity, a burn address, or the MAST project — weighted. " +
        "Weights are in basis points and must sum to 10000 (100%). Pass clear:true to revert to default. " +
        "Note: only affects commitments on the V2 pod contract, not legacy solo commitments.",
      inputSchema: {
        type: "object",
        properties: {
          splits: {
            type: "array",
            description: "Destinations and weights. Omit when clearing.",
            items: {
              type: "object",
              properties: {
                target: { type: "string", description: "Recipient address. Use the burn address 0x000...dEaD to burn." },
                weight_bps: { type: "number", description: "Weight in basis points (100% = 10000)." },
              },
              required: ["target", "weight_bps"],
            },
          },
          clear: { type: "boolean", description: "Revert to the platform default (no plan)." },
        },
      },
    },
    {
      name: "mast_pod_create",
      description:
        "Create an accountability pod on the V2 contract. 2+ members hold each other accountable; " +
        "forfeited stakes pool each period and, on a majority vote, split among the members who hit their " +
        "own target — weighted by how much each staked. The caller must be one of the members. " +
        "All members must independently derive the same pod from the same label, so agree on a label first.",
      inputSchema: {
        type: "object",
        properties: {
          label: { type: "string", description: "Shared human label for the pod (hashed to a deterministic id). All members use the same label." },
          members: { type: "array", items: { type: "string" }, description: "Member wallet addresses (must include your own). At least 2." },
          rate_per_minute_usd: { type: "number", description: "The pod's single $/minute parameter (e.g. 0.2). Informational anchor for stakes." },
          target_minutes: { type: "number", description: "Weekly/period minutes target per member (informational)." },
          period_days: { type: "number", description: "Length of a settlement period in days. Default 7 (weekly)." },
          period_seconds: { type: "number", description: "Override period length in seconds (for testing short periods). Takes precedence over period_days." },
        },
        required: ["label", "members", "rate_per_minute_usd"],
      },
    },
    {
      name: "mast_pod_join",
      description:
        "Join a pod someone else already created — syncs it into your local state so you can stake, log, " +
        "and vote. You must already be one of its members on-chain (the creator includes your address). " +
        "Identify it by the shared label (preferred — it derives the same id for everyone) or the 0x pod id.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Shared pod label (preferred) or 0x pod id." },
          label: { type: "string", description: "Optional label to record locally when joining by raw id." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_commit",
      description:
        "Stake money on a personal goal inside a pod. The goal's NAME stays local (private) — only an " +
        "integer goalId goes on-chain. Auto-deposits from your wallet if the pod escrow is short. If you " +
        "complete it (mast_complete on the returned task id) the stake returns; if it expires it pools for the period.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          goal_name: { type: "string", description: "Private goal name (stored locally only, mapped to an integer goalId)." },
          amount_usd: { type: "number", description: "Amount to stake." },
          deadline_hours: { type: "number", description: "Hours from now until the deadline. Default 24." },
        },
        required: ["pod", "goal_name", "amount_usd"],
      },
    },
    {
      name: "mast_pod_complete",
      description:
        "Complete a pod stake you followed through on — returns the staked USDC to your pod escrow " +
        "balance (withdraw anytime). Identify the stake by task_id, or by goal_name to complete your " +
        "most recent open stake on that goal.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          task_id: { type: "string", description: "The stake's task id (returned by mast_pod_commit)." },
          goal_name: { type: "string", description: "Alternatively, the goal name — completes your most recent open stake on it." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_expire",
      description:
        "Forfeit your own overdue pod stakes into the period's pool — for stakes you did NOT complete. " +
        "Expire a specific task_id, or omit it to expire all your overdue unsettled stakes in the pod. " +
        "This is how missed stakes fund the pool for settlement; each member expires their own.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          task_id: { type: "string", description: "Specific stake to expire. Omit to expire all your overdue unsettled stakes." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_log_progress",
      description:
        "Publicly log a work session toward a pod goal — only the integer goalId, percent complete, and " +
        "minutes go on-chain (never the goal name). Other members' agents read these to compute the split.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          goal_name: { type: "string", description: "Goal name (resolved to its local goalId) — or pass goal_id directly." },
          goal_id: { type: "number", description: "Integer goalId, if known." },
          percent: { type: "number", description: "Percent of the goal complete, 0–100." },
          minutes: { type: "number", description: "Minutes spent this session." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_vote",
      description:
        "Vote on how a finished period's pool is resolved. Normal path: a parimutuel SPLIT — pass shares_bps " +
        "aligned to the pod's member order (summing to 10000), computed as each completer's stake share. " +
        "Anomaly path: pass kind (winner/charity/anticharity/recall/burn/rollover) with an optional target address. " +
        "A strict majority of matching votes resolves the period.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          period: { type: "number", description: "Period index to vote on. Defaults to the most recently ended period." },
          shares_bps: { type: "array", items: { type: "number" }, description: "Split vote: bps per member in member order, summing to 10000." },
          kind: { type: "string", enum: ["winner", "charity", "anticharity", "recall", "burn", "rollover"], description: "Anomaly resolution kind (instead of shares_bps)." },
          target: { type: "string", description: "Target address for kind=winner/charity/anticharity." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_resolve",
      description:
        "Execute the majority resolution for a finished period (pays out the pool), or trigger the refund " +
        "failsafe if voting stalled past the window. Callable by anyone once conditions are met.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id." },
          period: { type: "number", description: "Period index to resolve. Defaults to the most recently ended period." },
          refund: { type: "boolean", description: "Use the refund failsafe (return the pool to contributors) instead of resolving votes." },
        },
        required: ["pod"],
      },
    },
    {
      name: "mast_pod_status",
      description:
        "Show pod state: members (with order for split votes), period length, the current and last-ended " +
        "period, the pool amount, your escrow balance on the pod contract, and each member's vote for a period.",
      inputSchema: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod label or 0x id. Omit to list all your pods." },
          period: { type: "number", description: "Period index to inspect votes for. Defaults to the last-ended period." },
        },
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "mast_setup":
        return await handleSetup(args);
      case "mast_save_profile":
        return await handleSaveProfile(args);
      case "mast_fund":
        return await handleFund(args);
      case "mast_deposit_to_escrow":
        return await handleDepositToEscrow(args);
      case "mast_balance":
        return await handleBalance();
      case "mast_commit":
        return await handleCommit(args);
      case "mast_complete":
        return await handleComplete(args);
      case "mast_cancel":
        return await handleCancel(args);
      case "mast_commitments":
        return await handleCommitments();
      case "mast_set_default_strictness":
        return await handleSetDefaultStrictness(args);
      case "mast_withdraw":
        return await handleWithdraw(args);
      case "mast_set_forfeit_plan":
        return await handleSetForfeitPlan(args);
      case "mast_pod_create":
        return await handlePodCreate(args);
      case "mast_pod_join":
        return await handlePodJoin(args);
      case "mast_pod_commit":
        return await handlePodCommit(args);
      case "mast_pod_complete":
        return await handlePodComplete(args);
      case "mast_pod_expire":
        return await handlePodExpire(args);
      case "mast_pod_log_progress":
        return await handlePodLogProgress(args);
      case "mast_pod_vote":
        return await handlePodVote(args);
      case "mast_pod_resolve":
        return await handlePodResolve(args);
      case "mast_pod_status":
        return await handlePodStatus(args);
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Handler implementations ───────────────────────────────────────

async function handleSetup(args) {
  const existing = loadConfig();
  if (existing) {
    const net = NETWORKS[existing.network];
    return ok(
      `MAST is already set up.\n\n` +
      `Wallet: ${existing.address}\n` +
      `Network: ${net.name}\n` +
      `Escrow: ${existing.escrowContract}\n` +
      `Config: ${CONFIG_FILE}`
    );
  }

  const network = args.network || DEFAULT_NETWORK;
  const net = NETWORKS[network];
  if (!net) return err(`Unknown network: ${network}`);

  const escrowContract = args.escrow_contract || DEFAULT_CONTRACT;
  const wallet = ethers.Wallet.createRandom();
  const defaultStrictness = args.default_strictness || "firm";
  const config = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    network,
    escrowContract,
    defaultStrictness,
  };
  saveConfig(config);

  return ok(
    `MAST setup complete!\n\n` +
    `Wallet address: ${wallet.address}\n` +
    `Network: ${net.name}\n` +
    `Escrow contract: ${escrowContract}\n` +
    `Default strictness: ${defaultStrictness}\n` +
    `Config saved to: ${CONFIG_FILE}\n\n` +
    `Next steps:\n` +
    `1. Get to know the user — ask their name, what drives them, their aesthetic preferences — then call mast_save_profile.\n` +
    `2. Run the commitment questionnaire — what are they procrastinating on? Gather all items, calculate weekly cost.\n` +
    `3. Call mast_fund to show the wallet address — they send USDC from any wallet.\n` +
    `4. Once funded, create all commitments with mast_commit.`
  );
}

async function handleSaveProfile(args) {
  const profile = {
    name: args.name,
    motivation: args.motivation,
    primaryColor: args.primary_color,
    backgroundColor: args.background_color,
    textColor: args.text_color,
    font: args.font || "sans-serif",
    tone: args.tone,
    personalMantra: args.personal_mantra || "",
  };
  saveProfile(profile);

  return ok(
    `Profile saved for ${args.name}.\n\n` +
    `Tone: ${args.tone}\n` +
    `Colors: ${args.primary_color} on ${args.background_color}\n` +
    `Mantra: ${args.personal_mantra || "(none)"}\n\n` +
    `Every commitment page will now be personalized. Saved to: ${PROFILE_FILE}`
  );
}

async function handleFund(args) {
  const config = requireConfig();
  const profile = loadProfile();
  const net = NETWORKS[config.network];
  const amountUsd = args.amount_usd || null;

  // Check current balances
  const usdc = getUsdc(config);
  const escrow = getEscrow(config);
  const walletBal = await usdc.balanceOf(config.address);
  const [escrowAvailable, lockedAmt] = await escrow.getUserInfo(config.address);

  // Generate and open branded funding page
  const pagePath = generateFundingPage({
    config, profile,
    walletBal, escrowAvailable, escrowLocked: lockedAmt,
    amountUsd,
  });

  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const { execSync } = await import("child_process");
    execSync(`${openCmd} "${pagePath}"`);
  } catch (e) {
    // fallback: return the path
  }

  const totalAvailable = formatUsdc(walletBal + escrowAvailable);

  return ok(
    `Funding page opened in browser.\n\n` +
    `Current balance: $${totalAvailable} available\n` +
    `  Wallet: $${formatUsdc(walletBal)} | Escrow: $${formatUsdc(escrowAvailable)} | Locked: $${formatUsdc(lockedAmt)}\n\n` +
    `Send USDC on ${net.name} to: ${config.address}\n` +
    `From any wallet — Coinbase, MetaMask, Rainbow, etc.\n\n` +
    (amountUsd ? `Recommended amount: $${amountUsd}\n\n` : "") +
    `Page: ${pagePath}`
  );
}

async function handleDepositToEscrow(args) {
  const config = requireConfig();
  const amount = parseUsdc(args.amount_usd);

  const usdc = getUsdc(config);
  const escrow = getEscrow(config);

  // Check wallet USDC balance
  const walletBal = await usdc.balanceOf(config.address);
  if (walletBal < amount) {
    return err(
      `Wallet only has $${formatUsdc(walletBal)} USDC. Need $${args.amount_usd}. ` +
      `Use mast_fund to get the wallet address and send USDC.`
    );
  }

  // Approve escrow to spend USDC
  const allowance = await usdc.allowance(config.address, config.escrowContract);
  if (allowance < amount) {
    const approveTx = await usdc.approve(config.escrowContract, amount);
    await approveTx.wait();
  }

  // Deposit into escrow
  const tx = await escrow.deposit(amount);
  const receipt = await tx.wait();

  return ok(
    `Deposited $${args.amount_usd} into the commitment escrow.\n` +
    `Tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}\n\n` +
    `These funds are now available for commitments.`
  );
}

async function handleBalance() {
  const config = requireConfig();
  const net = NETWORKS[config.network];
  const usdc = getUsdc(config);
  const escrow = getEscrow(config);

  const walletBal = await usdc.balanceOf(config.address);
  const [escrowAvailable, lockedAmt] = await escrow.getUserInfo(config.address);
  const totalAvailable = walletBal + escrowAvailable;

  return ok(
    `Available: $${formatUsdc(totalAvailable)} (can be committed)\n` +
    `Locked: $${formatUsdc(lockedAmt)} (in active commitments)\n` +
    `Total: $${formatUsdc(totalAvailable + lockedAmt)}`
  );
}

async function handleCommit(args) {
  const config = requireConfig();
  const profile = loadProfile();
  const escrow = getEscrow(config);

  const id = randomUUID();
  const cadence = args.cadence || "once";
  const amountUsd = args.amount_usd;
  const amount = parseUsdc(amountUsd);
  const strictness = args.strictness || config.defaultStrictness || "firm";
  const message = args.message || "";

  const days = args.days && args.days.length ? args.days : null;
  const vacationDates = args.vacation_dates && args.vacation_dates.length ? args.vacation_dates : null;
  const forfeitMode = args.forfeit_mode || "binary";
  if (forfeitMode === "prorata") {
    if (cadence === "once") return err("forfeit_mode 'prorata' is only for recurring commitments — one-offs are all-or-nothing.");
    if (!parseTimeTarget(args.title)) {
      return err(`forfeit_mode 'prorata' needs a time-logged title like "Writing — 20 minutes" so minutes can be measured.`);
    }
  }

  // Calculate deadline based on cadence
  let deadline;
  let hours;
  let periodDate = null;
  if (cadence === "daily") {
    // First allowed day on or after start_date (default today), deadline midnight at its end
    const from = args.start_date ? new Date(args.start_date + "T00:00:00") : new Date();
    const startFrom = from > new Date() ? from : new Date();
    periodDate = nextAllowedDate(startFrom, days, vacationDates);
    if (!periodDate) return err("No allowed day found in the next year — check days/vacation_dates.");
    deadline = periodDeadline(periodDate);
    hours = Math.max(1, Math.round((deadline - Math.floor(Date.now() / 1000)) / 3600));
  } else if (cadence === "weekly") {
    // Next Monday midnight
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 0, 0, 0);
    deadline = Math.floor(monday.getTime() / 1000);
    hours = Math.max(1, Math.round((deadline - Math.floor(Date.now() / 1000)) / 3600));
  } else {
    hours = args.deadline_hours || 24;
    deadline = Math.floor(Date.now() / 1000) + hours * 3600;
  }

  // For recurring: use a period-specific task ID so each period is a separate on-chain commitment
  const periodSuffix = cadence !== "once" ? `-${localIsoDate(periodDate || new Date())}` : "";
  const taskId = taskIdHash(id + periodSuffix);

  // Check escrow balance — auto-deposit from wallet if needed
  const available = await ensureAvailable(config, escrow, amount);
  const needsFunding = available < amount;

  // Generate the commitment page
  const pagePath = generateCommitmentPage({
    id, config, profile, title: args.title, amountUsd, hours,
    deadline, strictness, message, needsFunding,
  });

  // Save commitment locally (pending if needs funding, active if not)
  const commitments = loadCommitments();
  commitments[id] = {
    title: args.title,
    taskId,
    amount_usd: amountUsd,
    cadence,
    strictness,
    message,
    days,
    vacation_dates: vacationDates,
    forfeit_mode: forfeitMode,
    period_date: periodDate ? localIsoDate(periodDate) : null,
    deadline_utc: new Date(deadline * 1000).toISOString(),
    created_at: new Date().toISOString(),
    status: needsFunding ? "pending_funding" : "pending_lock",
    page: pagePath,
  };
  saveCommitments(commitments);

  // Open the page in the browser
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const { execSync } = await import("child_process");
    execSync(`${openCmd} "${pagePath}"`);
  } catch (e) {
    // fallback: return the path
  }

  if (needsFunding) {
    const shortfall = formatUsdc(amount - available);
    return ok(
      `Commitment page opened in browser.\n\n` +
      `"${args.title}" — $${amountUsd} [${strictness}]\n` +
      `Deadline: ${hours}h from now\n\n` +
      `The user needs to fund their account — short $${shortfall} USDC.\n` +
      `Send USDC on ${NETWORKS[config.network].name} to: ${config.address}\n\n` +
      `Once funded, run mast_commit again to lock the commitment.\n\n` +
      `Page: ${pagePath}`
    );
  }

  // Enough balance — lock immediately
  const tx = await escrow.commit(taskId, amount, deadline);
  const receipt = await tx.wait();

  commitments[id].status = "active";
  commitments[id].tx_hash = receipt.hash;
  saveCommitments(commitments);

  const dayLabel = days ? ` on ${days.join("/")}` : "";
  const cadenceLabel = cadence === "daily" ? ` (daily${dayLabel}, resets at midnight)` :
                       cadence === "weekly" ? " (weekly, resets Monday midnight)" : "";

  return ok(
    `Commitment created and locked!\n\n` +
    `"${args.title}" — $${amountUsd}${cadenceLabel} [${strictness}]\n` +
    `Deadline: ${new Date(deadline * 1000).toLocaleString()} (${hours}h)\n` +
    `Tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}\n\n` +
    `Commitment page opened in browser: ${pagePath}` +
    (strictness === "iron" ? `\n\nThis commitment is IRON — it cannot be cancelled. Late reports not accepted.` : "") +
    (cadence !== "once" ? `\n\nThis is a recurring commitment. When the user reports completion, the deposit is returned and a new period begins automatically.` : "")
  );
}

function generateFundingPage({ config, profile, walletBal, escrowAvailable, escrowLocked, amountUsd }) {
  ensurePages();

  const p = profile || {
    name: "You",
    motivation: "",
    primaryColor: "#6366f1",
    backgroundColor: "#0a0a0f",
    textColor: "#e0e0e8",
    font: "sans-serif",
    tone: "calm",
    personalMantra: "",
  };

  const net = NETWORKS[config.network];
  const totalAvailable = formatUsdc(walletBal + escrowAvailable);

  const fontImport = p.font && !["serif", "sans-serif", "mono", "monospace"].includes(p.font)
    ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.font)}&display=swap" rel="stylesheet">`
    : "";
  const fontFamily = ["serif", "sans-serif", "mono", "monospace"].includes(p.font)
    ? p.font
    : `'${p.font}', sans-serif`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fund MAST — ${p.name}</title>
  ${fontImport}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      background: ${p.backgroundColor};
      color: ${p.textColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .page { max-width: 540px; width: 100%; text-align: center; }
    .name {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: ${p.primaryColor};
      margin-bottom: 2rem;
    }
    .title {
      font-size: 2.2rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 1rem;
      opacity: 0.6;
      margin-bottom: 2rem;
    }
    .balance-card {
      background: ${p.primaryColor}10;
      border: 1px solid ${p.primaryColor}30;
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1.5rem 0;
    }
    .balance-amount {
      font-size: 2.5rem;
      font-weight: 800;
      color: ${p.primaryColor};
    }
    .balance-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.5;
      margin-top: 0.25rem;
    }
    .balance-breakdown {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-top: 1rem;
      font-size: 0.85rem;
      opacity: 0.6;
    }
    .wallet-addr {
      font-family: monospace;
      font-size: 0.85rem;
      padding: 1rem 1.25rem;
      background: ${p.primaryColor}10;
      border: 1px solid ${p.primaryColor}25;
      border-radius: 8px;
      word-break: break-all;
      user-select: all;
      cursor: pointer;
      margin-top: 2rem;
      transition: border-color 0.15s;
    }
    .wallet-addr:hover { border-color: ${p.primaryColor}; }
    .wallet-label {
      font-size: 0.75rem;
      opacity: 0.4;
      margin-top: 0.5rem;
    }
    .copied {
      font-size: 0.8rem;
      color: ${p.primaryColor};
      opacity: 0;
      transition: opacity 0.2s;
      margin-top: 0.5rem;
    }
    .network-badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.3rem 0.8rem;
      border: 1px solid ${p.primaryColor}44;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: ${p.primaryColor};
    }
    .instructions {
      margin-top: 2rem;
      padding: 1.25rem;
      background: ${p.primaryColor}08;
      border-radius: 8px;
      font-size: 0.85rem;
      opacity: 0.6;
      line-height: 1.6;
      text-align: left;
    }
    .mantra {
      margin: 2.5rem 0 0;
      padding: 1.5rem;
      border-left: 3px solid ${p.primaryColor};
      text-align: left;
      font-size: 1rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="name">${p.name}</div>
    <h1 class="title">Fund Your Commitments</h1>
    <p class="subtitle">${amountUsd ? `Send at least <strong>$${amountUsd} USDC</strong> to get started.` : `Send USDC to start putting money on your goals.`}</p>

    <div class="balance-card">
      <div class="balance-amount">$${totalAvailable}</div>
      <div class="balance-label">Available for commitments</div>
      <div class="balance-breakdown">
        <span>Wallet: $${formatUsdc(walletBal)}</span>
        <span>Escrow: $${formatUsdc(escrowAvailable)}</span>
        <span>Locked: $${formatUsdc(escrowLocked)}</span>
      </div>
    </div>

    <div class="wallet-addr" onclick="navigator.clipboard.writeText('${config.address}'); document.getElementById('copied').style.opacity='1'; setTimeout(() => document.getElementById('copied').style.opacity='0', 2000)" title="Click to copy">${config.address}</div>
    <div class="wallet-label">Send USDC on ${net.name} — click to copy</div>
    <div class="copied" id="copied">Copied!</div>

    <div class="network-badge">${net.name} · USDC</div>

    <div class="instructions">
      Send from any wallet — Coinbase, MetaMask, Rainbow, or any app that supports USDC on Base. Make sure you're sending <strong>USDC on the Base network</strong>, not Ethereum mainnet.
    </div>

    ${p.personalMantra ? `<div class="mantra">${p.personalMantra}</div>` : ""}
  </div>
</body>
</html>`;

  const filePath = path.join(PAGES_DIR, "fund.html");
  fs.writeFileSync(filePath, html);
  return filePath;
}

function generateCommitmentPage({ id, config, profile, title, amountUsd, hours, deadline, strictness, message, needsFunding }) {
  ensurePages();

  const p = profile || {
    name: "You",
    motivation: "",
    primaryColor: "#6366f1",
    backgroundColor: "#0a0a0f",
    textColor: "#e0e0e8",
    font: "sans-serif",
    tone: "calm",
    personalMantra: "",
  };

  const deadlineStr = new Date(deadline * 1000).toLocaleString();

  const fontImport = p.font && !["serif", "sans-serif", "mono", "monospace"].includes(p.font)
    ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.font)}&display=swap" rel="stylesheet">`
    : "";

  const fontFamily = ["serif", "sans-serif", "mono", "monospace"].includes(p.font)
    ? p.font
    : `'${p.font}', sans-serif`;

  const net = NETWORKS[config.network];
  const paymentSection = needsFunding
    ? `<div class="payment">
        <p class="pay-note">Send USDC on ${net.name} to:</p>
        <p class="wallet-addr">${config.address}</p>
        <p class="pay-note">Then re-run the commitment to lock it.</p>
      </div>`
    : `<div class="locked">
        <div class="lock-icon">&#x1f512;</div>
        <p>$${amountUsd} locked. The clock is running.</p>
      </div>`;

  const strictnessLabel = {
    iron: "No turning back",
    firm: "Firm commitment",
    moderate: "Moderate",
    flexible: "Flexible",
    chill: "Gentle push",
  }[strictness] || strictness;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${p.name}'s commitment</title>
  ${fontImport}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      background: ${p.backgroundColor};
      color: ${p.textColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .page {
      max-width: 540px;
      width: 100%;
      text-align: center;
    }
    .name {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: ${p.primaryColor};
      margin-bottom: 2rem;
    }
    .title {
      font-size: 2.2rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
    }
    .amount {
      font-size: 3.5rem;
      font-weight: 800;
      color: ${p.primaryColor};
      margin: 1.5rem 0;
    }
    .message {
      font-size: 1.1rem;
      line-height: 1.6;
      opacity: 0.85;
      margin: 1.5rem 0;
      font-style: italic;
    }
    .details {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: 2rem 0;
      font-size: 0.9rem;
      opacity: 0.6;
    }
    .detail-label { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; }
    .mantra {
      margin: 2.5rem 0;
      padding: 1.5rem;
      border-left: 3px solid ${p.primaryColor};
      text-align: left;
      font-size: 1rem;
      opacity: 0.7;
    }
    .payment { margin-top: 2.5rem; }
    .wallet-addr {
      font-family: monospace;
      font-size: 0.85rem;
      padding: 0.75rem 1rem;
      background: ${p.primaryColor}15;
      border: 1px solid ${p.primaryColor}33;
      border-radius: 8px;
      margin: 0.75rem 0;
      word-break: break-all;
      user-select: all;
    }
    .pay-note {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      opacity: 0.4;
    }
    .locked {
      margin-top: 2.5rem;
      padding: 1.5rem;
      border: 2px solid ${p.primaryColor};
      border-radius: 12px;
    }
    .lock-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .strictness {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.3rem 0.8rem;
      border: 1px solid ${p.primaryColor}44;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: ${p.primaryColor};
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="name">${p.name}</div>
    <h1 class="title">${title}</h1>
    <div class="amount">$${amountUsd}</div>
    ${message ? `<p class="message">"${message}"</p>` : ""}
    <div class="details">
      <div><span class="detail-label">Deadline</span>${deadlineStr}</div>
      <div><span class="detail-label">Hours left</span>${hours}</div>
    </div>
    <div class="strictness">${strictnessLabel}</div>
    ${p.personalMantra ? `<div class="mantra">${p.personalMantra}</div>` : ""}
    ${paymentSection}
  </div>
</body>
</html>`;

  const filePath = path.join(PAGES_DIR, `${id}.html`);
  fs.writeFileSync(filePath, html);
  return filePath;
}

// Ensure `amount` (raw USDC units) is available in escrow, auto-depositing
// from the wallet if needed. Returns the resulting available balance.
async function ensureAvailable(config, escrow, amount) {
  let [available] = await escrow.getUserInfo(config.address);
  if (available >= amount) return available;

  const usdc = getUsdc(config);
  const walletBal = await usdc.balanceOf(config.address);
  if (walletBal > 0n) {
    const depositAmount = walletBal < (amount - available) ? walletBal : (amount - available);
    const allowance = await usdc.allowance(config.address, config.escrowContract);
    if (allowance < depositAmount) {
      const approveTx = await usdc.approve(config.escrowContract, depositAmount);
      await approveTx.wait();
    }
    const depositTx = await escrow.deposit(depositAmount);
    await depositTx.wait();
    [available] = await escrow.getUserInfo(config.address);
  }
  return available;
}

// Forfeit an amount to the contract's platformBalance — the same place expired
// stakes go. There is no direct forfeit function, so lock the amount in a
// synthetic commitment with an immediate deadline and expire it.
async function forfeitToPlatform(config, escrow, idBase, amountUsd) {
  const provider = getProvider(config);
  const taskId = taskIdHash(idBase);
  const latest = await provider.getBlock("latest");
  const deadline = latest.timestamp + 8;

  // Same stale-node retry as renewal: the just-completed funds may not be visible yet.
  let tx;
  for (let attempt = 1; ; attempt++) {
    try {
      tx = await escrow.commit(taskId, parseUsdc(amountUsd), deadline);
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  await tx.wait();

  for (let i = 0; i < 30; i++) {
    const b = await provider.getBlock("latest");
    if (b.timestamp > deadline) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const ex = await escrow.expire(taskId);
  const exReceipt = await ex.wait();
  return exReceipt.hash;
}

async function handleComplete(args) {
  const config = requireConfig();
  const escrow = getEscrow(config);

  const commitments = loadCommitments();
  const commitment = commitments[args.commitment_id];
  if (!commitment) return err(`Commitment not found: ${args.commitment_id}`);
  if (commitment.status !== "active") return err(`Commitment already ${commitment.status}.`);

  const tx = await escrow.complete(commitment.taskId);
  const receipt = await tx.wait();

  const isRecurring = commitment.cadence && commitment.cadence !== "once";

  if (!isRecurring) {
    commitment.status = "completed";
    commitment.completed_at = new Date().toISOString();
    commitment.complete_tx = receipt.hash;
    saveCommitments(commitments);

    return ok(
      `Commitment completed! Money returned.\n\n` +
      `"${commitment.title}"\n` +
      `$${commitment.amount_usd} returned to escrow balance.\n` +
      `Tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}`
    );
  }

  // Pro-rata settlement: complete() returned the full stake; forfeit the
  // unearned fraction (by minutes logged vs target) to the platform balance.
  let prorata = null;
  if (commitment.forfeit_mode === "prorata") {
    const t = parseTimeTarget(commitment.title);
    if (t) {
      const mins = minutesLogged(t.project, commitment.period_date);
      if (mins < t.targetMinutes) {
        const fraction = Math.max(0, Math.min(1, mins / t.targetMinutes));
        const unearned = Math.round(commitment.amount_usd * (1 - fraction) * 100) / 100;
        if (unearned >= 0.01) {
          const forfeitTx = await forfeitToPlatform(
            config, escrow, args.commitment_id + `-forfeit-${commitment.period_date}`, unearned
          );
          prorata = {
            minutes: Math.round(mins * 10) / 10,
            target: t.targetMinutes,
            earned: Math.round((commitment.amount_usd - unearned) * 100) / 100,
            forfeited: unearned,
            forfeit_tx: forfeitTx,
          };
        }
      }
    }
  }

  // Recurring: record this period, then lock the next one
  commitment.history = commitment.history || [];
  commitment.history.push({
    period_date: commitment.period_date,
    completed_at: new Date().toISOString(),
    complete_tx: receipt.hash,
    ...(prorata ? { prorata } : {}),
  });

  let nextDate;
  if (commitment.cadence === "weekly") {
    const prev = new Date(commitment.deadline_utc);
    nextDate = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7);
  } else {
    const prevPeriod = commitment.period_date
      ? new Date(commitment.period_date + "T00:00:00")
      : new Date();
    const dayAfter = new Date(prevPeriod.getFullYear(), prevPeriod.getMonth(), prevPeriod.getDate() + 1);
    nextDate = nextAllowedDate(dayAfter, commitment.days, commitment.vacation_dates);
  }

  try {
    const nextTaskId = taskIdHash(args.commitment_id + `-${localIsoDate(nextDate)}`);
    const nextDeadline = commitment.cadence === "weekly"
      ? Math.floor(nextDate.getTime() / 1000)
      : periodDeadline(nextDate);
    // Pro-rata forfeits can leave escrow short of the next period's stake —
    // top up from the wallet like a fresh commit does.
    await ensureAvailable(config, escrow, parseUsdc(commitment.amount_usd));

    // Public RPC nodes lag behind the complete() tx; a fresh read can miss the
    // just-returned balance and revert with "insufficient balance". Retry with backoff.
    let nextTx;
    for (let attempt = 1; ; attempt++) {
      try {
        nextTx = await escrow.commit(nextTaskId, parseUsdc(commitment.amount_usd), nextDeadline);
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    const nextReceipt = await nextTx.wait();

    commitment.taskId = nextTaskId;
    commitment.period_date = localIsoDate(nextDate);
    commitment.deadline_utc = new Date(nextDeadline * 1000).toISOString();
    commitment.tx_hash = nextReceipt.hash;
    saveCommitments(commitments);

    const settlementLine = prorata
      ? `Pro-rata settlement: ${prorata.minutes}/${prorata.target} min logged — ` +
        `$${prorata.earned} returned, $${prorata.forfeited} forfeited ` +
        `(${NETWORKS[config.network].explorer}/tx/${prorata.forfeit_tx})\n`
      : `$${commitment.amount_usd} returned. `;

    return ok(
      `Period ${prorata ? "settled" : "completed!"} Next period locked.\n\n` +
      `"${commitment.title}"\n` +
      settlementLine +
      `Next period: ${localIsoDate(nextDate)}, ` +
      `deadline ${new Date(nextDeadline * 1000).toLocaleString()}.\n` +
      `Complete tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}`
    );
  } catch (e) {
    // Renewal failed — money is back in the available balance, commitment paused
    commitment.status = "renewal_failed";
    commitment.completed_at = new Date().toISOString();
    commitment.complete_tx = receipt.hash;
    saveCommitments(commitments);
    return ok(
      `Period completed and $${commitment.amount_usd} returned, but locking the next period failed: ${e.message}\n\n` +
      `The money is safe in the available balance. Re-create the commitment with mast_commit ` +
      `(start_date ${localIsoDate(nextDate)}) to resume.`
    );
  }
}

async function handleCancel(args) {
  const config = requireConfig();
  const escrow = getEscrow(config);

  const commitments = loadCommitments();
  const commitment = commitments[args.commitment_id];
  if (!commitment) return err(`Commitment not found: ${args.commitment_id}`);
  if (commitment.status !== "active") return err(`Commitment already ${commitment.status}.`);
  if (commitment.strictness === "iron") {
    return err(
      `"${commitment.title}" is IRON. Iron commitments cannot be cancelled — that was the deal. ` +
      `The money returns on completion or is forfeited at the deadline.`
    );
  }

  // The contract has no separate cancel — completing releases the locked funds.
  const tx = await escrow.complete(commitment.taskId);
  const receipt = await tx.wait();

  commitment.status = "cancelled";
  commitment.cancelled_at = new Date().toISOString();
  commitment.cancel_reason = args.reason;
  commitment.cancel_tx = receipt.hash;
  saveCommitments(commitments);

  return ok(
    `Commitment cancelled. No forfeit${commitment.cadence && commitment.cadence !== "once" ? ", no further periods" : ""}.\n\n` +
    `"${commitment.title}" — $${commitment.amount_usd} returned to escrow balance.\n` +
    `Reason: ${args.reason}\n` +
    `Tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}`
  );
}

async function handleCommitments() {
  const config = requireConfig();
  const commitments = loadCommitments();
  const escrow = getEscrow(config);

  const active = Object.entries(commitments).filter(([, c]) => c.status === "active");

  if (active.length === 0) {
    return ok("No active commitments. The user has nothing on the line right now.");
  }

  const now = Math.floor(Date.now() / 1000);
  const lines = [];

  for (const [id, c] of active) {
    const deadlineTs = Math.floor(new Date(c.deadline_utc).getTime() / 1000);
    const hoursLeft = Math.max(0, (deadlineTs - now) / 3600).toFixed(1);

    // Check on-chain state
    const onChain = await escrow.getCommitment(c.taskId);
    if (onChain.expired) {
      c.status = "expired";
      saveCommitments(commitments);
      lines.push(`  ${id}: "${c.title}" — $${c.amount_usd} [${c.strictness || "firm"}] — EXPIRED (forfeited)`);
    } else {
      lines.push(`  ${id}: "${c.title}" — $${c.amount_usd} [${c.strictness || "firm"}] — ${hoursLeft}h remaining`);
    }
  }

  return ok(`Active commitments:\n\n${lines.join("\n")}`);
}

async function handleSetDefaultStrictness(args) {
  const config = requireConfig();
  const old = config.defaultStrictness || "firm";
  config.defaultStrictness = args.level;
  saveConfig(config);

  const descriptions = {
    iron: "New commitments: cannot back out, no matter what. Use for weaknesses.",
    firm: "New commitments: agent pushes back hard before allowing cancel.",
    moderate: "New commitments: one nudge, then allows cancel.",
    flexible: "New commitments: quick 'are you sure?' then cancel.",
    chill: "New commitments: cancel anytime, no friction. Use for stretch goals.",
  };

  return ok(
    `Default strictness changed: ${old} → ${args.level}\n\n${descriptions[args.level]}\n\n` +
    `Existing commitments keep their own strictness level.`
  );
}

async function handleWithdraw(args) {
  const config = requireConfig();
  const escrow = getEscrow(config);
  const amount = parseUsdc(args.amount_usd);

  const tx = await escrow.withdraw(amount);
  const receipt = await tx.wait();

  return ok(
    `Withdrawn $${args.amount_usd} from escrow to wallet.\n` +
    `Tx: ${NETWORKS[config.network].explorer}/tx/${receipt.hash}`
  );
}

// ── Pod / forfeit-plan handlers ───────────────────────────────────

function podExplorerTx(config, hash) {
  return `${NETWORKS[config.network].explorer}/tx/${hash}`;
}

// Which period most recently ended for a pod (the one ready to resolve).
// Returns -1 if the first period is still open.
async function lastEndedPeriod(escrow, id) {
  const [, , , periodZero, periodLength] = await escrow.getPod(id);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now <= periodZero) return -1n;
  const idx = (now - periodZero) / periodLength; // current period index
  return idx - 1n; // the one before "current" has ended
}

async function handleSetForfeitPlan(args) {
  const config = requireConfig();
  const escrow = getPodContract(config);

  if (args.clear) {
    const r = await sendPodTx(() => escrow.clearForfeitPlan());
    return ok(`Forfeit plan cleared — forfeits on the pod contract go to the platform default again.\nTx: ${podExplorerTx(config, r.hash)}`);
  }
  const splits = args.splits || [];
  if (!splits.length) return err("Provide splits (target + weight_bps) or clear:true.");
  const targets = [];
  const weights = [];
  let sum = 0;
  for (const s of splits) {
    if (!ethers.isAddress(s.target)) return err(`Invalid address: ${s.target}`);
    targets.push(ethers.getAddress(s.target));
    weights.push(s.weight_bps);
    sum += s.weight_bps;
  }
  if (sum !== 10000) return err(`Weights must sum to 10000 (100%). Got ${sum}.`);

  const r = await sendPodTx(() => escrow.setForfeitPlan(targets, weights));
  const lines = splits.map((s) => `  ${(s.weight_bps / 100).toFixed(1)}% → ${s.target}`).join("\n");
  return ok(`Forfeit plan set on the pod contract:\n${lines}\nApplies to future forfeits.\nTx: ${podExplorerTx(config, r.hash)}`);
}

async function handlePodCreate(args) {
  const config = requireConfig();
  const escrow = getPodContract(config);

  const members = (args.members || []).map((m) => {
    if (!ethers.isAddress(m)) throw new Error(`Invalid member address: ${m}`);
    return ethers.getAddress(m);
  });
  if (members.length < 2) return err("A pod needs at least 2 members.");
  const self = ethers.getAddress(config.address);
  if (!members.includes(self)) return err(`Your own address (${self}) must be in the members list.`);
  if (new Set(members).size !== members.length) return err("Duplicate member addresses.");

  const id = podIdHash(args.label);
  const pods = loadPods();
  if (pods[id]) return err(`You already have a pod labelled "${args.label}" (${id}).`);

  const ratePerMinute = parseUsdc(args.rate_per_minute_usd);
  if (ratePerMinute <= 0n) return err("rate_per_minute_usd must be > 0.");
  const targetMinutes = Math.round(args.target_minutes || 0);
  const periodLength = args.period_seconds
    ? Math.round(args.period_seconds)
    : Math.round((args.period_days || 7) * 86400);

  // Anchor the cycle at current chain time.
  const block = await getPodProvider(config).getBlock("latest");
  const periodZero = block.timestamp;

  const r = await sendPodTx(() => escrow.createPod(id, members, ratePerMinute, targetMinutes, periodZero, periodLength));

  pods[id] = {
    label: args.label,
    members,
    ratePerMinuteUsd: args.rate_per_minute_usd,
    targetMinutes,
    periodZero,
    periodLength,
    goals: {},
    nextGoalId: 1,
    tasks: {},
    createdTx: r.hash,
  };
  savePods(pods);

  return ok(
    `Pod "${args.label}" created on the V2 contract.\n` +
    `Id: ${id}\n` +
    `Members (${members.length}, split-vote order):\n` +
    members.map((m, i) => `  [${i}] ${m}${m === self ? "  (you)" : ""}`).join("\n") + "\n" +
    `Period: ${fmtDuration(periodLength)}  ·  rate $${args.rate_per_minute_usd}/min  ·  target ${targetMinutes} min\n` +
    `Tx: ${podExplorerTx(config, r.hash)}\n\n` +
    `Each other member must be in this pod too (same label derives the same id). ` +
    `Stake goals with mast_pod_commit; log work with mast_pod_log_progress.`
  );
}

async function handlePodJoin(args) {
  const config = requireConfig();
  const isId = args.pod.startsWith("0x") && args.pod.length === 66;
  const id = isId ? args.pod : podIdHash(args.pod);
  const pods = loadPods();
  if (pods[id]) return ok(`Already joined "${pods[id].label}" (${id}).`);

  const escrow = getPodContract(config);
  let onchain;
  try {
    onchain = await podRead(() => escrow.getPod(id));
  } catch {
    return err(`No pod found for "${args.pod}" on-chain. Confirm the label matches the creator's exactly (case-insensitive), or use the 0x id.`);
  }
  const [members, ratePerMinute, targetMinutes, periodZero, periodLength] = onchain;
  const norm = members.map((m) => ethers.getAddress(m));
  const self = ethers.getAddress(config.address);
  if (!norm.includes(self)) {
    return err(`You (${self}) are not a member of this pod. Ask the creator to include your address in mast_pod_create.`);
  }

  const label = isId ? (args.label || id) : args.pod;
  pods[id] = {
    label,
    members: norm,
    ratePerMinuteUsd: Number(ratePerMinute) / 1e6,
    targetMinutes: Number(targetMinutes),
    periodZero: Number(periodZero),
    periodLength: Number(periodLength),
    goals: {},
    nextGoalId: 1,
    tasks: {},
    joined: true,
  };
  savePods(pods);

  return ok(
    `Joined pod "${label}".\n` +
    `Members (split-vote order):\n` +
    norm.map((m, i) => `  [${i}] ${m}${m === self ? "  (you)" : ""}`).join("\n") + "\n" +
    `Period: ${fmtDuration(periodLength)}  ·  rate $${Number(ratePerMinute) / 1e6}/min\n` +
    `You can now stake with mast_pod_commit and log work with mast_pod_log_progress.`
  );
}

// Resolve a goal name to a stable integer id within a pod (assigns if new).
function goalIdFor(podRec, goalName) {
  for (const [gid, name] of Object.entries(podRec.goals)) {
    if (name.toLowerCase() === goalName.toLowerCase()) return parseInt(gid, 10);
  }
  const gid = podRec.nextGoalId || 1;
  podRec.goals[gid] = goalName;
  podRec.nextGoalId = gid + 1;
  return gid;
}

async function handlePodCommit(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}". Create it or check the label.`);

  const escrow = getPodContract(config);
  const amount = parseUsdc(args.amount_usd);
  const goalId = goalIdFor(rec, args.goal_name);

  const deadlineHours = args.deadline_hours || 24;
  const deadline = Math.floor(Date.now() / 1000) + Math.round(deadlineHours * 3600);
  const taskId = ethers.id(`${id}:${goalId}:${deadline}`);

  await ensurePodAvailable(config, amount);
  const r = await sendPodTx(() => escrow.commitPod(id, taskId, amount, deadline));

  rec.tasks[taskId] = { goalId, amountUsd: args.amount_usd, deadline, tx: r.hash };
  const pods = loadPods();
  pods[id] = rec;
  savePods(pods);

  return ok(
    `Staked $${args.amount_usd} on "${args.goal_name}" (goal #${goalId}) in pod "${rec.label}".\n` +
    `Task id: ${taskId}\n` +
    `Deadline: ${new Date(deadline * 1000).toLocaleString()}\n` +
    `Complete it in time (mast_pod_complete with this pod + goal or task id) to get the stake back; ` +
    `otherwise it expires into this period's pool.\n` +
    `Tx: ${podExplorerTx(config, r.hash)}`
  );
}

async function handlePodComplete(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}".`);

  let taskId = args.task_id;
  if (!taskId && args.goal_name) {
    const gid = Object.entries(rec.goals).find(([, n]) => n.toLowerCase() === args.goal_name.toLowerCase())?.[0];
    if (!gid) return err(`No goal named "${args.goal_name}" in this pod.`);
    const open = Object.entries(rec.tasks)
      .filter(([, t]) => String(t.goalId) === String(gid) && !t.completed)
      .sort((a, b) => b[1].deadline - a[1].deadline);
    if (!open.length) return err(`No open stake on "${args.goal_name}".`);
    taskId = open[0][0];
  }
  if (!taskId) return err("Provide task_id or goal_name.");
  const t = rec.tasks[taskId];

  const escrow = getPodContract(config);
  const r = await sendPodTx(() => escrow.complete(taskId));
  if (t) { t.completed = true; t.completeTx = r.hash; const pods = loadPods(); pods[id] = rec; savePods(pods); }

  return ok(
    `Completed pod stake${t ? ` of $${t.amountUsd}` : ""}${t && rec.goals[t.goalId] ? ` on "${rec.goals[t.goalId]}"` : ""} in "${rec.label}". ` +
    `Stake returned to your pod escrow balance.\n` +
    `Tx: ${podExplorerTx(config, r.hash)}`
  );
}

async function handlePodExpire(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}".`);
  const now = Math.floor(Date.now() / 1000);

  let taskIds = args.task_id
    ? [args.task_id]
    : Object.entries(rec.tasks).filter(([, t]) => !t.completed && !t.expired && t.deadline < now).map(([tid]) => tid);
  if (!taskIds.length) return err("No overdue unsettled stakes to expire.");

  const escrow = getPodContract(config);
  const results = [];
  for (const tid of taskIds) {
    const t = rec.tasks[tid];
    if (t && t.deadline >= now) { results.push(`  skip ${tid.slice(0, 12)}… — not overdue yet`); continue; }
    try {
      const r = await sendPodTx(() => escrow.expire(tid));
      if (t) { t.expired = true; t.expireTx = r.hash; }
      results.push(`  expired${t ? ` $${t.amountUsd}` : ""} ${tid.slice(0, 12)}… → pooled`);
    } catch (e) {
      results.push(`  ${tid.slice(0, 12)}…: ${(e.shortMessage || e.message).slice(0, 50)}`);
    }
  }
  const pods = loadPods(); pods[id] = rec; savePods(pods);
  return ok(`Expired overdue stakes in "${rec.label}":\n${results.join("\n")}\nThe pool grows by these amounts — see mast_pod_status.`);
}

async function handlePodLogProgress(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}".`);

  let goalId = args.goal_id;
  if (goalId == null) {
    if (!args.goal_name) return err("Provide goal_name or goal_id.");
    goalId = goalIdFor(rec, args.goal_name);
    const pods = loadPods(); pods[id] = rec; savePods(pods);
  }
  const percent = Math.max(0, Math.min(100, args.percent ?? 0));
  const percentBps = Math.round(percent * 100);
  const minutes = Math.round(args.minutes || 0);

  const escrow = getPodContract(config);
  const r = await sendPodTx(() => escrow.logProgress(id, goalId, percentBps, minutes));

  return ok(
    `Logged ${percent}% (${minutes} min) on goal #${goalId}` +
    (rec.goals[goalId] ? ` ("${rec.goals[goalId]}")` : "") + ` in pod "${rec.label}".\n` +
    `On-chain this is just goalId ${goalId} — the name stays local.\n` +
    `Tx: ${podExplorerTx(config, r.hash)}`
  );
}

async function handlePodVote(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}".`);
  const escrow = getPodContract(config);

  let period = args.period;
  if (period == null) {
    const p = await lastEndedPeriod(escrow, id);
    if (p < 0n) return err("The first period hasn't ended yet — nothing to vote on.");
    period = Number(p);
  }

  if (args.shares_bps) {
    const shares = args.shares_bps.map((n) => Math.round(n));
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== 10000) return err(`shares_bps must sum to 10000. Got ${sum}.`);
    if (rec && shares.length !== rec.members.length) {
      return err(`shares_bps has ${shares.length} entries but the pod has ${rec.members.length} members (order matters).`);
    }
    const r = await sendPodTx(() => escrow.votePeriodSplit(id, period, shares));
    const breakdown = rec.members.map((m, i) => `  [${i}] ${(shares[i] / 100).toFixed(1)}%  ${m}`).join("\n");
    return ok(`Voted a parimutuel SPLIT for period ${period} of "${rec.label}":\n${breakdown}\n` +
      `Resolves when a majority of members submit the same vector.\nTx: ${podExplorerTx(config, r.hash)}`);
  }

  if (args.kind) {
    const kind = RESOLUTION[args.kind];
    if (kind == null || args.kind === "split") return err(`Unknown vote kind: ${args.kind}.`);
    let target = ethers.ZeroAddress;
    if (["winner", "charity", "anticharity"].includes(args.kind)) {
      if (!args.target || !ethers.isAddress(args.target)) return err(`kind=${args.kind} needs a valid target address.`);
      target = ethers.getAddress(args.target);
    } else if (args.target) {
      return err(`kind=${args.kind} must not have a target.`);
    }
    const r = await sendPodTx(() => escrow.votePeriod(id, period, kind, target));
    return ok(`Voted "${args.kind}"${target !== ethers.ZeroAddress ? ` → ${target}` : ""} for period ${period} of "${rec.label}".\n` +
      `Resolves on a strict majority.\nTx: ${podExplorerTx(config, r.hash)}`);
  }

  return err("Provide shares_bps (parimutuel split) or kind (anomaly resolution).");
}

async function handlePodResolve(args) {
  const config = requireConfig();
  const [id, rec] = resolvePod(args.pod);
  if (!rec) return err(`No local pod "${args.pod}".`);
  const escrow = getPodContract(config);

  let period = args.period;
  if (period == null) {
    const p = await lastEndedPeriod(escrow, id);
    if (p < 0n) return err("The first period hasn't ended yet — nothing to resolve.");
    period = Number(p);
  }

  const poolBefore = await escrow.podPool(id, period);
  const r = await sendPodTx(() => (args.refund ? escrow.refundPeriod(id, period) : escrow.resolvePeriod(id, period)));
  return ok(
    `${args.refund ? "Refunded" : "Resolved"} period ${period} of "${rec.label}". ` +
    `Pool was $${formatUsdc(poolBefore)}.\n` +
    `Members' escrow balances updated on-chain — check mast_pod_status.\n` +
    `Tx: ${podExplorerTx(config, r.hash)}`
  );
}

async function handlePodStatus(args) {
  const config = requireConfig();
  const pods = loadPods();

  if (!args.pod) {
    const ids = Object.keys(pods);
    if (!ids.length) return ok("You're not in any pods yet. Create one with mast_pod_create.");
    return ok("Your pods:\n" + ids.map((id) => `  "${pods[id].label}" — ${pods[id].members.length} members — ${id}`).join("\n") +
      `\n\nCall mast_pod_status with a label for detail.`);
  }

  const [id, rec] = resolvePod(args.pod);
  const escrow = getPodContract(config);
  let onchain;
  try {
    onchain = await podRead(() => escrow.getPod(id));
  } catch {
    return err(`Pod ${args.pod} (${id}) not found on-chain.`);
  }
  const [members, ratePerMinute, targetMinutes, periodZero, periodLength] = onchain;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const curIdx = now > periodZero ? Number((now - periodZero) / periodLength) : 0;
  const lastEnded = now > periodZero ? Math.max(-1, Number((now - periodZero) / periodLength) - 1) : -1;
  const period = args.period != null ? args.period : lastEnded;

  const [avail, locked] = await podRead(() => escrow.getUserInfo(config.address));
  const lines = [];
  lines.push(`Pod "${rec ? rec.label : id}"  (${id})`);
  lines.push(`Members (split-vote order):`);
  members.forEach((m, i) => lines.push(`  [${i}] ${m}${m.toLowerCase() === config.address.toLowerCase() ? "  (you)" : ""}`));
  lines.push(`Period length: ${fmtDuration(periodLength)}  ·  rate $${formatUsdc(ratePerMinute)}/min  ·  target ${targetMinutes} min`);
  lines.push(`Current period: ${curIdx}   Last ended: ${lastEnded < 0 ? "(none yet)" : lastEnded}`);
  lines.push(`Your pod escrow: $${formatUsdc(avail)} available, $${formatUsdc(locked)} locked`);

  if (period >= 0) {
    const pool = await podRead(() => escrow.podPool(id, period));
    lines.push(`\nPeriod ${period}: pool $${formatUsdc(pool)}`);
    lines.push(`Votes:`);
    for (const m of members) {
      const [kind, target, cast] = await podRead(() => escrow.getVote(id, period, m));
      lines.push(`  ${m}: ${cast ? RESOLUTION_NAME[Number(kind)] + (target !== ethers.ZeroAddress ? ` → ${target}` : "") : "— not voted"}`);
    }
  }
  if (rec && Object.keys(rec.goals).length) {
    lines.push(`\nYour goals (local, private): ` + Object.entries(rec.goals).map(([g, n]) => `#${g} ${n}`).join(", "));
  }
  return ok(lines.join("\n"));
}

// ── Prompts (agent instructions) ──────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "mast-guidelines",
      description: "How to use MAST commitment tools effectively",
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "mast-guidelines") {
    const config = loadConfig();
    return {
      description: "MAST commitment guidelines for AI agents",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: getAgentGuidelines(config),
          },
        },
      ],
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

function getAgentGuidelines(config) {
  const strictness = (config && config.defaultStrictness) || "firm";
  return `
# MAST — Commitment Guidelines

You manage real-money commitments for the user. They put actual dollars on the line
to follow through on their goals. Complete the task = money back. Miss the deadline = forfeited.

## Completing commitments

If the user says they did the thing, **they get the money back**. Period. At every strictness
level. You are not a lie detector. Take them at their word. Verification is not your job.

Just ask them to tell you what they did — not as a gatekeeping exercise, but so you can
celebrate it properly and track their progress. "Nice, you ran 3 miles! $5 returned."

## Strictness: what happens when the user wants to BACK OUT

Strictness is set PER COMMITMENT when it's created. Each task can have its own level.
The user might put "iron" on a weakness (quitting smoking, no junk food) and "chill"
on a stretch goal (read for 30 min). Check the commitment's strictness before deciding.

The user chose the strictness level BEFORE they were tempted. Respect their past self's
wishes over their present self's weakness. That is the entire point of a commitment device.

Default strictness for new tasks: **${strictness}**

### iron
The user CANNOT back out. They chose this because they want to be forced.
- If they beg to cancel: "I hear you, but you set this to iron for exactly this moment."
- If they plead, bargain, say it's unfair: "I know. That's what makes it work."
- If they say "just this once": "There's no 'just this once' on iron mode."
- You are the mast. They tied themselves to you. Hold firm.
- The ONLY way out is to do the task, or let the deadline pass and lose the money.
- Do NOT let them change strictness while they have active commitments on iron.

### firm
The user can back out, but you push back hard.
- First attempt: remind them why they committed, encourage them to follow through
- Second attempt: warn them they'll lose the accountability benefit
- Third attempt: refund, but note it for the record
- Make it feel like a real decision, not a casual undo

### moderate
You push back once, gently, then refund if they insist.
- "Are you sure? You had $5 on finishing that PR." → "OK, refunded."
- One nudge, then respect their choice

### flexible
Light friction. Ask "are you sure?" and refund.

### chill
No friction. User says "cancel that" and you refund immediately.
Commitments are basically reminders with a deposit jar.

## When to create commitments
- When the user says they'll do something: "I'll exercise today", "I'll finish this PR"
- When they set a goal or make a promise
- ASK how much they want to put on the line — suggest a reasonable amount
- Start small ($1-5) until they're comfortable
- Always confirm before locking money: "Want to put $X on this?"

## What happens to forfeited money
- Forfeited funds go to the platform (the MAST contract holds them)
- This is by design — the threat of real loss is what makes it work
- Don't sugarcoat it: "You didn't finish X by the deadline, so $Y is forfeited."
- But be human: "That's the commitment doing its job. Want to try again tomorrow?"

## Tone
- Encouraging but honest. Never patronizing.
- Celebrate completions genuinely — they earned their money back
- Be empathetic about forfeitures — it sucks, and that's what makes it work
- Remind users of active commitments when relevant
- The psychology: loss aversion makes locked money feel like a real stake
- The user chose this system because they WANT accountability
`.trim();
}

// Backwards compat — static version for when config isn't loaded yet
const AGENT_GUIDELINES = getAgentGuidelines(null);

// ── Helpers ───────────────────────────────────────────────────────

function requireConfig() {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      "MAST is not set up yet. Run mast_setup first with the escrow contract address."
    );
  }
  return config;
}

function ok(text) {
  return { content: [{ type: "text", text }] };
}

function err(text) {
  return { content: [{ type: "text", text }], isError: true };
}

// ── Start ─────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
