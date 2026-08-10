# MAST — My Awesome Self-management Tool

Put real money on your goals. MAST is a commitment escrow system: you
deposit USDC on Base, your AI agent locks it against your commitments, and
you get it back when you follow through. Miss the deadline and the stake is
forfeited — the point isn't to lose money, it's to make the cost of
procrastination real enough that you don't. Go solo, or form a
[pod](#pod-mode--group-accountability) with friends where missed stakes pool
and split among whoever actually showed up.

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

The repo ships a project-scoped `.mcp.json` that registers the `mast` server
with a portable path (`${CLAUDE_PROJECT_DIR}/mast-mcp/index.js`), so when you
open the cloned repo in Claude Code it offers to enable the server — just
approve it. No per-machine path editing needed.

If you'd rather register it manually (or use it from another directory):

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
   Rainbow, …), **plus a little ETH on Base for gas** (see below). MAST never
   touches fiat or processes payments.

> **You need ETH on Base, not just USDC.** MAST is self-custodial: it signs
> its own transactions with a local wallet and pays gas in ETH — there is no
> gasless/paymaster path in the implementation. With zero ETH, `mast_setup`
> still succeeds but your **first commit fails on gas**. Send ≈$1–2 of ETH on
> Base to the same wallet address once; Base gas is cheap, so that lasts a
> long time. USDC is what you *stake*; ETH is what *pays for the transactions*.

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

## Pod Mode — group accountability

Two or more people put money on their *own* goals and hold each other
accountable. Each period (weekly by default) the stakes people **miss** pool
together and — on a majority vote — **split among the members who hit their
targets, weighted by how much each staked**. Complete everything and there's
nothing to lose; slack off and your forfeit funds the people who showed up.
A 4-hour-a-week member who follows through earns proportionally more than a
1-hour member, because they put more at risk — so you can't game it by
committing tiny.

Pods run on the **V2 contract**
(`0x5eb837Ea6a3578D882284019e55bF9F659a56F1A` on Base mainnet), separate from
solo commitments. Each member has their own wallet and runs their own MCP —
the server always acts as *one* member (you).

### One-time setup (each member)

Exactly the same as [Installation](#installation) + [Setup](#setup) above:
clone, `npm install`, `claude mcp add mast`, say **"set up MAST"**, and fund
your wallet with USDC **and a little ETH for gas** on Base (see the note in
[Setup](#setup)). Do this once; it works for both solo commitments and pods.

### Forming a pod

1. **Share addresses.** Everyone tells the others their wallet address (it's
   in the `mast_setup` output, or ask your agent "what's my MAST address?").
2. **Agree on a label.** Any shared phrase — e.g. `sibling-sprint`. The label
   deterministically derives the on-chain pod id, so *everyone must type the
   exact same label* (case-insensitive).
3. **Agree on the terms.** The single `$/minute` rate and the period length
   (default 7 days).
4. **One member creates it:** *"Create a pod called sibling-sprint with me
   and 0xBrother… at $0.20/min, weekly."* → `mast_pod_create` registers all
   members on-chain.
5. **Every other member joins:** *"Join the pod sibling-sprint."* →
   `mast_pod_join` reads it from the chain into their local state. (Creating
   registers everyone on-chain; joining is how the others get a local copy so
   they can stake and vote.)

### Changing the roster

The pod **admin** (whoever created it) can add or remove members —
*"add 0xNewPerson to the pod"* (`mast_pod_add_member`) or *"remove 0xBrother"*
(`mast_pod_remove_member`). Changes **take effect from the next period**, never
retroactively:

- Membership is snapshotted per period, so settlement, votes, and the majority
  threshold for a period always use the roster that was in force *during* that
  period. Nothing already accrued is disturbed.
- A newly-added member can't share a pool they didn't stake into — they only
  count from their first full period. After being added they run
  `mast_pod_join` to sync locally.
- A removed member keeps every claim from periods they were part of, their
  balance is untouched (withdraw anytime), and any pool they forfeited into is
  still refundable to them.
- A pod can't drop below 2 members. To swap someone in a 2-person pod, add
  first (→3), then remove (→2). Admin can hand off with a transfer.

This also fixes the **ghost-member** problem: a member who goes silent still
counts toward quorum and can stall every vote into the refund failsafe —
removing them lets the pod settle normally again.

### Running a pod

Just talk to your agent — it maps to the `mast_pod_*` tools:

> **"Stake $20 on finishing chapter 3 by Friday in the sibling pod."** —
> `mast_pod_commit`. Your goal's *name* stays on your machine; only an integer
> goalId goes on-chain.
>
> **"Log 45 minutes, 60% done on chapter 3."** — `mast_pod_log_progress`
> (public: goalId + percent + minutes, never the name).
>
> **"I finished chapter 3."** — `mast_pod_complete`, your stake returns.
>
> **"Expire my missed stakes."** — `mast_pod_expire`, forfeits them into the
> pool at period end.
>
> **"Pod status."** — `mast_pod_status`: members, pool, everyone's votes, your
> balance.

At the end of a period, each member's agent reads the chain, computes the
same completers-split-by-stake vector, and votes (`mast_pod_vote`); once a
majority matches, anyone runs `mast_pod_resolve` and the pool pays out. If
something's disputed (a timer left running, a bad log), members can instead
vote to send the pool to a charity, an anticharity, burn it, roll it over,
refund everyone, or award one member. If a vote stalls, a failsafe refunds
all contributors.

**Privacy.** Other members only ever see "goalId 3, 60%, 45 min" — the goal's
name lives solely in your local `~/.mast/pods.json`.

**Current manual step.** Missed stakes only pool once expired; today each
member runs `mast_pod_expire` at period end. Automating this in the nightly
daemon is on the roadmap.

## Solo forfeit plans

By default a missed solo stake is forfeited to the platform. On the V2
contract you can instead route your forfeits — *"send my forfeits 50% to a
burn address, 30% to charity, 20% back to my cold wallet"* →
`mast_set_forfeit_plan`. Any weighted mix of an address you control, a
charity, an anticharity, the burn address, or the MAST project (weights must
sum to 100%). See [contracts/README.md](contracts/README.md) for the
mechanics and the destination registry.

## Roadmap

- Auto-expire overdue pod stakes in the nightly settle daemon (so pools fund
  and periods resolve without anyone running `mast_pod_expire` by hand).
- Pod messaging via Telegram/WhatsApp (stub in `mast-mcp/pod-notify.js`).
