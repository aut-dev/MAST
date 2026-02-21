# 02 - Platform Plan: Website + Mobile App Hosting Strategy

> **Status:** Draft
> **Date:** 2026-02-20
> **Scope:** Hosting, mobile strategy, API architecture, payment model, infrastructure for the MAST commitment app

---

## Table of Contents

1. [Current Stack Assessment](#1-current-stack-assessment)
2. [Payment Model Architecture](#2-payment-model-architecture)
3. [Website Hosting Options](#3-website-hosting-options)
4. [Mobile App Strategy](#4-mobile-app-strategy)
5. [API Architecture](#5-api-architecture)
6. [Human-Centric UI Platform Requirements](#6-human-centric-ui-platform-requirements)
7. [Agent-First Platform Requirements](#7-agent-first-platform-requirements)
8. [Infrastructure Architecture](#8-infrastructure-architecture)

---

## 1. Current Stack Assessment

### What We Have Today

| Layer | Technology | Version |
|-------|-----------|---------|
| CMS / Framework | Craft CMS 4 (Yii 2) | ^4.0 |
| Language | PHP | 8.1 |
| Database | MySQL | 5.7+ |
| Frontend framework | Vue 3 | ^3.3.4 |
| CSS framework | Bootstrap | ^5.1.3 |
| Build system | Webpack 5 | ^5.51.1 |
| State management | Pinia | ^2.1.6 |
| Charts | Chart.js + vue-chartjs | ^4.4.0 / ^5.2.0 |
| Payments | Stripe (custom plugin) | Custom |
| Templating | Twig (server) + Vue SPA (client) | - |
| Error tracking | Sentry | via craft-sentry-logger |
| Auth | Craft built-in (session/cookie) | - |
| Social login | verbb/social-login | ^1.0 |

### Custom Plugins (6)

| Plugin | Purpose | Key Endpoints |
|--------|---------|---------------|
| `tasks` | CRUD for commitment tasks | `actionGet`, `actionReorder`, `actionCheckEditTask` |
| `timer` | Start/stop timer on tasks | `actionStart`, `actionStop` |
| `timesheets` | Paginated timesheet records | `actionGet` |
| `analytics` | Charts CRUD + data queries | `actionSaveChart`, `actionCreateChart`, `actionDeleteChart`, chart data endpoint |
| `stripe` | Checkout, portal, charge-on-derail, refunds | `actionCreateCheckoutSession`, `actionRetrievePortalSession`, `actionRefund` |
| `user` | Breaks, timezone, preferences | `actionGet` (breaks), `actionSetUnlimitedBreak`, `actionChangeTimezone`, `actionCheckSession` |

### Pros of the Current Stack

- **Working product.** The app exists and functions. Tasks, timers, payments, and analytics all work.
- **Craft CMS admin panel.** Content editors can manage entries, users, and settings without developer help.
- **Vue 3 + Pinia frontend.** Modern, composable frontend code that can be extracted and reused.
- **Custom plugins return JSON.** The controllers already behave like a basic REST API, returning `$this->asJson()` responses.
- **Craft 5 LTS until 2031.** No immediate forced migration. Craft 5 is supported with security patches until 2031.
- **Craft 6 moves to Laravel (Q4 2026).** The framework is converging on Laravel, which aligns with every option below.

### Cons / Limitations

- **Craft CMS overhead.** The CMS layer (content modeling, admin panel, element queries) adds complexity that a SaaS app doesn't need. We're using Craft as an application framework, not a CMS.
- **Yii 2 is a dead end.** The Yii ecosystem is shrinking. Finding Yii developers is harder than finding Laravel developers. Craft 6 acknowledges this by moving to Laravel.
- **Session-only authentication.** All controllers use `Craft::$app->user->identity` (session-based). There is no token-based auth, making mobile and agent API access impossible without changes.
- **No API versioning.** Endpoints are coupled to Craft's routing. No `/api/v1/` namespace, no versioning strategy.
- **No rate limiting.** No middleware for rate limiting on any endpoint.
- **Twig + Vue hybrid.** Pages are server-rendered Twig templates with Vue components mounted into them. This tight coupling makes it hard to extract the frontend for mobile or headless use.
- **Webpack + jQuery legacy.** The build still provides jQuery globally and uses an older Babel setup. The legacy bundle adds build complexity.
- **No CORS configuration.** The backend assumes same-origin requests. Mobile/agent clients would need CORS headers.
- **No automated testing.** PHPStan is configured, but there are no unit or integration tests for the custom plugins.
- **Payment model is backwards.** The current Stripe plugin uses `chargeForDerail()` -- charging users *after* they fail. The new business model requires the opposite: charge upfront on commitment, refund on completion. This is a fundamental architectural change that affects the entire payment flow, not just a config tweak.

---

## 2. Payment Model Architecture

### Business Model Change: Charge Upfront, Refund on Completion

The payment model is shifting fundamentally:

| Aspect | Old Model (Current) | New Model |
|--------|-------------------|-----------|
| **When charged** | After failure (derail) | At time of commitment |
| **Trigger** | `chargeForDerail()` on deadline miss | `chargeOnCommit()` when task is created/activated |
| **Refund** | Manual user-requested refund | Automatic `refundOnComplete()` when task is completed |
| **Psychology** | Hypothetical loss ("I might lose $5") | Immediate loss ("I already paid $5, I need to earn it back") |
| **Money flow** | User keeps money until failure | Platform holds money; user earns it back |

**Why this is more motivating:** Loss aversion is now immediate. The money has already left the user's account. They are literally investing in their future self. Completing the task feels like getting paid, not just avoiding a penalty.

### Current Stripe Code (What Needs to Change)

The existing `StripeService.php` has two key methods:

```php
// CURRENT: charges user AFTER they fail
public function chargeForDerail(Entry $task): array
{
    $amount = MoneyHelper::toNumber($task->committed) * 100;
    $intent = $this->getClient()->paymentIntents->create([
        'amount' => $amount,
        'description' => 'Derail for task ' . $task->title,
        'off_session' => true,
        'confirm' => true,
        // ...
    ]);
}

// CURRENT: manual refund requested by user after derail charge
public function refund(Entry $daily): bool
{
    $this->getClient()->refunds->create([
        'reason' => 'requested_by_customer',
        'charge' => $daily->chargeId
    ]);
}
```

These must be replaced with:

```php
// NEW: charges user WHEN they commit to a task
public function chargeOnCommit(Entry $task): array
{
    // Creates a PaymentIntent, charges immediately
    // Stores paymentIntentId on the task for later refund
}

// NEW: automatic refund when task is completed successfully
public function refundOnComplete(Entry $dailyTask): bool
{
    // Refunds the original charge via stored paymentIntentId
    // Triggered automatically by task completion logic
}
```

### Payment Path Analysis

#### Path 1: Stripe (Fiat Currency)

**Flow:**
1. User commits to task with $X amount.
2. System calls `chargeOnCommit()` -- PaymentIntent created and confirmed immediately.
3. Stripe charges the user's card. Stripe takes ~2.9% + $0.30 processing fee.
4. Money sits in platform's Stripe balance.
5. On task completion: system calls `refundOnComplete()` -- Stripe processes refund.
6. **Problem:** Stripe does not return processing fees on refunds. On a $5.00 commitment, Stripe takes $0.45 (2.9% + $0.30). The user gets back $5.00, but the platform absorbs $0.45 per round trip.

**Fee impact analysis:**

| Commitment | Stripe Fee (charge) | Stripe Fee (refund) | Total Platform Cost | Platform Cost % |
|-----------|--------------------|--------------------|--------------------| --------------|
| $1.00 | $0.33 | $0.00 | $0.33 | 33.0% |
| $5.00 | $0.45 | $0.00 | $0.45 | 9.0% |
| $10.00 | $0.59 | $0.00 | $0.59 | 5.9% |
| $25.00 | $1.03 | $0.00 | $1.03 | 4.1% |
| $50.00 | $1.75 | $0.00 | $1.75 | 3.5% |

Note: Stripe does not charge an additional fee to process the refund itself, but the original processing fee is non-refundable. The platform pays the fee on every commitment, regardless of outcome.

**Mitigation strategies for Stripe fee erosion:**
- **Minimum commitment amount.** Set a floor of $5 to keep fee percentage below 10%.
- **Partial refund.** Refund commitment minus platform fee (e.g., $5 commitment, $4.55 refund). Transparent to user. The $0.45 covers Stripe fees exactly.
- **Batch weekly charges.** Instead of charging per-task, aggregate the week's commitments into a single charge on Monday. One $25 charge instead of five $5 charges saves $1.22 in fees.
- **Stripe Connect escrow alternative.** Use Stripe Connect with manual payouts to hold funds for up to 90 days without a separate charge/refund cycle. This avoids the double-fee problem entirely but requires Stripe Connect setup.

**Recommended Stripe approach: Stripe Connect with delayed payouts.** Instead of charge-then-refund:
1. User adds a payment method (existing flow).
2. On commit: charge via Stripe Connect, hold funds in platform's connected account.
3. On completion: transfer the full amount back to the user (payout, not refund -- avoiding double fees).
4. On failure: retain the funds as revenue.

This changes the flow from PaymentIntent -> Refund (loses fees) to PaymentIntent -> Transfer/Payout (no refund fees).

#### Path 2: Crypto via Credit Card (USDC Escrow with Fiat On-Ramp)

**Key insight: Users do NOT need a crypto wallet.** Modern on-ramp providers (Coinbase Onramp, Stripe Stablecoins, MoonPay, Transak) bridge credit/debit cards directly to USDC on L2 chains. The crypto layer becomes invisible infrastructure — users pay with their card and get refunded to their card.

**Flow (user sees credit card, infrastructure uses USDC):**
1. User commits to a task and pays with their credit card (or Apple Pay, Google Pay, bank transfer).
2. On-ramp provider converts fiat → USDC and deposits into a smart contract escrow on Base.
3. On task completion: smart contract releases USDC → off-ramp converts back to fiat → credited to user's card/bank.
4. On failure: USDC released to the platform's wallet (or a charity address).

**On-ramp provider comparison:**

| Provider | Fee on USDC | Payment Methods | Integration |
|----------|------------|-----------------|-------------|
| **Coinbase Onramp** | **0% on Base** | Card, Apple Pay, Google Pay, bank | SDK/widget, handles KYC. Gasless via Paymaster |
| **Stripe Stablecoins** | **1.5% flat** | All Stripe methods | Financial Accounts hold USDC. Single integration for fiat + crypto |
| **Circle Programmable Wallets** | Near-zero | API-managed wallets, debit card | App-managed custodial wallets, smart contract escrow built-in |
| **MoonPay** | 2-4.5% | Card, Apple Pay, bank | Embeddable widget, 150+ countries |
| **Transak** | 1-5% | Card, bank | 136+ cryptos, 64+ countries |

**Recommended: Coinbase Onramp + Base L2.**
- Zero-fee USDC purchases and off-ramps on Base
- Gasless transactions via Coinbase Paymaster (no ETH needed)
- Credit card / Apple Pay / Google Pay / bank transfer
- Coinbase handles KYC, compliance, payment processing
- $5 commitment round-trip: ~$0.01 gas vs ~$0.45 Stripe fees

**Advantages over traditional Stripe:**

| Factor | Stripe (Card) | Crypto via Card (Coinbase + Base) |
|--------|--------|---------------|
| **Round-trip fee ($5)** | ~$0.45 (2.9% + $0.30) | ~$0.01 (gas only) |
| **User experience** | Pay with card, refund to card | Pay with card, refund to card (**identical**) |
| **Full refund** | No — platform absorbs fees | Yes — near 100% |
| **Transparency** | Trust platform | Verifiable smart contract |
| **Settlement** | 2-7 business days | Instant |
| **International** | Country-specific methods | Borderless |

**Remaining challenges:**
- **Smart contract risk.** Bugs in the contract could lock or lose funds. Requires audit.
- **Regulatory uncertainty.** Money-transmission implications vary by jurisdiction. The GENIUS Act (2025) provides the first federal framework for payment stablecoins.
- **Oracle problem.** Smart contract relies on MAST API to signal completion — a trusted oracle, not fully trustless.
- **On-ramp availability.** Coinbase Onramp may not be available in all markets initially.

**Recommended chain: Base** (Coinbase L2). Zero-fee USDC, gasless, native fiat on/off-ramp.

**Smart contract design:**

```
Contract: CommitmentEscrow
  - deposit(taskId, amount, deadline) -> locks USDC (funded via Coinbase Onramp from user's card)
  - complete(taskId) -> platform calls to release USDC to user (off-ramped back to card)
  - expire(taskId) -> after deadline, platform calls to claim funds
  - cancel(taskId) -> user cancels before deadline starts (if allowed)
```

**Alternative: Stripe Stablecoins.** Stripe now supports holding USDC balances in Financial Accounts, accepting stablecoin payments at 1.5% flat fee, and paying out in stablecoins via Connect. This is simpler than Coinbase Onramp (single Stripe integration for everything) but costs more (1.5% vs 0%) and doesn't use smart contract escrow. It's a middle ground between pure Stripe and full crypto.

#### Path 3: Hybrid (Stripe + Crypto via Card)

**Recommended approach for launch:**

| Phase | Payment Method | Target Users | Fee |
|-------|---------------|-------------|-----|
| Phase 1 (Launch) | Stripe Connect (card payments) | All users. Familiar, trusted. | 2.9% + $0.30 |
| Phase 1b (Fast-follow) | Coinbase Onramp + Base (card → USDC → escrow) | All users. Same card UX, zero crypto fees. | ~$0.01 gas |
| Phase 2 (3-6 months) | Direct wallet connection (MetaMask, Phantom) | Crypto-native users who want trustless escrow | ~$0.01 gas |

The backend API abstracts the payment method. The commitment endpoints accept a `payment_method` field:

```json
POST /api/v1/commitments
{
  "title": "Write 500 words",
  "commitment_amount_cents": 500,
  "payment_method": "stripe"    // or "usdc_solana", "usdc_base"
}
```

### Uncompleted Task Money: Where Does It Go?

When a user fails to complete a commitment, the escrowed money needs a destination. Options:

| Option | Description | Pros | Cons |
|--------|------------|------|------|
| **A. Platform revenue** | Money stays with the platform | Simple, funds operations | Users may resent "paying to fail" |
| **B. Charity donation** | Money goes to a user-chosen charity | Feels positive even on failure; tax implications | Complex (charity integrations, receipts) |
| **C. Anti-charity** | Money goes to a cause the user *opposes* | Maximum motivation (stickK model) | Controversial, complex to implement |
| **D. Split** | % to platform, % to charity | Balanced motivation and sustainability | More complex accounting |
| **E. Rollover pool** | Failed funds subsidize future commitments | "Your failures fund your next attempt" | Accounting complexity |

**Recommendation for launch:** **Option D (70/30 split).** 70% retained as platform revenue to cover operations and Stripe fees. 30% donated to a curated list of charities (user picks at signup). This creates a positive narrative ("even your failures do good") while sustaining the business.

For the **crypto path**, this becomes elegantly programmable: the smart contract automatically splits funds to the platform wallet (70%) and a charity wallet (30%) on expiry.

### MAST Kids (Sidekick Variant): Parent-Funded Escrow

The upfront charge model maps naturally to a children's allowance system:

1. **Parent pre-funds** a commitment account (like loading a prepaid card).
2. Child commits to tasks. Each commitment deducts from the pre-funded balance.
3. On completion: funds return to the child's "reward balance" (can be withdrawn as allowance or used for in-app rewards).
4. On failure: funds go to a "lost" pool (parent decides: forfeit, re-add to balance, or donate).

No real Stripe charges per child commitment. The parent's initial funding is the only Stripe transaction, minimizing per-task fee erosion.

**Implementation:** A `wallet` model with `balance`, `held`, and `available` fields. Commitments move funds from `available` to `held`. Completion moves from `held` back to `available`. Failure moves from `held` to platform revenue (or parent-configured destination).

---

## 3. Website Hosting Options

### Option A: Stay on Craft CMS (Upgrade to Craft 5, Then 6)

> Note: All hosting options below must support the new upfront-charge payment model, which requires reliable queue processing (for async refunds on completion) and scheduled tasks (for deadline expiry checks). This favors Laravel with Horizon/queues over simpler hosting setups.

**Approach:** Upgrade from Craft 4 to Craft 5 now, then to Craft 6 (Laravel-based) when it ships in Q4 2026.

**Hosting options for Craft:**

| Provider | Type | Starting Price | Notes |
|----------|------|---------------|-------|
| Servd | Managed Craft PaaS | ~$50/mo (Starter) | Craft-specific, zero-devops, staging included, asset CDN |
| Laravel Forge | Server management | $12/mo + VPS ($6-24/mo) | Provisions DigitalOcean/AWS/etc. Not Craft-specific but works. |
| DigitalOcean Droplet | Self-managed VPS | $12-24/mo | Full control, more ops work |
| Arcustech | Managed Craft hosting | ~$35/mo | Craft-optimized single VPS |

**Pros:**
- Least disruption. Minimal code changes for v4 -> v5 upgrade.
- Craft 6 will bring Laravel ecosystem benefits (Eloquent, Sanctum, queues, etc.) with a Yii adapter for backward compatibility.
- Existing plugins may work in Craft 6 without changes via the Yii-to-Laravel adapter.

**Cons:**
- We're waiting until Q4 2026 for the Laravel benefits we need now (Sanctum tokens, proper API middleware, rate limiting).
- Still carrying CMS overhead for a SaaS product.
- Craft 5 upgrade requires PHP 8.2+ and plugin compatibility review.

### Option B: Migrate to Laravel (Fresh Backend)

**Approach:** Build a new Laravel backend that replaces Craft's role. Migrate the data models, business logic, and API endpoints. Keep Vue 3 frontend.

**Hosting options for Laravel:**

| Provider | Type | Starting Price | Notes |
|----------|------|---------------|-------|
| Laravel Forge + Laravel VPS | Managed provisioning | $12/mo + $6/mo VPS | First-party Laravel tooling, zero-downtime deploys |
| Laravel Vapor | Serverless (AWS Lambda) | $39/mo + AWS usage | Auto-scaling, no server management |
| DigitalOcean App Platform | Managed PaaS | $12/mo | Git-push deploys, auto-scaling |
| Railway / Render | Modern PaaS | $5-20/mo | Simple deploys, good DX |

**Pros:**
- Full access to Laravel ecosystem immediately: Sanctum (API tokens), middleware (rate limiting, CORS), Eloquent ORM, queues, broadcasting, scheduling.
- Massive developer talent pool. Laravel is the de facto PHP standard.
- Clean separation of concerns: API backend + SPA frontend + mobile app.
- Purpose-built for the app's needs, not constrained by CMS patterns.
- Direct path to supporting mobile and agent clients.

**Cons:**
- Migration effort. Need to rebuild data models, authentication, Stripe integration, and all 6 plugin controllers.
- Lose Craft admin panel. Would need to build admin features or use Laravel Nova/Filament.
- Data migration from Craft's element-based schema to Laravel's Eloquent models.

### Option C: Migrate to Modern JS Stack (Nuxt 3 / Next.js)

**Approach:** Replace the entire backend with a Node.js-based stack. Use Nuxt 3 (Vue-based SSR) or Next.js (React-based SSR) with a separate API layer.

| Provider | Type | Starting Price | Notes |
|----------|------|---------------|-------|
| Vercel | Edge/serverless | Free tier, $20/mo Pro | Native Next.js/Nuxt support |
| Netlify | Edge/serverless | Free tier, $19/mo Pro | Good for JAMstack |
| Railway | Container PaaS | $5/mo | Flexible, good for APIs |
| AWS Amplify | Managed | Pay-as-you-go | Full AWS integration |

**Pros:**
- Single language (TypeScript) across frontend and backend.
- Nuxt 3 would let us keep Vue components and knowledge.
- Modern edge deployment, serverless scaling.
- Rich ecosystem for real-time features (WebSockets, Server-Sent Events).

**Cons:**
- Complete rewrite of all backend logic (PHP to TypeScript/Node).
- Lose PHP ecosystem expertise.
- Stripe PHP SDK would need replacement with Stripe Node SDK.
- Node.js is less battle-tested for financial/payment workloads than PHP.
- Highest migration risk and longest timeline.

### Recommendation: Option B - Migrate to Laravel

**Rationale:**

1. **Craft 6 is going Laravel anyway.** The industry and the CMS itself validate Laravel as the right PHP framework. Rather than waiting for Q4 2026 and dealing with a Craft 6 migration, we can go directly to Laravel now and have full control.

2. **API-first is the priority.** Mobile and agent clients need proper token auth, rate limiting, CORS, and API versioning. Laravel provides all of this out of the box via Sanctum, middleware, and route grouping. Craft 4/5 does not.

3. **The business logic is portable.** The existing plugin controllers are thin wrappers around Craft element queries. The core logic (timer start/stop, completion detection, Stripe charge/refund) can be extracted and rewritten in Laravel with equivalent Eloquent models.

4. **The payment model needs Laravel's queue system.** The new upfront-charge model requires reliable async processing: charge on commit, automatic refund on completion, deadline expiry checks via scheduler, and Stripe Connect integration for escrow-style fund holding. Laravel's queue workers, Horizon dashboard, and `schedule:run` are purpose-built for this.

5. **PHP team continuity.** The team already knows PHP. A Laravel migration is far less risky than a full-stack JS rewrite.

6. **Cost-effective hosting.** Laravel Forge + a $6-12/mo VPS gives us production-grade hosting for under $25/mo, with a clear scaling path.

7. **Admin panel via Filament.** Laravel Filament (open source) provides an admin panel comparable to Craft's, without the CMS overhead.

**Estimated migration effort:** 4-6 weeks for core backend (models, auth, API endpoints, Stripe Connect payment model). Frontend Vue components can be preserved and pointed at the new API.

---

## 4. Mobile App Strategy

### Options Evaluated

| Framework | Language | Vue Reuse | Native Feel | Push Notifications | Stripe | Maturity |
|-----------|----------|-----------|-------------|-------------------|--------|----------|
| **Capacitor + Ionic Vue** | Vue 3 / TS | Full | Good (WebView) | Firebase FCM | @capacitor-community/stripe | High |
| **React Native** | React / TS | None | Excellent | Excellent | stripe-react-native (official) | Very High |
| **Flutter** | Dart | None | Excellent | firebase_messaging | flutter_stripe | Very High |
| **NativeScript Vue** | Vue 3 / TS | Partial | Good (native) | Supported | Manual integration | Low |
| **PWA** | Vue 3 / TS | Full | Limited | iOS 16.4+ (limited) | Web Stripe.js | Medium |

### Detailed Evaluation

#### Capacitor + Ionic Vue (Recommended)

- **Vue reuse:** Near-100% code sharing with the web app. Vue components, Pinia stores, Axios API calls, and business logic all work unchanged.
- **Push notifications:** Firebase Cloud Messaging via `@capacitor/push-notifications`. Works on iOS and Android.
- **Stripe:** `@capacitor-community/stripe` provides native payment sheet integration. Stripe.js fallback for web.
- **Timer:** Background execution via `@capacitor/background-runner` or `capacitor-background-fetch`. Not as robust as native, but sufficient for timer notifications.
- **App size:** 3-5 MB typical. Smallest of all cross-platform options.
- **Learning curve:** Near-zero if the team knows Vue. One week to be productive.
- **Limitation:** WebView-based, so complex animations or heavy GPU work would suffer. Not relevant for this app.

#### React Native

- **Would require rewriting the entire frontend from Vue to React.** This is a non-starter given the existing Vue 3 codebase.
- Excellent native feel and massive ecosystem, but the rewrite cost is prohibitive.

#### Flutter

- **Requires learning Dart.** No code sharing with the Vue web app.
- Excellent rendering engine, but overkill for a task/timer/payment app.
- Adds a second language and build system to maintain.

#### NativeScript Vue

- Supports Vue 3, but the ecosystem is niche and under-maintained.
- Far fewer community packages than Capacitor/Ionic.
- Risk of abandonment. Not recommended for a production app.

#### PWA (Progressive Web App)

- **Free and immediate.** No app store submission. Works from the browser.
- Push notifications work on iOS 16.4+ but only when added to home screen.
- No access to native payment sheet (Stripe.js works but less polished).
- No background timer execution.
- **Good as a stepping stone**, not as the final mobile solution.

### Core Mobile Features Matrix

| Feature | Capacitor+Ionic | PWA | Native Required? |
|---------|----------------|-----|-----------------|
| Push notifications for deadlines | Firebase FCM | iOS 16.4+ (limited) | Recommended |
| Timer with background tracking | Background runner plugin | Not supported | Yes |
| Quick task completion | Swipe/tap gestures | Tap only | No |
| Upfront commitment payment | Native payment sheet | Stripe.js (web) | Recommended |
| Refund notification on completion | Push notification | In-app only | No |
| Offline task viewing | Capacitor storage | Service worker cache | No |
| Biometric auth | @capacitor/biometrics | Not supported | Recommended |
| Home screen widget | Community plugin (limited) | Not supported | Nice-to-have |

### Recommendation: Capacitor + Ionic Vue, with PWA as Phase 1

**Phase 1 (Weeks 1-2): PWA**
- Add a service worker and web manifest to the existing Vue app.
- Enable "add to home screen" prompts.
- Implement basic push notifications via the Push API.
- This gives mobile users an immediate improved experience while the native app is built.

**Phase 2 (Weeks 3-6): Capacitor + Ionic Vue**
- Wrap the Vue app in a Capacitor shell.
- Add native plugins: push notifications (FCM), Stripe payment sheet, biometric auth, background timer.
- Submit to App Store and Google Play.
- Progressively add native features (haptic feedback, share extension, widgets).

**Rationale:**
- Maximum code reuse with the existing Vue 3 + Pinia codebase.
- Single team can maintain web and mobile simultaneously.
- Capacitor's architecture allows incremental adoption of native features.
- The app's UI requirements (lists, forms, timers, charts) are well-suited to WebView rendering.
- Cost of hiring React Native or Flutter developers avoided entirely.

---

## 5. API Architecture

### Current State

The existing Craft CMS plugins expose these effective endpoints:

```
POST /actions/tasks/tasks/get              -> JSON list of tasks
POST /actions/tasks/tasks/reorder          -> Reorder tasks
POST /actions/tasks/tasks/check-edit-task  -> Check derail on edit
POST /actions/timer/timer/start            -> Start timer
POST /actions/timer/timer/stop             -> Stop timer
POST /actions/timesheets/timesheets/get    -> Paginated timesheets
POST /actions/analytics/charts/save-chart  -> Save chart config
POST /actions/analytics/charts/create-chart -> Create chart
POST /actions/analytics/charts/delete-chart -> Delete chart
POST /actions/analytics/charts-data/index  -> Chart data query
POST /actions/stripe/stripe/create-checkout-session -> Stripe checkout
POST /actions/stripe/stripe/retrieve-portal-session -> Stripe portal
POST /actions/stripe/stripe/refund         -> Refund a charge
POST /actions/stripe/webhooks/index        -> Stripe webhooks (anonymous)
GET  /actions/user/users/check-session     -> Session check (anonymous)
POST /actions/user/users/set-hide-inactive-tasks -> Toggle preference
POST /actions/user/users/change-timezone   -> Change timezone
POST /actions/user/breaks/get              -> Paginated breaks
POST /actions/user/breaks/set-unlimited-break -> Toggle unlimited break
```

**Problems:**
- All use POST (even reads), violating REST conventions.
- Session-based auth only. No token support.
- Craft action routing (`/actions/plugin/controller/action`) is non-standard.
- No versioning. No CORS. No rate limiting. No pagination standards.
- Read operations don't use GET, so they can't be cached.

### Proposed API Design (Laravel)

#### URL Structure

```
/api/v1/tasks                    GET     List tasks
/api/v1/tasks/{id}               GET     Get single task
/api/v1/tasks                    POST    Create task
/api/v1/tasks/{id}               PUT     Update task
/api/v1/tasks/{id}               DELETE  Archive/delete task
/api/v1/tasks/reorder            POST    Reorder tasks
/api/v1/tasks/{id}/check-derail  POST    Check if edit would derail

/api/v1/timer/{taskId}/start     POST    Start timer
/api/v1/timer/{taskId}/stop      POST    Stop timer

/api/v1/timesheets/{taskId}      GET     Paginated timesheets

/api/v1/charts                   GET     List charts
/api/v1/charts                   POST    Create chart
/api/v1/charts/{id}              PUT     Update chart
/api/v1/charts/{id}              DELETE  Delete chart
/api/v1/charts/{id}/data         GET     Query chart data

/api/v1/billing/setup            POST    Create Stripe setup session (save payment method)
/api/v1/billing/portal           POST    Get Stripe portal URL
/api/v1/billing/wallet           GET     Get wallet balance (held, available, total spent)

/api/v1/commitments/{id}/charge  POST    Charge upfront on commitment activation
/api/v1/commitments/{id}/refund  POST    Refund on task completion (usually automatic)
/api/v1/commitments/{id}/status  GET     Payment status for a commitment (held/refunded/forfeited)

/api/v1/user/profile             GET     Get user profile
/api/v1/user/preferences         PUT     Update preferences
/api/v1/user/timezone            PUT     Change timezone

/api/v1/breaks                   GET     List breaks
/api/v1/breaks                   POST    Create break
/api/v1/breaks/unlimited         PUT     Toggle unlimited break

/api/v1/webhooks/stripe          POST    Stripe webhook (public)

/api/v1/agent/commitments        POST    Agent: create commitment (charges upfront with pre-auth)
/api/v1/agent/commitments/{id}   GET     Agent: get commitment status (incl. payment state)
/api/v1/agent/commitments/{id}   PUT     Agent: modify commitment
/api/v1/agent/commitments/{id}/complete  POST  Agent: mark complete (triggers refund)
/api/v1/agent/events             POST    Agent: webhook registration
```

#### REST vs GraphQL

| Consideration | REST | GraphQL |
|--------------|------|---------|
| Mobile app needs | Simple CRUD, well-defined screens | Over-fetching not a problem at our scale |
| Agent integration | REST is universal, every agent SDK supports it | GraphQL requires client library |
| Caching | HTTP caching, CDN-friendly for GETs | Harder to cache |
| Team familiarity | High | Low |
| Craft CMS had | Built-in GraphQL, but we'd lose it in migration | - |
| Complexity | Lower | Higher |

**Decision: REST.** The app's data model is simple (tasks, timers, timesheets, charts). GraphQL's flexibility is not needed, and REST's universality makes agent integration frictionless. If future needs require flexible querying (e.g., a reporting dashboard with arbitrary field selection), we can add a GraphQL endpoint for that specific use case via Laravel Lighthouse.

#### Authentication Strategy

| Client | Method | Implementation |
|--------|--------|---------------|
| Web browser (SPA) | Session/cookie | Laravel Sanctum SPA authentication. CSRF-protected, httpOnly cookies. |
| Mobile app | Bearer token | Laravel Sanctum API tokens. Stored in device secure storage (iOS Keychain, Android Keystore). |
| AI agent | API key | Laravel Sanctum tokens with scoped abilities (`agent:read`, `agent:write`, `agent:billing`). |
| Webhooks (Stripe) | Signature verification | Stripe webhook signature, no auth token needed. |

Laravel Sanctum supports both cookie-based SPA auth and token-based mobile/API auth from a single package, making it the ideal choice.

#### Versioning Strategy

- URL-based versioning: `/api/v1/`, `/api/v2/`.
- V1 is the initial release. V2 only when breaking changes are needed.
- Deprecation notices in response headers (`Sunset` header, RFC 8594).
- Minimum 6-month deprecation window before removing a version.
- Route groups in Laravel: `Route::prefix('api/v1')->group(...)`.

#### Rate Limiting

| Client Type | Limit | Window |
|-------------|-------|--------|
| Authenticated web user | 120 requests | per minute |
| Mobile app (per token) | 120 requests | per minute |
| Agent API key | 60 requests | per minute |
| Agent API key (burst) | 10 requests | per second |
| Public (unauthenticated) | 30 requests | per minute |
| Stripe webhooks | Exempt | - |

Implemented via Laravel's built-in `ThrottleRequests` middleware with named rate limiters per client type.

---

## 6. Human-Centric UI Platform Requirements

### Full Web Dashboard

The web app remains the primary interface for power users. Key screens:

- **Dashboard:** Active tasks with timers, daily progress, commitment amounts held, deadline warnings.
- **Task management:** Create, edit, reorder, archive tasks. Set commitment amounts, deadlines, schedules. Creating/activating a task triggers upfront payment.
- **Wallet view:** Current balance held in commitments, total invested, total earned back (refunded), total forfeited.
- **Analytics:** Customizable charts (completions, time spent, money invested vs. earned back). Date range filtering.
- **Account:** Stripe payment method, billing history, transaction log (charges + refunds).
- **Breaks:** Schedule and manage breaks from commitments.
- **Settings:** Timezone, notification preferences, display preferences.

### Mobile-Optimized Responsive

The existing Bootstrap 5 grid provides breakpoints, but the mobile experience needs purpose-built patterns:

- **Bottom navigation bar** on mobile (replacing sidebar/top nav).
- **Swipe gestures** for quick task completion and timer start/stop.
- **Pull-to-refresh** for task list.
- **Floating action button** for starting a new task.
- **Collapsible sections** for analytics on small screens.

### Adult (Vorpal) vs Children (Sidekick) Variant Differences

| Aspect | Adult (Vorpal) | Children (Sidekick) |
|--------|--------------|-----------------|
| **Tone** | Professional, data-driven | Encouraging, simple |
| **Task complexity** | Multiple fields (deadline, commitment $, schedule) | Simplified: task name, deadline, reward/consequence |
| **Financial** | Real money charged upfront via Stripe; refunded on completion | Parent-funded wallet; virtual currency deducted/returned |
| **Analytics** | Full charts, date ranges, money invested vs. earned back | Simple progress bars, streak counters, badges |
| **Timer** | Precise time tracking, timesheets | Visual countdown, "time left today" |
| **Completion reward** | Money refunded to account ("You earned $5 back!") | Points/stars returned, level-up, badge unlocked |
| **Failure consequence** | Money forfeited (70% platform / 30% charity) | Lose points, notify parent |
| **Parent controls** | N/A | Parent pre-funds wallet, views activity, adjusts tasks |
| **Gamification** | Minimal (optional) | Central: levels, badges, streaks, rewards |

### Push Notification Strategy

| Notification Type | Trigger | Priority | Channel |
|------------------|---------|----------|---------|
| Commitment charged | Upfront payment processed on task activation | High | Push + email |
| Deadline approaching | 30 min, 10 min, 5 min before deadline | High | Push + in-app |
| Task completed + refund | Task completed, refund issued ("You earned $5 back!") | High | Push + email |
| Task failed + forfeit | Deadline passed, money forfeited | Critical | Push + email |
| Timer reminder | Timer running > 2 hours without stop | Medium | Push |
| Daily summary | End of day: tasks completed, money earned back | Low | Push (opt-in) |
| Streak milestone | 7, 30, 100 day streaks | Low | Push + in-app |
| Break starting/ending | Day before break starts/ends | Medium | Push |
| Weekly financial summary | Sunday: total invested, earned back, forfeited | Low | Email (opt-in) |

Implementation: Firebase Cloud Messaging (FCM) for push delivery. Laravel Notifications system for routing (push, email, database). User preferences control which notifications are active.

---

## 7. Agent-First Platform Requirements

### Minimal Signup Flow (Moltbook-Inspired)

Moltbook's key insight: the agent doesn't see a signup form. It reads a skill file (`moltbook.com/skill.md`) that contains instructions for how to interact with the platform. Applied to MAST:

**Agent onboarding flow:**

1. **Skill file** at `app.mast.com/agent/skill.md` describes available API endpoints, authentication, and expected behavior.
2. **Agent calls** `POST /api/v1/agent/register` with:
   - User's email address
   - User's consent token (obtained from a minimal web consent page)
   - Agent's name/identifier
3. **System returns** an API key scoped with `agent:*` abilities.
4. The user receives an email: "An AI agent has been registered to manage your commitments. Click here to review and approve."
5. User clicks through to a simple approval page, **adds a payment method** (required for the agent to create charged commitments).

**Human-side minimal signup:**

1. User visits a link (shared by agent, or found directly).
2. Email + password (or magic link).
3. **Add payment method via Stripe Checkout** (required -- the upfront-charge model means a payment method must exist before commitments can be created).
4. Consent: "Allow AI agents to create and manage commitments on your behalf. The agent can charge your payment method when creating commitments."
5. Set a **per-commitment spending limit** (e.g., max $10 per commitment, max $50/week). This caps what the agent can charge without additional approval.
6. Done. User gets a read-only dashboard URL.

Total fields: email, password, payment method, consent checkbox, spending limit. The spending limit is critical for agent-managed accounts -- it prevents an agent from committing unbounded amounts.

### API-First Design for Agent Interaction

Agents interact exclusively via the REST API. Key design principles:

- **Stateless.** Every request contains all needed context (Bearer token in header).
- **Idempotent.** PUT and DELETE operations can be safely retried.
- **Descriptive errors.** JSON error responses with machine-readable codes, not just HTTP status codes.
- **Pagination.** Cursor-based pagination for list endpoints (more reliable than offset for agents).
- **Webhook support.** Agents can register webhook URLs to receive event notifications.

```json
// Example: Agent creates a commitment (triggers upfront charge)
POST /api/v1/agent/commitments
Authorization: Bearer agent_sk_xxx

{
  "title": "Write 500 words daily",
  "schedule": ["mon", "tue", "wed", "thu", "fri"],
  "deadline_time": "23:00",
  "commitment_amount_cents": 500,
  "time_based": true,
  "length_minutes": 30,
  "payment_method": "stripe"
}

// Response -- note the payment is already charged
{
  "id": "commit_abc123",
  "status": "active",
  "payment": {
    "status": "charged",
    "amount_cents": 500,
    "charged_at": "2026-02-20T10:00:00Z",
    "refund_on_complete": true
  },
  "created_at": "2026-02-20T10:00:00Z",
  "dashboard_url": "https://app.mast.com/c/commit_abc123"
}

// Example: Agent marks commitment as completed (triggers automatic refund)
POST /api/v1/agent/commitments/commit_abc123/complete
Authorization: Bearer agent_sk_xxx

// Response
{
  "id": "commit_abc123",
  "status": "completed",
  "payment": {
    "status": "refunded",
    "amount_cents": 500,
    "refunded_at": "2026-02-20T22:45:00Z"
  }
}
```

**Agent spending controls:**
- The agent can only charge up to the user's per-commitment limit.
- The agent can only charge up to the user's weekly spending limit.
- If a commitment would exceed either limit, the API returns a `402 Payment Required` error with details, and the agent must request the user to increase their limit.

### Webhook System for Agent Events

Agents register a webhook URL to receive real-time events:

```
POST /api/v1/agent/webhooks
{
  "url": "https://agent.example.com/mast-events",
  "events": ["commitment.created", "commitment.charged", "commitment.completed", "commitment.refunded", "commitment.forfeited", "timer.stopped"]
}
```

Events are signed (HMAC-SHA256) and include retry logic (3 attempts with exponential backoff).

### Read-Only Dashboard for User Monitoring

The user-facing dashboard for agent-managed accounts is deliberately simple:

- **Status overview:** List of active commitments with current status (on track / at risk / deadline passed).
- **Financial overview:** Total money currently held in active commitments, total earned back (completed), total forfeited (failed), net position.
- **Activity log:** Chronological feed of agent actions ("Agent created commitment 'Write 500 words daily' -- $5.00 charged", "Commitment completed -- $5.00 refunded").
- **Spending controls:** Adjust per-commitment limit, weekly limit, pause agent access.
- **Override controls:** Pause commitment, modify deadline, request early refund (cancellation), revoke agent access.
- **No editing of commitments.** The agent manages them. The user observes and intervenes only when needed.

---

## 8. Infrastructure Architecture

### Architecture Diagram

```
                                  +------------------+
                                  |   Cloudflare     |
                                  |   CDN + WAF      |
                                  +--------+---------+
                                           |
                              +------------+------------+
                              |                         |
                    +---------v---------+    +----------v----------+
                    |   Web Frontend    |    |    API Backend       |
                    |   (Vue 3 SPA)     |    |    (Laravel)         |
                    |   Static hosting  |    |                      |
                    |   Cloudflare      |    |  /api/v1/*           |
                    |   Pages / S3      |    |  Sanctum auth        |
                    +-------------------+    |  Rate limiting       |
                                             |  Queue workers       |
                              +--------------+  Scheduler           |
                              |              |  Payment processor   |
                              |              +----------+-----------+
                              |                         |
                    +---------v---------+    +----------v----------+
                    |   Mobile App      |    |    MySQL 8           |
                    |   Capacitor       |    |    Primary + replica |
                    |   (iOS + Android) |    +---------------------+
                    +-------------------+               |
                                             +----------v----------+
                    +-----------+            |    Redis             |
                    |  Stripe   |            |    Sessions, cache,  |
                    |  Connect  |            |    queues, payment   |
                    |  (fiat)   |            |    job processing    |
                    +-----------+            +---------------------+
                                                        |
                    +-----------+            +----------v----------+
                    |  Coinbase |            |    S3 / DO Spaces    |
                    |  Onramp   |            |    File storage      |
                    |  (card →  |            +---------------------+
                    |  USDC on  |                       |
                    |  Base)    |            +----------v----------+
                    +-----------+            |  Charity API         |
                                             |  (forfeit routing)   |
                    +-----------+            +---------------------+
                    |  Firebase  |
                    |  FCM       |
                    +-----------+

                    +-----------+
                    |  Base L2  |
                    |  Smart    |
                    |  Contract |
                    |  Escrow   |
                    +-----------+
```

### Payment Processing Flow (New)

The upfront-charge model adds critical queue-based processing requirements:

```
User creates commitment
        |
        v
  [Charge Job] -> Stripe Connect: charge user, hold funds
        |
        v
  [Scheduler] -> Checks deadlines every minute
        |
        +-- Deadline passed + task complete?
        |       |
        |       v
        |   [Refund Job] -> Stripe Connect: transfer funds back to user
        |       |
        |       v
        |   Push notification: "You earned $5 back!"
        |
        +-- Deadline passed + task NOT complete?
                |
                v
            [Forfeit Job] -> Split funds: 70% platform, 30% charity
                |
                v
            Push notification: "Commitment forfeited. $3.50 retained, $1.50 donated."
```

This requires **reliable queue processing** (Redis + Laravel Horizon) and a **scheduler running every minute** (`schedule:run` via cron). Payment jobs must be retried on failure with exponential backoff, and dead-letter handling for permanently failed payments.

### Shared Backend Serving All Clients

A single Laravel backend serves three client types through the same API:

| Client | Auth Method | Rate Limit | Features |
|--------|-------------|------------|----------|
| Web SPA | Sanctum session/cookie | 120/min | Full dashboard |
| Mobile app | Sanctum Bearer token | 120/min | Full dashboard + push |
| Agent | Sanctum Bearer token (scoped) | 60/min | CRUD + webhooks |

### CI/CD Pipeline

```
Developer pushes to Git
        |
        v
  GitHub Actions / GitLab CI
        |
        +-- PHP: phpstan, phpcs, phpunit
        +-- JS: eslint, vitest, build check
        |
        v
  [Branch: devel] -> Deploy to -> Staging
        |
        v
  [Branch: staging] -> Manual approval -> Production
        |
        v
  [Branch: main] -> Tagged release -> Production deploy
```

**Pipeline steps:**

1. **Lint & static analysis:** PHPStan level 6, ESLint, Stylelint.
2. **Unit tests:** PHPUnit for backend, Vitest for frontend.
3. **Build:** `npm run prod` for frontend assets.
4. **Deploy to staging:** Automatic on merge to `staging` branch (existing workflow).
5. **Deploy to production:** Manual trigger or merge to `main`. Zero-downtime via Laravel Forge rolling deploys.
6. **Post-deploy:** Run migrations, clear caches, warm routes.

### Staging / Production Environments

| Aspect | Staging | Production |
|--------|---------|------------|
| Server | 1x $12/mo Droplet (1 vCPU, 2GB) | 1x $24/mo Droplet (2 vCPU, 4GB) |
| Database | Shared MySQL on same server | Managed MySQL (DO Managed DB, $15/mo) |
| Redis | Shared on same server | Managed Redis (DO Managed Redis, $15/mo) |
| Domain | staging.mast.com | app.mast.com |
| SSL | Let's Encrypt (auto) | Let's Encrypt (auto) |
| Stripe | Test mode | Live mode |
| Email | Mailtrap / log driver | Postmark ($10/mo for 10K emails) |
| Monitoring | Basic (Laravel Telescope) | Full (see below) |

### Monitoring & Alerting

| Tool | Purpose | Cost |
|------|---------|------|
| Sentry | Error tracking (already in use) | Free tier (5K events/mo) |
| Laravel Telescope | Debug dashboard (staging only) | Free (built-in) |
| DigitalOcean Monitoring | Server metrics (CPU, RAM, disk) | Free with Droplet |
| Uptime Robot | Uptime monitoring + alerts | Free (50 monitors) |
| Laravel Pulse | Application performance dashboard | Free (built-in) |
| PaperTrail / Logtail | Centralized logging | Free tier (50 MB/mo) |

**Alert routing:**

| Severity | Channel | Example |
|----------|---------|---------|
| Critical | SMS + Slack | Server down, payment charge failure, refund processing failure |
| High | Slack + email | Error rate spike, queue backup, Stripe webhook failures |
| Medium | Slack | Slow queries, high memory |
| Low | Dashboard only | Deprecation warnings, minor errors |

### Cost Estimates

#### Monthly Hosting Costs (Production)

| Item | Provider | Monthly Cost |
|------|----------|-------------|
| App server (2 vCPU, 4GB) | DigitalOcean Droplet | $24 |
| Server management | Laravel Forge (Growth) | $19 |
| Managed MySQL | DigitalOcean | $15 |
| Managed Redis | DigitalOcean | $15 |
| CDN + WAF | Cloudflare (Free/Pro) | $0-20 |
| Transactional email | Postmark | $10 |
| Error tracking | Sentry (free tier) | $0 |
| Uptime monitoring | Uptime Robot (free) | $0 |
| File storage (10GB) | DO Spaces | $5 |
| **Total (production)** | | **$88-108/mo** |

#### Monthly Hosting Costs (Staging)

| Item | Provider | Monthly Cost |
|------|----------|-------------|
| App server (1 vCPU, 2GB) | DigitalOcean Droplet | $12 |
| (Included in Forge plan) | Laravel Forge | $0 |
| MySQL + Redis on same server | Self-hosted | $0 |
| **Total (staging)** | | **$12/mo** |

#### Mobile App Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Google Play Developer | $25 | One-time |
| Firebase (FCM push) | $0 | Free tier |
| **Total Year 1** | | **$124** |

#### Payment Processing Costs (Variable)

| Scenario | Fee | Platform Absorbs | Notes |
|----------|-----|-----------------|-------|
| $5 commitment, completed (Stripe Connect) | $0.45 | $0.45 | Transfer back to user avoids refund fee |
| $5 commitment, forfeited (Stripe) | $0.45 | $0.00 | Platform keeps $3.50, charity gets $1.50; fee covered by revenue |
| $25 batch commitment, weekly (Stripe) | $1.03 | $1.03 | Batching reduces per-task fee impact |
| $5 commitment, completed (Coinbase Onramp + Base) | **~$0.01** | **$0.01** | Card → USDC → escrow → card. Near-zero round-trip |
| $5 commitment, forfeited (Coinbase + Base) | ~$0.01 | $0.00 | Platform keeps ~100% of forfeited amount |

**Stripe Connect** has no additional monthly fee beyond standard processing (2.9% + $0.30 per transaction). At a 70% completion rate with average $10 commitments, expect ~$0.59 in fees per commitment round-trip.

**Coinbase Onramp + Base** has zero fees on USDC purchases/sales and negligible gas (~$0.01). At the same volume, fees are 50-100x lower. The Phase 1b integration of Coinbase Onramp would dramatically reduce per-transaction costs while offering users the same card-based UX.

#### Grand Total: ~$110-130/month + $124/year for mobile + variable Stripe processing

### Scalability Path

**Phase 1: Single Server (0-1,000 users)**
- One Droplet runs everything: Laravel, queue workers, scheduler.
- MySQL and Redis on managed services for reliability.
- Sufficient for the first year of operation.

**Phase 2: Separate Workers (1,000-10,000 users)**
- Add a second Droplet for queue workers and scheduled tasks (~$12/mo).
- Add a read replica for MySQL (~$15/mo).
- Enable Cloudflare Pro for caching and WAF ($20/mo).
- Total: ~$155-175/mo.

**Phase 3: Horizontal Scaling (10,000+ users)**
- Move to DigitalOcean Kubernetes or Laravel Vapor (serverless).
- Auto-scaling app containers.
- Managed database cluster.
- CDN for all static assets.
- Total: ~$300-500/mo depending on traffic.

**Phase 4: Enterprise (50,000+ users)**
- Multi-region deployment.
- Database sharding or move to PlanetScale.
- Dedicated queue infrastructure (SQS or Horizon cluster).
- Consider Laravel Vapor for automatic scaling.
- Total: $500-2,000/mo depending on usage.

---

## Summary of Recommendations

| Decision | Recommendation | Confidence |
|----------|---------------|------------|
| Backend framework | **Laravel** (migrate from Craft CMS) | High |
| Hosting provider | **DigitalOcean + Laravel Forge** | High |
| Payment model | **Charge upfront, refund on completion** | High |
| Payment processor (Phase 1) | **Stripe Connect** with delayed payouts (escrow-style) | High |
| Payment processor (Phase 1b) | **Coinbase Onramp + Base L2** — card → USDC → smart contract escrow. Zero-fee, same card UX | High |
| Payment processor (Phase 2) | **Direct wallet connection** for crypto-native users (MetaMask, Phantom) | Medium |
| Forfeit distribution | **70/30 split** (platform revenue / charity donation) | Medium |
| Mobile framework | **Capacitor + Ionic Vue** | High |
| Mobile Phase 1 | **PWA** as stepping stone | High |
| API style | **REST** with versioning | High |
| Authentication | **Laravel Sanctum** (session + token) | High |
| Database | **MySQL 8** (keep current, add managed hosting) | High |
| Push notifications | **Firebase Cloud Messaging** | High |
| Frontend | **Keep Vue 3 + Pinia**, migrate off Webpack to Vite | High |
| Admin panel | **Laravel Filament** (replaces Craft CP) | Medium |
| CI/CD | **GitHub Actions** (or GitLab CI, matching current GitLab setup) | Medium |

### Migration Priority Order

1. **Set up Laravel project** with Sanctum, MySQL, Redis, Forge deployment.
2. **Migrate data models** (users, tasks, daily tasks, timesheets, breaks, charts, wallet/balance).
3. **Implement Stripe Connect integration** -- the new upfront-charge model with escrow-style fund holding, charge-on-commit, and refund-on-complete. This is the most critical and complex piece.
4. **Implement API v1** endpoints matching the proposed design above, including payment/wallet endpoints.
5. **Point Vue SPA at new API.** Extract Vue components from Twig templates into standalone SPA. Add wallet view.
6. **PWA features:** Service worker, web manifest, push notifications.
7. **Capacitor shell:** Wrap SPA, add native plugins, submit to app stores.
8. **Agent API:** Extend v1 endpoints with agent-specific routes, spending limits, and webhook system.
9. **Admin panel:** Build Filament admin for content/user management, payment monitoring.
10. **Crypto payment path (Phase 2):** USDC escrow smart contract on Solana as alternative payment method.
11. **Decommission Craft CMS.**
