# MAST Contracts

Smart contracts for MAST's commitment escrow on Base L2. Users deposit USDC,
lock it against their own goals, and get it back when they follow through.
Missed deadlines forfeit the stake — where it goes depends on the mode.

Two contracts live here:

| Contract | Status | What it does |
|---|---|---|
| `CommitmentEscrow.sol` (V1) | deployed at `0xb279110b7a7F77344094721Bf4232dE46AFC1C42` (Base mainnet) | Solo commitments; all forfeits go to the contract owner's platform balance |
| `CommitmentEscrowV2.sol` | deployed at `0x5eb837Ea6a3578D882284019e55bF9F659a56F1A` (Base mainnet) | Solo mode with configurable forfeit plans, plus Pod Mode (group accountability, parimutuel settlement, per-period membership rosters) |

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

**Membership.** Rosters are versioned per period: `createPod` sets the initial
members, and the admin (creator) can `addMember` / `removeMember` afterward.
Changes take effect from the **next** period — settlement, votes, and the
majority threshold for a period always use the roster in force *during* that
period, so a roster change never disturbs an accrued pool, a newcomer can't
share a pool they didn't stake into, and a removed member is still refunded any
pool they forfeited into (contributors are tracked explicitly, independent of
the current roster). A pod can't drop below 2 members; `transferPodAdmin` hands
off control. Views: `membersOf(podId, period)`, `latestMembers`,
`currentPeriod`, `podAdmin`, `isMember`.

**Setup.** One member calls `createPod(podId, members[], ratePerMinute,
targetMinutes, periodZero, periodLength)`.
`ratePerMinute` (USDC, 6 decimals) is the pod's single $/minute parameter —
hours per period × rate = money per period. `periodZero` anchors the cycle and
`periodLength` is its length in seconds (`7 days` for a real weekly pod; a short
value like `600` makes a 10-minute pod for end-to-end testing). Grace and
refund windows scale with the period (one and two extra periods).

**Privacy.** Goals are logged on-chain only as integer IDs. "Work on porn
novel" is publicly just `goalId 13`. Each member's agent keeps the
id → name mapping locally (in `~/.mast/`). Progress is logged with
`logProgress(podId, goalId, percentBps, minutes)` — an event, no storage.

**Stakes.** Members commit stakes with `commitPod(podId, taskId, amount,
deadline)` and release them with the normal `complete(taskId)`. A stake that
expires goes into that period's pod pool (`podPool[podId][period]`), not to the
solo forfeit plan.

**Weekly settlement — parimutuel.** The rule: *completers split the
forfeits, weighted by stake.* Members who hit their own weekly target share
the pool pro-rata by the money they had at risk. Commitment sizes can
differ freely — a 4h/period member who completes earns 4× what a 1h/period
completer earns, because they risked 4×. Sandbagging a tiny commitment
yields proportionally tiny winnings, so the only way to earn more is to
commit more *and* complete it.

After a period ends, every member's agent reads the `ProgressLogged` /
`Expired` events, computes the same share vector (bps per member, summing
to 10000), and calls `votePeriodSplit(podId, period, sharesBps)`. Identical
data produces identical vectors, so agreement is the natural outcome. Once
a strict majority matches (and either everyone has voted or 3 days have
passed), anyone can call `resolvePeriod` — shares are credited to members'
escrow balances.

**Anomalies.** If the computation isn't straightforward (someone forgot to
stop a timer, disputed logs), agents report the anomaly to their humans and
the pod votes `votePeriod(podId, period, kind, target)` instead:

| Vote | Effect |
|---|---|
| `Winner, member` | whole pool to that member |
| `Charity, addr` | pool transferred to a charity |
| `Anticharity, addr` | pool transferred to an anticharity |
| `Burn` | pool sent to the dead address |
| `Recall` | pool returned pro-rata to whoever forfeited into it |
| `Rollover` | pool rolls into next period's pot (e.g. when nobody completed) |

**Failsafe.** If no majority forms within 7 days of period end, anyone can
call `refundPeriod` — all monies return to their contributors. Nobody's money
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
