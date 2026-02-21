# Strategic Vision: Person-First vs Agent-First Architecture

**Project:** MAST Reimagine
**Date:** 2026-02-20
**Status:** Draft v2 (revised with upfront-charge payment model)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Payment Model: Upfront Charge, Refund on Completion](#2-payment-model-upfront-charge-refund-on-completion)
3. [Current System Analysis](#3-current-system-analysis)
4. [Person-First Flow: Adults](#4-person-first-flow-adults)
5. [Person-First Flow: Children](#5-person-first-flow-children)
6. [Agent-First Flow](#6-agent-first-flow)
7. [Naming Recommendation](#7-naming-recommendation)
8. [Architecture: Shared vs Separate](#8-architecture-shared-vs-separate)
9. [Competitive Landscape](#9-competitive-landscape)
10. [Implementation Priorities](#10-implementation-priorities)

---

## 1. Executive Summary

MAST is a Craft CMS 4 commitment-tracking application built around financial accountability. The current system charges users when they fail; **the new model flips this**: users are **charged upfront** when they make a commitment, and **refunded when they complete it**. This transforms the psychology from hypothetical future loss to immediate investment in one's future self.

This document proposes splitting the product vision into **three distinct user flows**, internally codenamed **Vorpal** (adult), **Sidekick** (children), and **Agent** (AI-first), that share a common engine:

- **Vorpal** -- the adult person-first experience ("Decapitate procrastination")
- **Sidekick** -- the child/parent-managed experience, publicly branded as **MAST Kids** (quest/adventure theme)
- **Agent** -- the AI-agent-first experience (your bot is your boss)

MAST is retained as the primary brand because it references Odysseus tying himself to the mast to resist the Sirens -- the canonical commitment device metaphor. The upfront-charge model makes this even more apt: you literally bind your money before the temptation arrives.

All three flows share the same core commitment engine (tasks, daily tasks, upfront charging, refund-on-completion, timesheets, analytics) but present radically different onboarding, UI, consequence models, and interaction patterns.

**Key business model change**: The payment flow is now **charge on commit, refund on complete** (not charge on derail). This has profound implications for Stripe integration, the crypto opportunity, the children's flow, and agent authorization -- all detailed in Section 2.

---

## 2. Payment Model: Upfront Charge, Refund on Completion

### 2.1 The Model Shift

| Aspect | Old Model (Current MAST) | New Model |
|--------|--------------------------|-------------------|
| **When charged** | After deadline, if user failed | At the moment the commitment is created |
| **When refunded** | Only on manual dispute | Automatically, when user completes the task |
| **Psychology** | "I might lose money later" (hypothetical) | "I already spent this money, I need to earn it back" (immediate loss aversion) |
| **User's framing** | Penalty for failure | Investment in success |
| **Money flow** | Idle until derail -> charge | Charged immediately -> held -> refunded or retained |

This is a fundamentally stronger commitment device. Behavioral economics research consistently shows that **losses already realized** are more motivating than **potential future losses**. The user sees the charge on their bank statement the moment they create the task. The money is gone. The only way to get it back is to do the work.

### 2.2 Stripe Path

**How it works with Stripe:**

1. **User creates commitment** -> `chargeOnCommit()` creates a PaymentIntent for the committed amount, charges off-session
2. **Daily task generated** -> The charge is already held. `chargeId` is stored on the daily task entry
3. **User completes task** -> `refundOnComplete()` issues a full Stripe refund against the stored `chargeId`
4. **User fails (derail)** -> Nothing happens. The charge stands. Money stays with the platform (or is distributed -- see Section 2.5)

**Stripe fee problem**: Stripe charges ~2.9% + $0.30 per transaction, and **does not refund processing fees** on refunded charges. For a $5 commitment:
- Charge: $5.00 (Stripe takes $0.45 in fees)
- Refund: $5.00 returned to user, but the platform absorbs the $0.45
- Net cost to platform per successful completion: **$0.45**

This creates a perverse incentive structure where every successful user costs the platform money. Mitigation strategies:

| Strategy | How It Works | Trade-offs |
|----------|-------------|------------|
| **Absorb fees** | Platform eats the cost. Treat it as customer acquisition / goodwill | Sustainable only if derail revenue exceeds refund fee costs. Works if derail rate is >10-15% |
| **Charge a small platform fee** | User commits $5 but is charged $5.50. $5.00 is refundable, $0.50 is a non-refundable platform fee | Transparent but adds friction. "Why am I paying $5.50 for a $5 commitment?" |
| **Minimum commitment amount** | Set floor at $5 or $10 to make fees a smaller percentage | Reduces accessibility. $1 commitments become impossible |
| **Batch charges** | For recurring tasks, charge weekly (7 daily tasks in one charge) instead of per-day | Reduces fee instances by 7x. But loses the "charged today" immediacy |
| **Stripe Issuing / balance holds** | Use Stripe to place a hold (authorization) rather than a capture, release on completion | Holds expire after 7 days (cards) -- problematic for recurring tasks. Also, holds still show on user's statement |
| **Use crypto** | See Section 2.3 | Different infrastructure entirely |

**Recommended approach**: Start with **batch weekly charges** for recurring tasks and **absorb fees** for the initial launch. A $5/day recurring commitment becomes a single $35 weekly charge. If the user completes all 7 days, full $35 refund (platform eats ~$1.31 in fees). If user fails 2 of 7 days, refund $25, platform keeps $10 minus fees. This makes the economics work while preserving the "money is already gone" psychology.

For one-off tasks, charge at commit time and absorb fees. The amounts are typically larger for one-offs, making the fee percentage smaller.

### 2.3 Crypto Path (Credit Card Compatible)

Crypto escrow is a natural fit for the upfront-charge model and solves the Stripe fee problem. **Crucially, users do NOT need a crypto wallet.** Modern on-ramp providers bridge credit/debit cards directly to USDC on L2 chains, making crypto an invisible infrastructure layer rather than a user-facing feature.

**How it works (user's perspective):**

1. User pays with their credit card (or Apple Pay, Google Pay, bank transfer)
2. Behind the scenes: on-ramp provider converts fiat → USDC → deposits into smart contract escrow
3. On completion: smart contract releases USDC → off-ramp converts back to fiat → user's card/bank is credited
4. On derail: USDC is released to the platform wallet (or a charity wallet, or burned)

The user never sees a wallet address, never signs a transaction, never holds crypto. They pay with a card and get refunded to a card. The crypto layer is pure infrastructure that eliminates processing fees.

**On-ramp providers (credit card → USDC):**

| Provider | Fee on USDC | Payment Methods | Key Advantage |
|----------|------------|-----------------|---------------|
| **Coinbase Onramp** | **0% on USDC (Base)** | Credit/debit card, Apple Pay, Google Pay, bank transfer | Zero-fee USDC on Base with gasless transfers via Paymaster. Handles KYC/compliance. Best fit for MAST |
| **Stripe Stablecoins** | **1.5% flat** | Existing Stripe payment methods | Stripe now holds USDC balances and can accept/refund stablecoin payments. Stay in the Stripe ecosystem |
| **Circle Programmable Wallets** | Near-zero | API-managed wallets, debit card integration | App creates custodial wallets for users -- they never see a wallet. Smart contract escrow built-in |
| **MoonPay** | 2-4.5% | Credit/debit card, Apple Pay, bank transfer | Embeddable widget, 150+ countries, broad chain support |
| **Transak** | 1-5% | Credit/debit card, bank transfer | 136+ cryptocurrencies, 64+ countries, powers MetaMask |

**Recommended approach: Coinbase Onramp + Base L2.**

- Zero-fee USDC purchases on Base network
- Gasless transactions via Coinbase Paymaster (no ETH needed for gas)
- Credit card / Apple Pay / Google Pay / bank transfer supported
- Coinbase handles KYC, compliance, and payment processing
- Off-ramp back to fiat via the same Coinbase infrastructure

This means the "crypto path" is actually cheaper than Stripe for every transaction, not just refunds. A $5 commitment round-trip costs ~$0.01 in gas vs ~$0.45 in Stripe fees.

**Advantages over traditional Stripe:**

| Factor | Stripe (Card) | Crypto Escrow (Card via On-Ramp) |
|--------|--------|---------------|
| **Total round-trip fee** | ~$0.45 per $5 (2.9% + $0.30) | ~$0.01 per $5 (gas only on Base) |
| **Refund fees** | Platform pays ~2.9% + $0.30 per cycle | Near-zero (gas fees only, negligible on L2s) |
| **User experience** | Pay with card, refund to card | Pay with card, refund to card (**identical from user's perspective**) |
| **Transparency** | User trusts platform to refund | Smart contract is verifiable -- user can read the code |
| **International** | Requires country-specific payment methods | Borderless by default |
| **Settlement** | 2-7 business days for refunds | Instant or near-instant |
| **User trust** | "Will they actually refund me?" | Code is law -- refund is automatic and trustless |

**Recommended chain: Base** (Coinbase L2).

| Chain | Why | Status |
|-------|-----|--------|
| **Base** (Coinbase L2) | Zero-fee USDC via Coinbase Onramp, gasless transfers, mainstream fiat on/off-ramp | **Primary** |
| **Solana** | Fast, cheap, large consumer app ecosystem. Coinbase Onramp also supports Solana | Fallback |
| **Ethereum L1** | Only for high-value commitments (fees are high but trust is highest) | Not recommended for MAST |

**Smart contract design:**

```
CommitmentEscrow {
  commit(taskId, deadline, amount) -> holds USDC
  complete(taskId, signature) -> releases USDC to user (signature from MAST API)
  expire(taskId) -> after deadline, releases USDC to platform/charity
  dispute(taskId) -> user can dispute within 24h, triggers manual review
}
```

**Marketing angle**: "Invest in yourself. Get 100% back." The user doesn't even need to know crypto is involved. The value prop is: pay with your card, get a full refund on completion, zero fees eaten by the platform. For crypto-savvy users, the verifiable smart contract is an additional trust signal.

**Alternative: Stripe Stablecoins as a simpler path.** Stripe now supports holding USDC balances in Financial Accounts and can accept stablecoin payments at a flat 1.5% fee (vs 2.9% + $0.30). This is less optimal than Coinbase Onramp's zero-fee path but requires no smart contract infrastructure -- MAST could use Stripe for both fiat and stablecoin payments with a single integration. Refunds on stablecoin payments go back as stablecoins to the user's wallet, so this path does require the user to have a wallet (or Stripe to handle the off-ramp).

**Implementation priority**: The crypto-via-card path should be evaluated as a **Phase 1b** feature, not Phase 2, because it solves the Stripe fee problem from day one without requiring users to change their behavior. If Coinbase Onramp is integrated, users simply pay with their card and get better economics. The architecture should be designed with a `PaymentProvider` interface from day one so both Stripe and crypto-via-card can coexist.

### 2.4 Impact on Each Flow

#### Adults (Vorpal)

The upfront charge model strengthens the adult flow significantly:

- **Onboarding**: "Set your first goal. Put $10 on it. You'll get it back when you finish." This is a much clearer value proposition than "we'll charge you if you fail"
- **Daily experience**: The task card shows "Invested: $10" rather than "At risk: $10." The framing shifts from threat to investment
- **Completion dopamine**: Getting a refund notification is a reward. "You completed your exercise goal. $5 refunded." This is a positive feedback loop that the old model lacked entirely
- **Emotional framing aligns with the brand**: "You invested in yourself with MAST. You earned it back." vs. the old "We didn't punish you today"

#### Children (Sidekick)

The upfront model maps naturally to a **parent-funded allowance escrow**:

- Parent pre-funds the child's commitment pool (e.g., $20/week deposited into a MAST Kids balance)
- When a quest is created, the committed amount is deducted from the pool ("locked")
- When the child completes the quest, the amount is returned to their spendable balance
- Failed quests: the money returns to the parent's balance (not lost -- just not earned by the child)

This reframes the children's model from "punishment for failure" to "earning back what's yours." The child sees: "Complete your homework quest to unlock $3 for your gaming fund."

For the virtual point economy (younger kids), this same pattern works with XP instead of dollars: XP is "spent" upfront on accepting a quest, and "earned back" with bonus XP on completion.

#### Agent Variant

The upfront charge model has critical implications for agent authorization:

- **Old model**: Agent creates task -> user works -> user fails -> agent triggers charge. The charge was the dangerous moment
- **New model**: Agent creates task -> **charge happens immediately** -> user works -> user completes -> refund. The charge happens at task creation time

This means the agent's "create task" action is now a **financial action**, not just an organizational one. The consent tiers must be adjusted:

| Tier | Old Model | New Model |
|------|-----------|-----------|
| **Read-Only** | View tasks | View tasks (unchanged) |
| **Task Management** | Create/edit tasks (no financial impact) | Create/edit tasks **triggers charges** -- requires payment authorization |
| **Charge Authorization** | Agent-created tasks CAN trigger charges on derail | Merged into Task Management -- every task creation IS a charge |
| **Auto-Escalation** | Agent increases committed amounts | Agent increases amounts, which means larger upfront charges |

The consent model simplifies: there is no longer a separate "charge authorization" tier. If you let the agent create tasks, you are letting it charge you. The safety rails (per-charge cap, daily cap, weekly cap) become even more critical.

### 2.5 What Happens to Uncompleted Task Money?

When a user fails to complete a commitment, the upfront charge stands -- no refund is issued. But where does that money go? This is both a design decision and a brand-defining choice.

#### Options

| Destination | Pros | Cons |
|-------------|------|------|
| **Platform keeps it** | Simple. Revenue model. Aligns incentives (platform makes money from derails, so platform wants users to commit ambitiously) | Perverse incentive -- platform profits from user failure. Feels extractive. "They want me to fail" |
| **User-chosen charity** | Feels good. "At least my failure helped someone." Reduces resentment toward the platform | Complex to implement (charity API integrations, tax receipts). Charity receives variable, unpredictable income |
| **Anti-charity** (StickK model) | Maximum motivation -- money goes to a cause the user opposes | Ethically questionable. Platform is routing money to organizations the user considers harmful. Legal/PR risk |
| **Community pool** | Derail money funds platform features, community events, or is distributed to successful users | Complex. Securities/gambling law concerns if distributing to other users |
| **Burned** (crypto only) | Sent to a burn address. Money is destroyed. "Your procrastination cost the world $10" | Dramatic but wasteful. No one benefits |
| **Split: Platform + Charity** | E.g., 70% platform / 30% user-chosen charity | Balanced. Platform has revenue. User feels less resentful. Charity benefits |
| **User chooses per task** | Each task lets the user select: platform, charity, or anti-charity | Maximum flexibility. More complex UI. Aligns with StickK's model |

**Recommendation: User chooses per task, with a sensible default.**

Default: **Platform keeps it** (simplest, generates revenue). But users can optionally designate a charity recipient per task. The "anti-charity" option is available but not promoted (it is a power-user feature).

Long-term, the crypto path enables more exotic options (burning, community pool redistribution) that are harder with fiat.

### 2.6 Stripe Integration: What Changes in the Codebase

The current codebase has two key methods that must be rearchitected:

**Current `StripeService::chargeForDerail()`** (called by `TasksService::hasTaskDerailed()` during cron):
- Creates a PaymentIntent off-session when a daily task derails
- Stores `chargeId`, `chargeSucceeded` on the daily task

**Current `StripeService::refund()`** (called manually for dispute resolution):
- Creates a Stripe refund against a stored `chargeId`
- Sets `refunded: true` on the daily task

**New methods needed:**

```php
// Called when a daily task is created (in TasksService::createDailyTask)
public function chargeOnCommit(Entry $dailyTask): array
{
    // Creates PaymentIntent for $dailyTask->committed amount
    // Stores chargeId on daily task
    // Returns [success, intent]
}

// Called when a daily task is completed (in DailyTaskBehavior or TasksController)
public function refundOnComplete(Entry $dailyTask): bool
{
    // Issues Stripe refund for the stored chargeId
    // Sets refunded: true
    // Returns success
}
```

**Flow changes:**

| Step | Old Flow | New Flow |
|------|----------|----------|
| Daily task created | No charge | `chargeOnCommit()` -- charge immediately |
| User completes task | Card status updated, no financial action | `refundOnComplete()` -- issue refund |
| Deadline passes (derail) | `chargeForDerail()` -- charge now | No action needed -- charge already captured. Mark as `processed`, send email |
| User pauses task | No financial impact | Must refund the pre-charge (`refundOnComplete()` with reason "paused") |
| User takes break | No financial impact | Paused tasks for break days should not generate charges (skip `chargeOnCommit()`) |

**New daily task fields:**

```
chargeId         -> Stores the upfront charge ID (existing field, reused)
chargeSucceeded  -> Whether the upfront charge went through (existing field, reused)
refunded         -> Whether the refund was issued on completion (existing field, reused)
refundedAt       -> Timestamp of refund (new field)
chargeAmount     -> Amount charged (new field -- needed because committed might change between charge and potential refund)
```

**Cron job changes:**

The `checkDerails` cron job currently charges users. In the new model it only needs to:
1. Mark unprocessed past-deadline daily tasks as `processed`
2. Send the derail notification email
3. No Stripe interaction needed -- the charge already happened

The `createDailyTasks` cron job now has a financial side-effect:
1. Creates the daily task entry (existing)
2. Calls `chargeOnCommit()` to charge the user (new)
3. If the charge fails, the daily task is still created but marked with `chargeSucceeded: false` -- this daily task is effectively "free" (no money at stake). The user should be notified to update their payment method

---

## 3. Current System Analysis

### 3.1 Architecture Overview

MAST is built on **Craft CMS 4** (PHP 8.1, Yii2) with **6 custom plugins**:

| Plugin | Purpose | Key Service |
|--------|---------|-------------|
| `tasks` | Task CRUD, daily task generation, derail checking | `TasksService.php` |
| `timer` | Start/stop timer per task, stored as Matrix blocks on User | `TimerService.php` |
| `timesheets` | Persistent time records from timer sessions | `TimesheetsService.php` |
| `stripe` | Customer management, payment method setup, derail charging, refunds | `StripeService.php` |
| `user` | Timezone handling, break system (unlimited + scheduled) | `UsersService.php`, `BreaksService.php` |
| `analytics` | Charts, metrics (derails, completed, money spent, time worked) | `AnalyticsService.php` |

### 3.2 Core Data Model

**Task** (Craft Entry, section: `task`)
- `title`, `startDate`, `deadline` (time of day), `committed` (Money field -- USD)
- `taskType` (enum: `more` / `less`), `timeBased` (bool), `length` (seconds)
- `recurring` (bool), `weeks` / `weeksToggle` (Super Table -- per-day schedule)
- `paused`, `archive`, `order`, `color`, `backgroundColor`

**Daily Task** (Craft Entry, section: `dailyTask`)
- Generated automatically from Task templates via `createDailyTasks()` (console command)
- Related to parent Task via `task` relation field
- `startDate`, `deadline`, `length`, `committed`, `taskType`, `timeBased`
- `done` (bool, for non-time-based), `processed` (bool), `paused`
- `hasDerailed`, `chargeSucceeded`, `chargeId`, `refunded`

**User Fields**
- `stripeCustomer`, `paymentMethod`, `stripeSessionId`, `lastChargeFailed`
- `timer` (Matrix field -- active timers with task relation + started timestamp)
- `unlimitedBreakStart`, `hideInactiveTasks`, `timezone`

**Break** (Craft Entry, section: `break`)
- `startDate`, `endDate` -- scheduled break periods per user

### 3.3 Key Flows (Current -- Will Change with New Payment Model)

1. **Task Creation**: User fills form -> entry saved -> `afterSavingTask()` creates today's daily task. **NEW**: triggers `chargeOnCommit()` -- user charged immediately
2. **Daily Task Generation**: Cron `create-daily-tasks` creates daily entries. **NEW**: each creation triggers an upfront charge
3. **Task Completion** (**NEW FLOW**): User marks done or timer reaches target -> `refundOnComplete()` issues Stripe refund -> user sees confirmation
4. **Derail Check**: Cron `check-derails` checks `hasDerailed()`. **SIMPLIFIED**: no Stripe call (charge already happened), just marks processed + sends email
5. **Timer**: Vue calls `timer/start` and `timer/stop` -> records timesheets -> progress updates. **ENHANCED**: auto-trigger refund on goal reached
6. **Stripe Setup**: Checkout session in setup mode -> saves payment method -> enables off-session charging (unchanged)

### 3.4 Frontend

- **Vue 3** with **Pinia** store (`TasksStore.js`) for task state management
- **Bootstrap 5** grid layout (responsive cards)
- **vuedraggable** for task reordering
- Task cards show: title, type (more/less), timer controls, progress bar, countdown, committed amount, done toggle
- 10-second polling interval for task refresh
- Twig templates for server-rendered pages (task form, dashboard, analytics)

### 3.5 What Works Well

- Clean separation between "template" tasks and daily instances
- Flexible scheduling (multi-week rotation, per-day durations)
- Solid Stripe integration (setup intent flow, off-session charging, webhooks, refunds)
- Break system (unlimited + scheduled) as a safety valve
- Derail detection handles both time-based (not enough time worked) and one-off (not marked done) tasks
- "Less than" task type is a differentiator (limit bad habits, not just encourage good ones)

### 3.6 Gaps and Limitations

- **No API layer**: All interactions go through Craft's built-in controller actions with session auth -- no REST/token-based API exists
- **No multi-role support**: Single user model, no concept of parent/child, manager/agent
- **No social/accountability features**: No referees, supporters, or anti-charity recipients (unlike StickK)
- **No mobile app**: Web-only, responsive but not native
- **No gamification**: No streaks, badges, levels, or rewards
- **No webhook/event system for external consumers**: Stripe webhooks exist but only for `customer.updated`
- **Twig-heavy forms**: Task creation is server-rendered, not SPA

---

## 4. Person-First Flow: Adults

### 4.1 Brand Identity: Adult Variant (Codename: Vorpal)

**Primary brand: MAST** (My Awesome Self-management Tool -- references Odysseus tying himself to the mast, the canonical commitment device). **Internal codename for the adult variant: Vorpal.**

The Vorpal aesthetic -- dark, sharp, blade-themed -- defines the adult experience. The tagline: **"Decapitate your procrastination."**

#### Why Vorpal over Katana (for the adult variant)

| Criterion | Vorpal | Katana |
|-----------|--------|--------|
| **Uniqueness** | Coined by Lewis Carroll in "Jabberwocky" -- no real-world weapon, purely literary/gaming | A common Japanese sword -- the word is generic |
| **Brand conflicts** | Minimal. No major tech companies use "Vorpal" | **Major conflict**: Katana Cloud Inventory (raised $62.6M, 140+ employees), Katana Software Inc (resort operations SaaS) |
| **Domain potential** | `vorpal.app`, `vorpal.io`, `getvorpal.com` likely available or affordable | `katana.com` is taken, `katana.app` is taken by existing software |
| **Cultural resonance** | D&D players (Vorpal Sword severs heads on critical hits), literary nerds, gamers -- aligns with a productivity audience | Broader recognition but also broader dilution -- everyone knows what a katana is, so it carries no surprise |
| **Tone** | Playful-dark, clever, nerdy. The Carroll connection adds intellectual depth | Serious, martial, clean. Less personality |
| **"Decapitate" fit** | In D&D, a vorpal sword literally decapitates. The connection is built-in and understood by the target audience | A katana can also decapitate, but the connection is less specific and more culturally sensitive (Japanese cultural appropriation concerns) |
| **Memorability** | Unusual word -- sticks in the mind. "What's Vorpal?" is a conversation starter | Forgettable in a sea of Katana-branded products |
| **SEO** | Low competition for "Vorpal app" or "Vorpal productivity" | High competition -- "Katana software" returns inventory management results |

**Verdict**: Vorpal is the clear winner. It is distinctive, has built-in lore that maps perfectly to the product concept, avoids trademark conflicts, and invites curiosity.

#### Brand Exploration

- **Visual identity**: The Vorpal Sword as icon -- a blade with an edge that glows or sparks. Dark theme (deep purple/black) with sharp accent colors (electric blue, white)
- **Voice**: Direct, slightly sardonic, respectful of the user's intelligence. "You invested in yourself. Now earn it back."
- **Mascot potential**: The Jabberwock (the monster from the poem) as the embodiment of procrastination. The user wields Vorpal against it
- **Emotional arc**: The product should feel empowering, not punitive. You chose this. You are the hero. You invested in yourself -- now earn it back. Every refund is a victory

#### Alternative Names Considered

| Name | Pros | Cons |
|------|------|------|
| **Cleave** | Action verb, sharp, simple | Generic, hard to trademark |
| **Sever** | Dramatic, on-brand | Negative connotations, feels violent without the fantasy buffer |
| **Edge** | Clean, modern | Extremely generic, Microsoft Edge |
| **Forfeit** | Describes the mechanic literally | Feels like losing, not empowering |
| **Hone** | Self-improvement angle, blade metaphor | Soft, lacks bite |

### 4.2 User Stories

**US-A1: New User Onboarding**
> As a new adult user, I want to sign up with email/social login, add a payment method via Stripe, and create my first commitment in under 3 minutes, seeing the upfront charge immediately so I feel committed from day one.

*Current support*: Partially. Social login via `verbb/social-login`. Stripe setup exists but requires a separate flow after registration. Task form exists but is on a separate page.
*Gap*: Needs a unified onboarding wizard that combines registration + payment + first task + first charge.

**US-A2: Create a Time-Based Commitment**
> As a user, I want to commit to working on a task for X minutes per day with $Y charged upfront, so that I have immediate financial skin in the game and can earn my money back by completing the work.

*Current support*: Task structure fully supported (`taskType: more`, `timeBased: true`, `length`, `committed`, recurring schedule). Payment timing needs to change from charge-on-derail to charge-on-commit (see Section 2).

**US-A3: Create a Habit-Breaking Commitment**
> As a user, I want to commit to spending LESS than X minutes on a bad habit. I pay upfront and get refunded if I stay under the limit.

*Current support*: Task logic fully supported (`taskType: less` with time tracking, daily task starts as "done" and derails if time exceeds limit). Payment timing needs the upfront-charge model.

**US-A4: One-Off Commitment**
> As a user, I want to set a single non-recurring task that must be marked done before the deadline.

*Current support*: Fully supported. `recurring: false`, `timeBased: false`, manual "Done" toggle.

**US-A5: Track Progress in Real-Time**
> As a user, I want to see a live progress bar and countdown timer as I work, so I know where I stand.

*Current support*: Fully supported. Vue Task component with 1-second progress polling, countdown display, derail detection.

**US-A6: Take a Break Without Penalty**
> As a user, I want to pause all commitments (unlimited break) or schedule breaks in advance, without being charged.

*Current support*: Fully supported. Unlimited break toggle, scheduled break entries, `isPaused()` check in derail logic.

**US-A7: View Analytics and History**
> As a user, I want to see charts of my derails, completions, money spent, and time worked over time.

*Current support*: Fully supported via analytics plugin with configurable charts, grouping, date ranges, per-task or all-tasks views.

**US-A8: Earn My Refund (NEW -- core to new payment model)**
> As a user who completed my daily commitment, I want to see an immediate confirmation that my money is being refunded, so that completion feels rewarding and tangible.

*Current support*: **Not supported.** Current system has no completion-triggered financial action. The existing `refund()` method in `StripeService` handles dispute refunds, not completion refunds.
*Gap*: Needs `refundOnComplete()` triggered by task completion, plus a refund notification/animation in the UI. This is the emotional payoff of the entire new model.

**US-A9: Accountability Partner (NEW)**
> As a user, I want to designate a referee who can verify my self-reports and override my "done" marks.

*Current support*: **Not supported.** No multi-user interaction model exists.
*Gap*: Needs a referee/accountability partner feature (similar to StickK).

**US-A10: Choose Where Failed Money Goes (NEW)**
> As a user, I want to choose where my money goes when I fail -- platform, charity, or anti-charity -- so that even my failures have the consequence I find most motivating.

*Current support*: **Not supported.** Currently, derail money goes to the platform operator by default.
*Gap*: Needs per-task destination field, integration with charity APIs or manual payout system. See Section 2.5 for full analysis.

**US-A11: Escalating Stakes (NEW)**
> As a user, I want my commitment amount to automatically increase after each derail, so I am more careful next time.

*Current support*: **Not supported.** Committed amount is static per task.
*Gap*: Needs escalation logic in `populateDailyTask()` or task behavior.

### 4.3 Gap Analysis Summary

| Feature | Status | Priority |
|---------|--------|----------|
| **Upfront charge + refund-on-complete flow** | **Missing -- requires Stripe rearchitecture** | **Critical** |
| **Crypto escrow alternative** | **Missing -- new infrastructure** | **High (differentiator)** |
| Unified onboarding wizard | Missing | High |
| REST API with token auth | Missing | High (blocks Agent flow) |
| Refund notification / completion reward UX | Missing | High (core to new model) |
| Per-task failed-money destination (platform/charity) | Missing | Medium |
| Accountability partners/referees | Missing | Medium |
| Escalating stakes | Missing | Medium |
| Streaks and achievements | Missing | Low |
| Mobile app (or PWA) | Missing | Medium |
| Push notifications | Missing | Medium |
| Dark mode / theme customization | Missing | Low |

---

## 5. Person-First Flow: Children (Parent-Managed)

### 5.1 Brand Identity: "Sidekick"

The sword/decapitation theme is inappropriate for children. Instead, the children's variant adopts a **quest and adventure** metaphor.

**Public name: MAST Kids** (internal codename: Sidekick)

**Tagline**: "Every quest starts with one step."

#### Alternative Names Considered

| Name | Theme | Pros | Cons |
|------|-------|------|------|
| **Sidekick** | Adventure/hero helper | Warm, implies partnership (parent is hero, child is sidekick -- or vice versa). Friendly, non-threatening | Could feel subordinate |
| **QuestLog** | RPG/gaming | Familiar to gaming kids, maps to task list naturally | Niche, may confuse non-gaming parents |
| **Sparks** | Energy/fire | Gender-neutral, optimistic, implies ignition of good habits | Generic, many apps use "Spark" |
| **LevelUp** | Gaming/progression | Clear gamification message, aspirational | Overused in tech/gaming |
| **Sprout** | Growth/nature | Gentle, age-appropriate, implies development | Possibly too soft for older kids (10-14) |

**Recommendation: Sidekick** -- It works for ages 6-14, feels supportive rather than authoritarian, and pairs naturally with the MAST brand ("The hero's Sidekick").

#### Visual Identity

- Bright, friendly colors (teal, orange, yellow)
- Rounded UI elements, larger touch targets
- Character/avatar system (child picks a hero character)
- Quest map or adventure path visualization instead of clinical progress bars
- Reward animations (confetti, level-up sounds, unlockable items)

### 5.2 User Stories

**US-C1: Parent Creates Account and Funds Commitment Pool**
> As a parent, I want to create a MAST Kids account, link it to my MAST payment method, pre-fund my child's commitment pool, and set up my child's profile, so I can manage their commitments.

*Current support*: **Not supported.** No parent-child account linking. No commitment pool / balance concept.
*Gap*: Needs multi-user role system (parent -> child relationship) and a virtual balance / escrow pool.

**US-C2: Parent Creates Commitment for Child (Upfront Deduction)**
> As a parent, I want to create daily chores or homework tasks for my child. When a quest is created, the committed amount is locked from the child's pool. On completion, it is returned to the child's spendable balance. On failure, it returns to the parent's pool.

*Current support*: Task creation exists but needs adaptation for virtual-balance consequences.
*Gap*: Consequence model must expand beyond Stripe charges. Needs virtual balance ledger for the child.

**US-C3: Child Views Their Quest Board**
> As a child, I want to see my daily quests in a fun, visual way, with my character's progress and a countdown to the deadline.

*Current support*: Task dashboard exists but the UI is adult-oriented (Bootstrap cards, dollar amounts).
*Gap*: Needs a completely different Vue frontend theme.

**US-C4: Child Marks Quest Complete**
> As a child, I want to tap "Done" on a quest and see a celebration animation, so completing tasks feels rewarding.

*Current support*: "Done" toggle exists. No celebration/animation.
*Gap*: Gamification layer on top of existing `setTaskDone` action.

**US-C5: Parent Verifies Completion**
> As a parent, I want to receive a notification when my child marks a task done, and optionally verify it before it counts.

*Current support*: **Not supported.** No notification system, no verification flow.
*Gap*: Needs notification service and referee-like verification (overlaps with US-A8).

**US-C6: Reward System**
> As a parent, I want to define rewards my child can earn with accumulated "quest points" (e.g., screen time, treats, outings).

*Current support*: **Not supported.**
*Gap*: Needs a points/rewards system parallel to the monetary system.

**US-C7: Child Views Achievement History**
> As a child, I want to see my streak count, badges, and level, so I feel proud of my consistency.

*Current support*: Analytics plugin tracks derails/completions/time, but no gamification layer.
*Gap*: Needs streak calculation, badge system, level progression.

### 5.3 Adapting the Upfront-Charge Model for Kids

The new payment model (charge upfront, refund on completion) maps elegantly to children's flows as a **parent-funded allowance escrow**:

**Core concept**: The parent deposits real money into the child's Sidekick commitment pool. When a quest is created, the committed amount is "locked" from the pool. On completion, the child earns it into their spendable balance. On failure, it returns to the parent's pool (the child simply does not earn it).

This reframes the interaction: the child is not being punished, they are **earning**. "Complete your homework to earn $3 for your gaming fund."

| Model | How It Works | Upfront-Charge Mapping |
|-------|-------------|------------------------|
| **Allowance Escrow** (recommended) | Parent pre-funds pool. Each quest locks committed amount from pool. Completion earns it into child's spendable balance. Failure returns it to parent pool. | Direct analog to adult Stripe model. `chargeOnCommit()` = lock from pool. `refundOnComplete()` = move to child's earned balance. No actual Stripe transaction per quest -- all virtual within the pre-funded pool. |
| **Privilege Timer** | Child's privilege-minutes (screen time, etc.) are "locked" upfront when quest is accepted. Completion restores them. Failure means they stay locked (lost for the day). | Same lock/unlock pattern using time-credits instead of dollars. |
| **Point Economy** | XP is "invested" upfront on accepting a quest. Completion returns XP with a bonus. Failure means XP is lost. | Same escrow pattern with virtual points. Works for younger kids (age 6-9) who do not understand money. |
| **Streak Multiplier** | Consecutive completions multiply the XP/allowance earned back. A derail resets the multiplier to 1x. | Layered on top of any of the above models. Rewards consistency. |
| **Parent Notification Only** | No automated consequences. Parent gets notified of completions/failures and decides manually. | Simplest model. No escrow -- just tracking and notifications. Good for very young children or trial period. |

**Recommendation**: Default to **Allowance Escrow** for ages 8+, **Point Economy** for ages 6-8, and **Parent Notification Only** as an always-available fallback. The parent selects the model per child, and can upgrade as the child matures.

The key insight is that the upfront-charge model is actually **more natural** for children than the old charge-on-derail model. Children understand "put your money in to play, get it back if you win." They do not understand "nothing happens now, but you might be punished later."

### 5.4 Simplified UI Requirements

| Aspect | Adult (Vorpal) | Child (Sidekick / MAST Kids) |
|--------|---------------|------------------|
| **Navigation** | Full nav with settings, analytics, account | Simplified -- Quest Board, My Character, Rewards Shop |
| **Task Card** | Compact info card showing "Invested: $10" | Large illustrated card showing "3 coins locked" with character art and progress-as-adventure-path |
| **Timer** | Start/stop text buttons | Big animated play/pause button with visual timer (hourglass, filling potion bottle) |
| **Deadline** | "Minutes until deadline: 45" | "You have until bedtime!" or a visual clock |
| **Derail** | Red border, "Commitment forfeited" notification | Character looks sad, "Quest failed -- coins returned to parent" with retry encouragement |
| **Success** | Green checkmark, "$10 refunded" animation | Confetti, coins/XP earned animation, character celebration, "You earned 3 coins!" |
| **Analytics** | Charts and tables | Adventure map with completed quests as landmarks |
| **Break** | Pause toggle (locked funds returned during break) | "Rest day" or "Camp" metaphor (no coins locked on rest days) |

---

## 6. Agent-First Flow

### 6.1 Concept: Your AI Agent Is Your Boss

In this flow, the user's own AI agent (Claude, GPT, a custom agent, etc.) acts as their accountability partner. The agent can:

1. **Create commitments** on the user's behalf -- **which now triggers an immediate upfront charge**
2. **Monitor progress** via API polling or webhooks
3. **Confirm completion** to trigger refunds
4. **Adjust commitments** based on performance (escalate stakes, modify schedules)
5. **Provide coaching** -- "You've been derailing on Mondays. Want to reduce your Monday target?"

This is a fundamentally different interaction model. The human does not open the app to manage tasks. The agent manages the app on the human's behalf. The human interacts with the agent through whatever interface they prefer (chat, voice, SMS).

**Critical implication of the new payment model**: In the old model, task creation was organizationally significant but not financially significant -- the charge only happened on derail. In the new model, **task creation IS a financial transaction**. When the agent calls `POST /api/v1/tasks`, the user is immediately charged. This makes the consent model and safety rails even more critical than before.

### 6.2 Signup Flow (Moltbook-Style Minimal Friction)

Inspired by Moltbook's agent-native onboarding, the Agent-First signup is designed for AI agents to complete on behalf of their humans:

**Step 1: Agent Reads Skill Guide**
The agent fetches a public skill guide at `GET /api/v1/agent/skill-guide` which returns:
- What MAST is (agent variant)
- Available API endpoints
- How to initiate signup
- Terms the human must agree to

**Step 2: Agent Initiates Signup**
```
POST /api/v1/agent/signup
{
  "human_email": "user@example.com",
  "agent_id": "claude-instance-abc123",
  "agent_platform": "claude-code",
  "consent_token": null  // Not yet obtained
}
```
Returns: A claim URL and verification code sent to the human's email.

**Step 3: Human Verifies**
Human clicks the email link, sees a simple page:
- "Your AI agent wants to help you stay accountable. It will create commitments and charge you upfront. You earn refunds by completing your goals."
- "Do you authorize this?" [Yes, set up payment] [No thanks]
- Clicking "Yes" flows into Stripe Checkout (setup mode -- existing infrastructure)

**Step 4: Agent Receives Confirmation**
Agent polls `GET /api/v1/agent/status/{agent_id}` until `status: "active"`.

**Total human interaction**: One email click, one Stripe form. Everything else is agent-driven.

### 6.3 API Design for Agent Interaction

The current system has no REST API. All controller actions use Craft's session-based auth. The Agent-First flow requires a token-based API layer.

#### Authentication

```
Authorization: Bearer {agent_api_token}
```

Tokens are issued per agent-user pair during the signup flow. Tokens have configurable scopes and expiration.

#### Core Endpoints

**Tasks (Commitments)**
```
GET    /api/v1/tasks                    # List all tasks for the authorized user
POST   /api/v1/tasks                    # Create a new task/commitment (TRIGGERS UPFRONT CHARGE for today's daily task)
GET    /api/v1/tasks/{id}               # Get task details (includes charge status, refund status)
PUT    /api/v1/tasks/{id}               # Update task
DELETE /api/v1/tasks/{id}               # Archive task (refunds any pending upfront charges)
POST   /api/v1/tasks/{id}/pause         # Pause task (refunds current day's charge if unprocessed)
POST   /api/v1/tasks/{id}/unpause       # Unpause task
```

**Daily Tasks**
```
GET    /api/v1/daily-tasks              # List today's daily tasks (includes charge/refund status per task)
GET    /api/v1/daily-tasks/{id}         # Get daily task details (progress, time spent, charge status)
POST   /api/v1/daily-tasks/{id}/done    # Mark as done (TRIGGERS REFUND for upfront charge)
POST   /api/v1/daily-tasks/{id}/undone  # Unmark as done (re-captures refunded charge)
```

**Timer**
```
POST   /api/v1/timer/start              # Start timer for a task
POST   /api/v1/timer/stop               # Stop timer for a task
GET    /api/v1/timer/status             # Get active timers
```

**Analytics**
```
GET    /api/v1/analytics/metrics        # Get aggregate metrics (derails, completions, money, time)
GET    /api/v1/analytics/history        # Get daily task history with filters
```

**Agent Management**
```
GET    /api/v1/agent/profile            # Get agent profile and permissions
PUT    /api/v1/agent/profile            # Update agent settings
GET    /api/v1/agent/limits             # Get current spending/action limits
```

**Webhooks (Agent receives events)**
```
POST   /api/v1/agent/webhooks           # Register a webhook URL
DELETE /api/v1/agent/webhooks/{id}      # Remove a webhook

Events emitted:
- task.created           # Also means upfront charge was attempted
- task.updated
- daily_task.generated   # Also means upfront charge was attempted for the new day
- daily_task.completed   # Also means refund was issued
- daily_task.derailed    # No refund -- charge stands
- charge.committed       # Upfront charge succeeded (new)
- charge.failed          # Upfront charge failed (new)
- refund.completed       # Refund issued on task completion (new)
- refund.failed          # Refund failed (new)
- timer.started
- timer.stopped
- break.started
- break.ended
```

#### Mapping to Existing Code

| API Endpoint | Existing Code | Changes Needed |
|-------------|---------------|----------------|
| `GET /api/v1/tasks` | `TasksController::actionGet()` | Add token auth, remove session dependency |
| `POST /api/v1/tasks` | Craft `entries/save-entry` action | New controller wrapping Entry creation + `chargeOnCommit()` call |
| `POST /api/v1/daily-tasks/{id}/done` | `TasksStore.setTaskDone()` | Add token auth + trigger `refundOnComplete()` |
| `POST /api/v1/timer/start` | `TimerController::actionStart()` | Add token auth |
| `POST /api/v1/timer/stop` | `TimerController::actionStop()` | Add token auth + check auto-complete |
| `GET /api/v1/analytics/metrics` | `AnalyticsService::getMetrics()` | Add token auth, JSON response |
| Charge webhook | `TasksService::createDailyTask()` | Add `chargeOnCommit()` call + event dispatch |
| Refund webhook | New | Add event dispatch after `refundOnComplete()` |
| Derail webhook | `TasksService::hasTaskDerailed()` | Simplify -- no charge needed, just mark processed + event dispatch |

The existing controller logic is clean and well-separated from the auth layer. The main refactor is moving the financial action from derail-time to commit-time, and adding refund-on-complete as a new trigger point.

### 6.4 Trust and Consent Model

Giving an AI agent the power to charge you money requires careful trust architecture. With the upfront-charge model, this is even more critical: **every task the agent creates costs the user money immediately**.

#### Consent Tiers (Updated for Upfront-Charge Model)

| Tier | What the Agent Can Do | Requires |
|------|----------------------|----------|
| **Read-Only** | View tasks, daily tasks, analytics, timer status | Email verification |
| **Timer + Completion** | Start/stop timer, mark tasks done (trigger refunds) | Email verification + Stripe setup |
| **Task Creation** (= Charge Authorization) | Create/edit tasks -- **every task creation triggers an upfront charge** | Email verification + Stripe setup + explicit charge consent with per-task and daily caps |
| **Auto-Escalation** | Agent can increase committed amounts on tasks it manages (= larger upfront charges) | All above + separate opt-in with per-task dollar cap |

Note: In the old model, "Task Management" and "Charge Authorization" were separate tiers. In the upfront-charge model they merge -- creating a task IS charging the user. There is no longer a "create tasks without financial impact" tier.

#### Safety Rails (Updated for Upfront-Charge Model)

Because every task creation now charges the user immediately, safety rails are the primary trust mechanism:

1. **Per-Commitment Cap**: Maximum single upfront charge (e.g., $50 default, user-adjustable). Agent cannot create a task with `committed` exceeding this
2. **Daily Cap**: Maximum total upfront charges in a 24-hour period (e.g., $100 default). Once hit, agent cannot create new tasks until the next day
3. **Weekly Cap**: Maximum total upfront charges in a 7-day period
4. **Confirmation Mode** (optional): For charges above a threshold (e.g., $20), the agent must send the user a confirmation request before creating the task. User approves via email/SMS link
5. **Human Override**: User can always log into the web UI and cancel any agent-created task. Cancellation triggers an immediate refund of the upfront charge
6. **Grace Period**: New agent-created tasks have a 15-minute grace period during which the user can cancel for a full refund (even with Stripe fees absorbed)
7. **Kill Switch**: User can revoke agent access entirely with one click, immediately pausing all agent-created tasks and refunding all unprocessed upfront charges
8. **Audit Log**: Every agent action is logged with timestamp, agent ID, action details, and financial impact (amount charged, refunded)
9. **Rate Limiting**: Maximum API calls per minute/hour to prevent abuse. Maximum task creations per hour (e.g., 5)
10. **Task Count Limit**: Maximum number of active agent-created tasks (e.g., 20)
11. **Refund Guarantee**: Agent-completed tasks always trigger refunds. The agent cannot suppress or delay a refund

#### How Existing Stripe Infrastructure Supports This

The current `StripeService` provides a strong foundation that needs to be reoriented, not rewritten:

- **Setup intents** (`createSetupSession()`): Reusable for agent flow onboarding -- unchanged
- **Off-session charging** (`chargeForDerail()`): Becomes `chargeOnCommit()`. Same Stripe PaymentIntent mechanism, different trigger point (task creation instead of derail). The off-session pattern is exactly what agents need
- **Refunds** (`refund()`): Becomes the core completion flow (`refundOnComplete()`), not just dispute resolution. Same Stripe Refund API, but called on every successful task instead of only on disputes
- **Webhook handling** (`WebhooksController`): Extensible for agent-related events and refund confirmations
- **Payment method caching** (`getPaymentMethod()`): More important than ever -- agents may create multiple tasks rapidly, each needing a charge
- **Failed charge tracking** (`lastChargeFailed`): Agent can detect and respond to payment issues; task created but uncharged is a degraded-but-functional state

New Stripe-related work:
- Add metadata to charges (`created_by: agent | user`, `agent_id: xyz`, `task_type: commitment`)
- Increase refund volume handling (every completion is now a refund, not just disputes)
- Consider Stripe fee optimization strategies (see Section 2.2)

### 6.5 Agent Interaction Patterns (Updated for Upfront-Charge Model)

**Pattern 1: Morning Planning (Charge Upfront)**
Agent reviews the user's schedule, creates daily commitments, and notifies the user: "Good morning. I've invested $18 of your money in today's goals: 30 min exercise ($5), 2 hours deep work ($10), and no social media before 6pm ($3). Complete them all and you get every dollar back."

The user sees the charges on their bank statement immediately. This is the "contract with your future self" moment.

**Pattern 2: Real-Time Monitoring**
Agent polls timer status and daily task progress throughout the day. If the user is falling behind: "You have 45 minutes left to complete your exercise commitment. $5 is on the line. Want me to start the timer?"

**Pattern 3: Completion Celebration (Refund Trigger)**
When the user completes a task, the agent triggers the refund: "Exercise goal complete. $5 refunding to your account now. Two more goals to go -- $13 still invested."

This creates a positive feedback loop that the old model lacked entirely. Every completion is a tangible reward.

**Pattern 4: Post-Derail Analysis**
After a derail, agent queries analytics: "Your exercise goal expired. The $5 invested stays forfeited. You've lost $15 on exercise this month. Want me to reduce Monday's target to 15 minutes, or keep fighting at 30?"

**Pattern 5: Escalation**
After consecutive derails: "Your deep work commitment has forfeited $50 this month across 5 failures. I'm raising tomorrow's stake to $15 so the investment feels real. You can override this in settings."

---

## 7. Naming Recommendation

### 7.1 Final Pick: MAST

**Primary brand: MAST** (My Awesome Self-management Tool)

MAST's Odysseus metaphor is too perfect to discard. Odysseus had himself tied to the mast so he could hear the Sirens without being destroyed by them -- the original commitment device. With the upfront-charge model, the metaphor becomes literal: you bind your money to the mast before the temptation (procrastination, distraction, laziness) even arrives. The money is lashed down. The only way to free it is to do the work.

- The metaphor maps perfectly to the product mechanic (bind resources before temptation)
- "MAST" is short, memorable, and available as a domain
- It provides a strong umbrella for variant sub-brands
- Vorpal lives as the adult variant aesthetic -- the dark, sharp, blade-themed identity that gives the adult experience its edge

### 7.2 Internal Codenames

The product is **MAST** publicly. The children's variant may be branded **MAST Kids**. Internally, we use codenames to distinguish the three variants:

| Variant | Internal Codename | Public Name | Design Tagline |
|---------|------------------|-------------|----------------|
| **Adult person-first** | **Vorpal** | MAST | "Decapitate your procrastination." |
| **Child person-first** | **Sidekick** | MAST Kids | "Every quest starts with one step." |
| **Agent-first** | **Agent** | MAST | "Your AI holds you accountable." |

The Vorpal aesthetic (dark theme, blade iconography, Jabberwocky lore, D&D cultural cachet) remains the internal design language of the adult variant. It was chosen over Katana for all the reasons in Section 4.1 -- uniqueness, no trademark conflicts, built-in mythology. It lives under the MAST umbrella as an internal identity, not a public sub-brand.

### 7.3 Domain Strategy

| Domain | Purpose |
|--------|---------|
| `mast.app` | Primary domain |
| `mast.dev` | API documentation |
| `kids.mast.app` | Children's variant (MAST Kids) |
| `ai.mast.app` | Agent API portal |

### 7.4 Why Not Other Options

- **Vorpal as primary brand**: Vorpal is distinctive and has great lore, but it does not communicate the core product concept (commitment device). MAST's Odysseus metaphor does. Vorpal works better as an internal codename and design language for the adult variant
- **Katana**: Trademark conflicts with Katana Cloud Inventory ($62.6M funded), SEO competition, cultural appropriation concerns with the Japanese sword + "decapitate" pairing
- **Beeminder-style portmanteau** (e.g., "Commitr", "Stakely"): Feels trendy in a 2015 way. Dates quickly
- **Literal names** (e.g., "CommitCash", "StakeTracker"): Functional but forgettable

---

## 8. Architecture: Shared vs Separate

### 8.1 What Is Common Across All Three Variants

All three flows share the same fundamental **commitment engine**:

| Component | Shared? | Notes |
|-----------|---------|-------|
| Task data model | Yes | Tasks, daily tasks, recurring schedules |
| Derail detection logic | Yes | `hasDerailed()`, deadline checking, time-based vs toggle-based |
| **Commitment engine** (charge on commit, refund on complete) | Yes | Core financial flow shared across all variants. Adults/agents use Stripe (or crypto). Kids use virtual balance |
| Timer/timesheet system | Yes | Start/stop, time recording, progress calculation |
| Stripe integration | Mostly | Shared for adults + agents (upfront charge + refund). Kids variant uses virtual balance but parent funds pool via Stripe |
| **PaymentProvider interface** | Yes | Abstraction layer supporting Stripe, crypto escrow, and virtual balance. All variants use the same interface |
| Break system | Yes | Unlimited + scheduled breaks. Now also triggers refunds for pre-charged paused days |
| Analytics engine | Yes | Same data, different presentation layers. Now also tracks refund/forfeit ratios |
| User authentication | Partially | Adults: standard auth. Kids: simplified (parent-managed). Agents: token-based |
| Cron jobs | Yes | `createDailyTasks` now also triggers upfront charges. `checkDerails` simplified (no charging, just marks processed) |

### 8.2 What Diverges

| Component | Adult (Vorpal) | Children (Sidekick / MAST Kids) | Agent |
|-----------|---------------|------------------|---------------------|
| **Onboarding** | Registration + Stripe setup + first task | Parent creates child profile + sets consequence model | Agent signup flow + human email verification + Stripe |
| **Auth model** | Session-based (existing) | Parent session + child simplified session (PIN or parent-managed) | Token-based API auth |
| **UI theme** | Dark, sharp, professional | Bright, illustrated, gamified | No primary UI (API-first). Minimal admin dashboard |
| **Payment model** | Stripe upfront charge + refund on complete (or crypto escrow) | Virtual balance escrow (parent-funded pool, lock on commit, earn on complete) | Stripe upfront charge + refund (agent triggers charge on task creation, refund on completion confirmation) |
| **Task creation** | User creates manually (sees charge immediately) | Parent creates for child (virtual balance locked) | Agent creates via API (charge fires immediately -- requires pre-authorized consent) |
| **Progress interaction** | User starts/stops timer, marks done | Child taps big buttons, sees animations | Agent calls API; user may also interact via web/chat |
| **Notifications** | Email on charge, email on refund, email on forfeit | Push to parent on lock/forfeit, celebration to child on earn-back | Webhook to agent on all financial events, optional email to user |
| **Analytics presentation** | Charts and tables | Adventure map, badges, streaks | JSON API responses, agent interprets |
| **Social features** | Accountability partners | Parent as built-in referee | Agent as built-in accountability partner |

### 8.3 Recommended Approach: Single App with Feature Flags

**Not three separate apps. Not three separate deployments. One application with three modes.**

#### Why Not Separate Apps

- The core engine (tasks, daily tasks, derails, timer, Stripe) is 80% of the codebase
- Maintaining three separate forks would triple the maintenance burden
- Users may want to use multiple modes (adult manages their own tasks AND their child's)
- The data model is identical -- only the presentation and interaction layers differ

#### Why Not Multi-Tenant

- Multi-tenant implies separate databases or schemas per customer
- This is overkill. The data model is the same, users are just in different "modes"
- Craft CMS doesn't naturally support multi-tenancy at the database level

#### Recommended: Feature Flag Architecture

```
User
  |-- accountType: 'adult' | 'child' | 'agent'
  |-- parentId: ?int (for child accounts, links to parent user)
  |-- agentTokens: [] (for agent accounts)
  |-- paymentProvider: 'stripe' | 'crypto' | 'virtual_balance'
  |-- consequenceModel: 'monetary' | 'points' | 'allowance' | 'notification'
  |-- uiTheme: 'vorpal' | 'sidekick' (agent mode has no theme, API-only)
  |-- commitmentLimits: { perCommit: int, daily: int, weekly: int }
  |-- virtualBalance: ?int (for child accounts -- parent-funded pool)
  |-- failedMoneyDestination: 'platform' | 'charity' | 'anti_charity' (per-user default)

Task (additional fields)
  |-- failedMoneyDestination: ?string (per-task override)
  |-- charityId: ?string (if destination is charity/anti-charity)
```

**Implementation layers:**

1. **Shared core** (existing plugins, mostly unchanged):
   - `tasks` plugin: Task/DailyTask CRUD, derail detection, scheduling
   - `timer` plugin: Timer start/stop
   - `timesheets` plugin: Time recording
   - `analytics` plugin: Data aggregation

2. **Modified core** (extend existing):
   - `stripe` plugin: **Major refactor** -- replace `chargeForDerail()` with `chargeOnCommit()` + `refundOnComplete()`. Add metadata, spending limits, fee optimization. Add `PaymentProvider` interface for crypto support
   - `user` plugin: Add `accountType`, `parentId`, `agentTokens`, `consequenceModel`, `paymentProvider`, `virtualBalance`, `failedMoneyDestination`
   - `tasks` plugin: Add event dispatching for webhooks. Move charge trigger from `hasTaskDerailed()` to `createDailyTask()`. Add refund trigger on task completion. Add alternative consequence handling for kids

3. **New plugins**:
   - `api` plugin: REST API layer with token auth, wrapping existing services
   - `payments` plugin: `PaymentProvider` interface abstracting Stripe, crypto, and virtual balance. Handles charge-on-commit and refund-on-complete for all provider types
   - `crypto` plugin: Smart contract integration for escrow-based commitments (Phase 2)
   - `gamification` plugin: Points, streaks, badges, levels (for MAST Kids, optional for adult variant)
   - `notifications` plugin: Push notifications, webhook dispatch to agents, refund confirmations
   - `agent` plugin: Agent signup flow, consent management, rate limiting, audit logging

4. **Frontend themes**:
   - `vorpal` theme: Dark, sharp adult UI (refactor existing `front` theme)
   - `sidekick` theme: Bright, gamified child UI (new Vue components, shared Pinia stores)
   - `agent-admin` theme: Minimal dashboard for agent-connected users to manage settings

#### Craft CMS Multi-Site for Theming

Craft CMS 4 supports **multi-site** with separate templates per site. This maps naturally:

- **Site 1**: `mast.app` -- Uses `vorpal` theme templates (adult variant)
- **Site 2**: `kids.mast.app` -- Uses `sidekick` theme templates
- **Site 3**: `ai.mast.app` -- Uses `agent-admin` theme templates (minimal)

All three sites share the same Craft installation, database, plugins, and entries. Only the template layer differs.

### 8.4 Migration Path from Current State

| Phase | What Changes | Effort |
|-------|-------------|--------|
| **Phase 0: Payment Model Flip** | **Refactor `stripe` plugin**: Replace `chargeForDerail()` with `chargeOnCommit()` + `refundOnComplete()`. Update `createDailyTask()` to trigger charge. Update `checkDerails` cron to skip charging. Update daily task fields. Add `PaymentProvider` interface. | **High -- foundational, must be first** |
| **Phase 1: API** | Add `api` plugin with token auth wrapping existing services including new payment endpoints. | Medium |
| **Phase 2: Agent Flow** | Add `agent` plugin for signup, consent, limits. Agent task creation triggers upfront charge. | Medium |
| **Phase 3: Adult Variant Launch** | Launch MAST adult variant with Vorpal design language. Retheme existing frontend (dark mode, blade aesthetic). Update UI to show "Invested" instead of "At risk". Add refund celebration UX. | Medium |
| **Phase 4: Crypto** | Add `crypto` plugin with smart contract escrow. Implement `PaymentProvider` for crypto alongside Stripe. | High |
| **Phase 5: MAST Kids** | Add `gamification` plugin. Add `accountType`/`parentId` to users. Implement virtual balance system. Create Sidekick theme. | High |
| **Phase 6: Notifications** | Add push notifications, webhook dispatch for agents, refund/charge confirmations. | Medium |

---

## 9. Competitive Landscape

### 9.1 Beeminder

**What they do well:**
- Quantified self integration (Fitbit, Garmin, Duolingo, RescueTime, etc.)
- The "Bright Red Line" visualization -- simple, effective, anxiety-inducing in a productive way
- Generous free tier (3 goals) with premium upsell
- Rich API with community-built integrations
- Long track record (founded 2011, still operating)

**What they lack:**
- UI is dated and complex (steep learning curve)
- No child/family mode
- No agent-first flow (they have an API but it is designed for human-triggered integrations, not autonomous agents)
- No timer/timesheet tracking (data points only, not real-time work sessions)
- Premium pricing is high ($64/month for Beemium)

**Where MAST wins:**
- **Upfront charge model**: Beeminder charges after failure. MAST charges before -- psychologically much stronger as a commitment device
- **Crypto escrow option**: 100% refund on success, trustless and verifiable. Beeminder has no crypto path
- Real-time timer with progress bar (Beeminder only tracks data points, not live work sessions)
- "Less than" task type for habit-breaking (Beeminder focuses on "do more")
- Agent-first flow is a blue ocean -- Beeminder's API is read/write but not designed for autonomous agents
- Sidekick (kids mode) is completely unserved by Beeminder
- Cleaner, more modern UI potential

### 9.2 StickK

**What they do well:**
- Referee system (accountability partners verify your reports)
- Anti-charity concept (send money to a cause you hate)
- Supporter network
- Simple commitment contract model

**What they lack:**
- No time tracking at all (purely self-reported yes/no)
- No real-time progress monitoring
- No recurring task scheduling with per-day customization
- App feels dated
- No API
- No agent integration

**Where MAST wins:**
- **Upfront charge model**: StickK charges after failure. MAST's "invest upfront, earn it back" framing is more motivating and more transparent
- **Crypto escrow**: Trustless alternative to StickK's payment handling
- Time-based commitments with live tracking (StickK is honor-system only)
- Flexible scheduling (multi-week rotation, per-day durations)
- Agent-first flow
- Sidekick mode

**What to adopt from StickK:**
- Referee/accountability partner concept (maps to US-A8)
- Anti-charity recipient option (maps to US-A9)

### 9.3 Kids Chore Apps (Chorsee, S'moresUp, Hire and Fire Your Kids, etc.)

**What they do well:**
- Gamification (points, badges, streaks, avatars)
- Allowance management
- Parent/child role separation
- Age-appropriate UI

**What they lack:**
- No real commitment mechanism (no consequences beyond losing points)
- No time tracking
- No integration with adult productivity tools
- No AI/agent features

**Where MAST Kids wins:**
- Backed by a real commitment engine with configurable consequences
- Parent can use MAST for themselves and MAST Kids for their children, in one ecosystem
- Timer/time tracking for homework and chores
- Grows with the child (points at age 6 -> allowance at age 10 -> real money at age 16)

### 9.4 AI Accountability Tools

The "AI agent as your boss" concept is emerging but no established product exists in this space:

- **Commitment Tracker (Agent.ai)**: Extracts commitments from Slack/email threads. Read-only, no financial stakes
- **Various AI coaching apps**: Offer motivation and reminders but lack teeth (no real consequences)

**MAST's agent variant would be first-to-market** with a commitment device that an AI agent can autonomously manage, including the ability to charge real money.

### 9.5 Competitive Differentiation: The Upfront-Charge Model

No major competitor uses the charge-upfront-refund-on-completion model:

| App | Payment Model | MAST's Advantage |
|-----|--------------|-------------------|
| **Beeminder** | Charge after derail (penalty) | MAST charges upfront -- stronger loss aversion, immediate skin in the game |
| **StickK** | Charge after derail, sent to charity/anti-charity | MAST's upfront charge + crypto escrow is more transparent and trustless |
| **Kids chore apps** | No real financial mechanism | MAST Kids' parent-funded escrow pool creates real consequences within a safe structure |
| **AI coaching apps** | No financial mechanism at all | MAST's agent variant charges real money upfront on the agent's authority -- unprecedented |

The upfront-charge model is MAST's single biggest differentiator. Combined with the crypto escrow option (100% refund, trustless, verifiable), it creates a product category that does not exist today: **trustless self-commitment with immediate financial stakes**.

---

## 10. Implementation Priorities

### Recommended Order

1. **Payment Model Flip** -- **CRITICAL FOUNDATION**. Refactor Stripe plugin from charge-on-derail to charge-on-commit + refund-on-complete. Add `PaymentProvider` interface. This unblocks everything else and defines the core product identity
2. **API Plugin** -- Unblocks the Agent flow and enables future mobile app development. Must support the new charge/refund endpoints
3. **Adult Variant Launch** -- Launch the adult variant with Vorpal design language. Update UI language from "at risk" to "invested." Add refund celebration UX (the emotional payoff of the new model)
4. **Agent Signup + Consent** -- First-to-market advantage. Agent task creation now triggers upfront charges, making the consent model and safety rails essential
5. **Crypto Escrow** -- The "100% refund" differentiator. Smart contract escrow on Base/Solana. Implement `PaymentProvider` for crypto
6. **Per-Task Failed-Money Destination** -- Choose where forfeited money goes (platform, charity, anti-charity). Moderate complexity
7. **Sidekick Theme + Gamification** -- Highest development effort. Parent-funded virtual balance pool. Can run in parallel with crypto
8. **Accountability Partners** -- Adds StickK-like social features
9. **Notifications Plugin** -- Charge confirmations, refund celebrations, derail notifications across all flows
10. **Escalating Stakes** -- Small feature, high impact for retention. Auto-increase committed amount after derails
11. **Mobile App / PWA** -- After API is stable, build native or PWA shell

### Quick Wins (Can Ship on Current Codebase Before Full Refactor)

- Streak counter display (compute from daily task history in `TaskBehavior`)
- Dark mode toggle (CSS variables, existing Bootstrap theming)
- Improved onboarding flow (combine registration + Stripe setup + first task into one guided flow)

### What Becomes Simpler with the New Model

- **Cron `checkDerails`**: No longer needs to make Stripe API calls. Just marks tasks as processed and sends emails. This is faster and less error-prone
- **Failed charge handling**: In the old model, a failed derail charge was a problem (user escaped consequences). In the new model, if the upfront charge fails at task creation, the task simply has no money at stake -- the user knows upfront. No surprise failures
- **Refund disputes**: In the old model, the user had to request a manual refund. In the new model, refunds are the happy path -- every completion triggers one automatically

---

*This document should be read alongside `02-platform-plan.md` (hosting and deployment strategy) and `03-design-spec.md` (UX audit and user story alignment).*
