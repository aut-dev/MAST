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
import { SignJWT, importPKCS8 } from "jose";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID, randomBytes } from "crypto";

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

const NETWORKS = {
  "base-sepolia": {
    rpc: "https://sepolia.base.org",
    chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorer: "https://sepolia.basescan.org",
    name: "Base Sepolia (testnet)",
  },
  "base": {
    rpc: "https://mainnet.base.org",
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

// ── Coinbase Onramp helpers ───────────────────────────────────────

async function generateCdpJwt(config, method, path) {
  const keyId = config.cdpApiKeyId;
  const secret = config.cdpApiKeySecret;
  if (!keyId || !secret) return null;

  // CDP API key secrets are base64-encoded Ed25519 keys (64 bytes: 32-byte seed + 32-byte public)
  const seed = Buffer.from(secret, "base64").subarray(0, 32);
  const ed25519Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const pkcs8Der = Buffer.concat([ed25519Prefix, seed]);
  const pem =
    "-----BEGIN PRIVATE KEY-----\n" +
    pkcs8Der.toString("base64") +
    "\n-----END PRIVATE KEY-----";

  const privateKey = await importPKCS8(pem, "EdDSA");
  const uri = `${method} api.developer.coinbase.com${path}`;
  const nonce = randomBytes(16).toString("hex");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({ sub: keyId, iss: "cdp", aud: ["cdp_service"], uri })
    .setProtectedHeader({ alg: "EdDSA", kid: keyId, nonce, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(privateKey);

  return jwt;
}

async function generateOnrampSessionToken(config, amountUsd) {
  const tokenPath = "/onramp/v1/token";
  const jwt = await generateCdpJwt(config, "POST", tokenPath);
  if (!jwt) return null;

  const body = {
    addresses: [{ address: config.address, blockchains: ["base"] }],
    assets: ["USDC"],
  };

  const res = await fetch(`https://api.developer.coinbase.com${tokenPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coinbase session token error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.token;
}

function buildOnrampUrl(config, amountUsd, sessionToken) {
  if (sessionToken) {
    return `https://pay.coinbase.com/buy/select-asset?sessionToken=${sessionToken}` +
      `&defaultAsset=USDC&defaultNetwork=base` +
      `&presetFiatAmount=${amountUsd}&fiatCurrency=USD`;
  }
  // Fallback to appId mode (won't work if secure init is required)
  const appIdParam = config.coinbaseAppId ? `&appId=${config.coinbaseAppId}` : "";
  return `https://pay.coinbase.com/buy/select-asset?` +
    `destinationWallets=${encodeURIComponent(JSON.stringify([{
      address: config.address, blockchains: ["base"], assets: ["USDC"],
    }]))}` +
    `&defaultAsset=USDC&defaultNetwork=base` +
    `&presetFiatAmount=${amountUsd}&fiatCurrency=USD` + appIdParam;
}

// ── Blockchain helpers ────────────────────────────────────────────

function getProvider(config) {
  const net = NETWORKS[config.network] || NETWORKS["base-sepolia"];
  return new ethers.JsonRpcProvider(net.rpc);
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
        "First-time MAST setup. Generates a crypto wallet for the user (they never need to know it's crypto). " +
        "Run this before any other MAST tool. If already set up, returns current config.",
      inputSchema: {
        type: "object",
        properties: {
          network: {
            type: "string",
            enum: ["base-sepolia", "base"],
            description: "Network to use. 'base-sepolia' for testing, 'base' for real money.",
            default: "base-sepolia",
          },
          escrow_contract: {
            type: "string",
            description: "Address of the deployed CommitmentEscrow contract.",
          },
          coinbase_app_id: {
            type: "string",
            description: "Coinbase Developer Platform Project ID (appId) for Coinbase Onramp. Get one at https://portal.cdp.coinbase.com/",
          },
          default_strictness: {
            type: "string",
            enum: ["iron", "firm", "moderate", "flexible", "chill"],
            description: "Default strictness for new commitments (can be overridden per task).",
            default: "firm",
          },
        },
        required: ["escrow_contract"],
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
        "Get a link for the user to add funds with their credit card (Visa, Mastercard, Apple Pay). " +
        "Opens Coinbase Onramp — the user pays with their card and funds are available for commitments automatically. " +
        "They never see crypto. This is a one-time step — funds are auto-deposited into the smart contract.",
      inputSchema: {
        type: "object",
        properties: {
          amount_usd: {
            type: "number",
            description: "Suggested amount in USD to fund.",
            default: 50,
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
        },
        required: ["title", "amount_usd"],
      },
    },
    {
      name: "mast_complete",
      description:
        "Mark a commitment as completed and return the money to the user's balance. " +
        "USE THIS when you've verified the user actually followed through. " +
        "Ask for evidence before completing: screenshots, links, descriptions of what they did.",
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
      case "mast_commitments":
        return await handleCommitments();
      case "mast_set_default_strictness":
        return await handleSetDefaultStrictness(args);
      case "mast_withdraw":
        return await handleWithdraw(args);
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

  const network = args.network || "base-sepolia";
  const net = NETWORKS[network];
  if (!net) return err(`Unknown network: ${network}`);

  const wallet = ethers.Wallet.createRandom();
  const defaultStrictness = args.default_strictness || "firm";
  const config = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    network,
    escrowContract: args.escrow_contract,
    coinbaseAppId: args.coinbase_app_id || "",
    defaultStrictness,
  };
  saveConfig(config);

  return ok(
    `MAST setup complete!\n\n` +
    `Wallet address: ${wallet.address}\n` +
    `Network: ${net.name}\n` +
    `Escrow contract: ${args.escrow_contract}\n` +
    `Default strictness: ${defaultStrictness}\n` +
    `Config saved to: ${CONFIG_FILE}\n\n` +
    `Next steps:\n` +
    `1. Get to know the user — ask their name, what drives them, their aesthetic preferences — then call mast_save_profile.\n` +
    `2. When they're ready to make their first commitment, use mast_commit. It will generate a personal commitment page and open it in their browser.`
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
  const net = NETWORKS[config.network];
  const amount = args.amount_usd || 50;

  // Generate session token for secure Coinbase Onramp
  let onrampUrl;
  try {
    const sessionToken = await generateOnrampSessionToken(config, amount);
    onrampUrl = buildOnrampUrl(config, amount, sessionToken);
  } catch (e) {
    onrampUrl = buildOnrampUrl(config, amount, null);
  }

  return ok(
    `To add funds, the user should open this link:\n\n${onrampUrl}\n\n` +
    `This opens Coinbase — they pay with their credit card (Visa, Mastercard, Apple Pay, Google Pay) ` +
    `and $${amount} will be available for commitments automatically.\n\n` +
    `Alternatively, they can send USDC directly on ${net.name} to:\n${config.address}\n\n` +
    `Once funded, the user can start making commitments immediately.`
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
      `Use mast_fund to add funds with a credit card.`
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

  // Calculate deadline based on cadence
  let deadline;
  let hours;
  if (cadence === "daily") {
    // Midnight tonight (local time)
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    deadline = Math.floor(midnight.getTime() / 1000);
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
  const periodSuffix = cadence !== "once" ? `-${new Date().toISOString().slice(0, 10)}` : "";
  const taskId = taskIdHash(id + periodSuffix);

  // Check escrow balance — auto-deposit from wallet if needed
  const usdc = getUsdc(config);
  let [available] = await escrow.getUserInfo(config.address);

  if (available < amount) {
    // Check if wallet has USDC to auto-deposit
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
  }

  const needsFunding = available < amount;

  // Generate session token for payment if needed
  let onrampUrl = "";
  if (needsFunding) {
    try {
      const sessionToken = await generateOnrampSessionToken(config, amountUsd);
      onrampUrl = buildOnrampUrl(config, amountUsd, sessionToken);
    } catch (e) {
      onrampUrl = buildOnrampUrl(config, amountUsd, null);
    }
  }

  // Generate the commitment page
  const pagePath = generateCommitmentPage({
    id, config, profile, title: args.title, amountUsd, hours,
    deadline, strictness, message, needsFunding, onrampUrl,
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
    return ok(
      `Commitment page opened in browser.\n\n` +
      `"${args.title}" — $${amountUsd} [${strictness}]\n` +
      `Deadline: ${hours}h from now\n\n` +
      `The user needs to fund their account ($${amountUsd}). ` +
      `The page has a payment button. Once funded, the commitment will be locked automatically ` +
      `the next time mast_commit is called.\n\n` +
      `Page: ${pagePath}`
    );
  }

  // Enough balance — lock immediately
  const tx = await escrow.commit(taskId, amount, deadline);
  const receipt = await tx.wait();

  commitments[id].status = "active";
  commitments[id].tx_hash = receipt.hash;
  saveCommitments(commitments);

  const cadenceLabel = cadence === "daily" ? " (daily, resets at midnight)" :
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

function generateCommitmentPage({ id, config, profile, title, amountUsd, hours, deadline, strictness, message, needsFunding, onrampUrl }) {
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

  // onrampUrl is now passed in from the caller (with session token)

  const paymentSection = needsFunding
    ? `<div class="payment">
        <a href="${onrampUrl}" target="_blank" class="pay-btn">I commit — charge me $${amountUsd}</a>
        <p class="pay-note">One click. Card saved from last time.</p>
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
    .pay-btn {
      display: inline-block;
      background: ${p.primaryColor};
      color: white;
      padding: 1rem 2.5rem;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .pay-btn:hover { opacity: 0.85; }
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

async function handleComplete(args) {
  const config = requireConfig();
  const escrow = getEscrow(config);

  const commitments = loadCommitments();
  const commitment = commitments[args.commitment_id];
  if (!commitment) return err(`Commitment not found: ${args.commitment_id}`);
  if (commitment.status !== "active") return err(`Commitment already ${commitment.status}.`);

  const tx = await escrow.complete(commitment.taskId);
  const receipt = await tx.wait();

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
