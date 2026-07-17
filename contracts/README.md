# MAST Contracts

Smart contracts for MAST's commitment escrow on Base L2. Users deposit USDC,
lock it against their own goals, and get it back when they follow through.
Missed deadlines forfeit the stake — where it goes depends on the mode.

Two contracts live here:

| Contract | Status | What it does |
|---|---|---|
| `CommitmentEscrow.sol` (V1) | deployed at `0xb279110b7a7F77344094721Bf4232dE46AFC1C42` (Base mainnet) | Solo commitments; all forfeits go to the contract owner's platform balance |
| `CommitmentEscrowV2.sol` | source ready, not yet deployed | Solo mode with configurable forfeit plans, plus Pod Mode (group accountability with weekly winner-takes-pool) |

## Setup & deployment

Prerequisites: Node 18+, a funded deployer wallet (a few dollars of ETH on
Base for gas).

```bash
cd contracts
npm install

# Compile
npx hardhat compile

# Deploy V2 to Base Sepolia (testnet) first
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-v2.js --network baseSepolia

# Deploy V2 to Base mainnet
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-v2.js --network base
```

The deploy script picks the right USDC address per network automatically.
After deploying, point your MAST MCP server at the new address: tell your
agent to run `mast_setup` with the contract address, or edit
`escrowContract` in `~/.mast/config.json`.

The deployer becomes the contract **owner**: forfeits from users with no
forfeit plan accumulate in `platformBalance`, withdrawable only by the owner
via `withdrawPlatform`. If you don't want to trust someone else's deployment,
deploy your own copy — the contract is fully self-service and the owner has
no power over user balances, commitments, or pods.

## Solo mode — forfeit plans

By default a missed deadline forfeits your stake to the platform (contract
owner). With `setForfeitPlan(targets[], weightsBps[])` you choose where your
forfeits go instead. Weights are basis points and must sum to 10000. Up to 8
entries, any mix of:

1. **An address you control** — the money isn't really gone (weakest
   motivation, zero risk)
2. **The MAST project address** — a thanks-for-the-tool tip
3. **The burn address** — `0x000000000000000000000000000000000000dEaD`
   (USDC rejects the zero address, so this is the canonical burn; the money
   is gone forever)
4. **A charity** that accepts crypto on Base — see
   [`../mast-mcp/registry/forfeit-destinations.json`](../mast-mcp/registry/forfeit-destinations.json)
5. **An anticharity** — an org you'd hate to fund; the strongest motivator
6. **Any weighted combination** of the above summing to 100%

Example — 50% burned, 30% to charity, 20% back to your cold wallet:

```solidity
setForfeitPlan(
  [0x...dEaD, 0xCharity..., 0xYourColdWallet...],
  [5000, 3000, 2000]
)
```

`clearForfeitPlan()` reverts to the platform default. The plan applies at
expiry time, so changing it affects only future forfeits.

## Pod mode

Two or more people hold each other accountable with a shared stake rate.

**Setup.** One member calls `createPod(podId, members[], ratePerMinute,
weeklyMinutes, weekZero)`. The member list is fixed at creation.
`ratePerMinute` (USDC, 6 decimals) is the pod's single $/minute parameter —
hours per week × rate = money per week. `weekZero` anchors the weekly cycle.

**Privacy.** Goals are logged on-chain only as integer IDs. "Work on porn
novel" is publicly just `goalId 13`. Each member's agent keeps the
id → name mapping locally (in `~/.mast/`). Progress is logged with
`logProgress(podId, goalId, percentBps, minutes)` — an event, no storage.

**Stakes.** Members commit stakes with `commitPod(podId, taskId, amount,
deadline)` and release them with the normal `complete(taskId)`. A stake that
expires goes into that week's pod pool (`podPool[podId][week]`), not to the
solo forfeit plan.

**Weekly settlement.** After a week ends, every member's agent reads the
`ProgressLogged` events, computes who made the most progress against their
goals, and calls `voteWeek(podId, week, Winner, <address>)`. Once a strict
majority agrees (and either everyone has voted or 3 days have passed),
anyone can call `resolveWeek` — the pool pays out to the winner's escrow
balance.

**Anomalies.** If the computation isn't straightforward (someone forgot to
stop a timer, disputed logs), agents report the anomaly to their humans and
the pod votes on what to do with the pool instead:

| Vote | Effect |
|---|---|
| `Winner, member` | pool to that member |
| `Charity, addr` | pool transferred to a charity |
| `Anticharity, addr` | pool transferred to an anticharity |
| `Burn` | pool sent to the dead address |
| `Recall` | pool returned pro-rata to whoever forfeited into it |

**Failsafe.** If no majority forms within 7 days of week end, anyone can
call `refundWeek` — all monies return to their contributors. Nobody's money
can get stuck on a stalled vote.

**Messaging (stub).** Pod nudges/announcements via Telegram/WhatsApp are
planned but not built — see `../mast-mcp/pod-notify.js`.

## Design notes

- The owner role exists only to collect default-routed forfeits. It cannot
  touch user balances, block completions, or interfere with pods.
- `expire` is permissionless by design: your own agent (or any pod member's
  agent) triggers it after the deadline.
- `complete` has no deadline check — expiry is enforced by the race with
  `expire`. This also serves as an escape hatch: if a forfeit-plan target
  were ever USDC-blacklisted (making `expire` revert), the user could still
  recover funds via `complete`.
- Forfeit-plan payouts are push transfers; pod winner payouts credit the
  internal escrow balance (withdraw whenever).
