# MAST — My Awesome Self-management Tool

Put real money on your goals. MAST is a commitment escrow system: you
deposit USDC on Base, your AI agent locks it against your commitments, and
you get it back when you follow through. Miss the deadline and the stake is
forfeited — the point isn't to lose money, it's to make the cost of
procrastination real enough that you don't.

## How it works

1. You tell your agent (Claude Code with the MAST MCP server) what you're
   committing to: *"20 minutes of writing every weekday, $8 a day."*
2. The agent locks $8 of your escrowed USDC against today's deadline on an
   escrow smart contract on Base.
3. You do the work (optionally tracked with the bundled CLI timer).
4. Complete → your money returns. Miss → it's forfeited. Partial, on
   time-logged commitments → pro-rata: the earned fraction returns.
5. Recurring commitments re-lock automatically each period; a nightly
   settlement daemon handles the bookkeeping.

Nobody holds your money except the contract: deposits, commits, completions,
and withdrawals are all self-service from your own wallet. The contract
owner only ever receives forfeits you route to them.

## Repository layout

| Path | What it is |
|---|---|
| `mast-mcp/` | MCP server exposing the `mast_*` tools, plus dashboard (`server.js`), nightly settlement daemon (`settle.js`), and status board (`status.js`) |
| `mast-timer/` | CLI time tracker (`timer.js`) — sessions feed pro-rata settlement |
| `contracts/` | Solidity escrow contracts + deployment docs ([README](contracts/README.md)) |
| `.claude/skills/` | `/mast-status` and `/mast-frontend` slash commands for Claude Code |
| `CLAUDE.md` | Agent instructions: onboarding flow, strictness levels, funding |

## Installation

Prerequisites: Node 18+, [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/aut-dev/MAST.git
cd MAST/mast-mcp && npm install
```

Register the MCP server with Claude Code:

```bash
claude mcp add mast -- node /absolute/path/to/MAST/mast-mcp/index.js
```

## Setup

Open Claude Code in the repo (so it picks up `CLAUDE.md`) and say
**"set up MAST"**. The agent walks you through:

1. **Technical setup** — `mast_setup` generates a fresh wallet and stores it
   in `~/.mast/config.json`. **Back this file up: it is the only copy of
   your private key.** The default escrow contract on Base mainnet is
   `0xb279110b7a7F77344094721Bf4232dE46AFC1C42`; deploy your own from
   [`contracts/`](contracts/README.md) if you'd rather not trust anyone
   else's.
2. **Profile & strictness** — name your agent, then choose how hard it
   should push back when you try to cancel or claw back a stake, from
   **iron** (no exceptions, ever) to **chill** (honor system). Overridable
   per commitment.
3. **Commitments** — list what you're procrastinating on; the agent prices
   each item, totals a weekly cost, and confirms it with you.
4. **Funding** — `mast_fund` shows your wallet address and the recommended
   amount. Send USDC on Base from any wallet (Coinbase app, MetaMask,
   Rainbow, …). MAST never touches fiat or processes payments.

## Daily use

You just talk to your agent:

> **"start writing"** — starts the timer on your writing commitment
>
> **"stop studying"** — stops the timer; the minutes count toward today's target
>
> **"I brushed my teeth"** / **"I completed the tax filing"** — reports
> completion of a one-off or non-timed commitment; your stake comes back
>
> **"start writing, back-time it five minutes"** — you were already working
>
> **"how am I doing?"** / **/mast-status** — balances, today's progress
> bars, hours to deadline
>
> **/mast-frontend** — live web dashboard (shareable with a secret token)

Time-logged commitments also settle automatically at midnight via the
nightly daemon — pro-rata if you fell short. Vacation days can be excluded
per commitment.

Under the hood the agent drives a CLI you can also use directly (most
people won't need to):

```bash
node mast-timer/timer.js start writing
node mast-timer/timer.js stop writing
node mast-timer/timer.js today                   # progress vs targets
node mast-timer/timer.js start writing --ago 5   # started 5 min ago
```

## Roadmap

- **Forfeit plans** (contract ready, not yet deployed): route forfeits to
  an address you control, the MAST project, a burn address, charities, an
  anticharity, or any weighted mix. See [contracts/README.md](contracts/README.md).
- **Pod Mode** (contract ready): group accountability — a shared $/minute
  rate, goals logged on-chain as anonymous integer IDs, weekly parimutuel
  settlement where completers split the forfeits weighted by stake, and
  member voting for anomalies.
- Pod messaging via Telegram/WhatsApp (stub in `mast-mcp/pod-notify.js`).
