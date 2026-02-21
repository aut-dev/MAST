# MAST Design & UX Specification

## Document Purpose

This document provides a comprehensive UX audit of the current MAST commitment mechanism app, maps user stories to existing screens, and provides design recommendations for three product variants: Adult variant (codename: Vorpal), MAST Kids, and agent variant (codename: Agent). It also proposes information architecture changes, priority screen redesigns, and a shared design system.

**IMPORTANT: Payment Model Change.** This spec accounts for a fundamental shift in the business model. The OLD model charged users only when they failed (derailed). The NEW model charges users UPFRONT when they commit -- they invest in their future self, and receive a full refund when they complete the task. This "invest-then-earn-back" model makes loss aversion immediate rather than hypothetical, and fundamentally changes the UX of commitment creation, task completion, and financial feedback throughout the app. See [Section 3.4](#34-payment-model-ux-implications) for full analysis.

---

## Table of Contents

1. [Current Design Audit](#1-current-design-audit)
2. [User Story Mapping](#2-user-story-mapping)
3. [Design Recommendations per Variant](#3-design-recommendations-per-variant)
   - 3.4 [Payment Model UX Implications](#34-payment-model-ux-implications)
4. [Information Architecture](#4-information-architecture)
5. [Priority Screen Redesigns](#5-priority-screen-redesigns)
6. [Design System](#6-design-system)

---

## 1. Current Design Audit

### 1.1 Technology & Design Stack Overview

| Aspect | Current State |
|--------|--------------|
| CSS Framework | Bootstrap 5 with 6 breakpoints (xs through xxl) |
| Primary Color | `#3600a3` (deep purple) |
| Secondary Purple | `#7749f8` (lighter purple, used for progress bars and links) |
| Typography | Ubuntu (Google Fonts), system fallback stack |
| Icons | Font Awesome 6 Free (solid weight) |
| JS Framework | Vue 3 + Pinia stores, jQuery (legacy) |
| Rendering | Twig server-rendered templates + Vue SPA hybrid |
| Date Handling | Flatpickr, moment.js |
| Charts | Chart.js via vue-chartjs (Line, Bar, Pie, PolarArea) |
| Drag & Drop | vuedraggable |

### 1.2 Screen-by-Screen Audit

#### 1.2.1 Signup (`/sign-up`)

**Current Implementation:**
- Standard form inside `container-small`: first name, last name, username/email, password, timezone select, register button
- Links to login at bottom
- Timezone is a raw select with all PHP timezone options (hundreds of entries)
- No social login active (code commented out in login form)

**Friction Points:**
- **HIGH: Timezone selector is overwhelming** -- users face a raw list of hundreds of timezone strings (e.g., "America/New_York - (UTC-05:00) Eastern Time"). No auto-detection, no search, no grouping. This is the single most hostile field in the signup flow.
- **MEDIUM: No progressive disclosure** -- all fields shown at once. No indication of how many steps or why information is needed.
- **MEDIUM: No value proposition visible** -- the signup form is naked. New users see a generic form with no reminder of what MAST does or why they should commit.
- **LOW: No password requirements shown** -- users do not know password rules until they fail validation.
- **LOW: First name + last name feels formal** -- commitment apps benefit from casual, motivating tone.

**Missing Feedback:**
- No inline validation (relies on server-side form resubmission)
- No success animation or welcome flow after registration
- No onboarding sequence

#### 1.2.2 Login (`/login`)

**Current Implementation:**
- Username/email field, password field, "forgot password" link, remember me checkbox, login button
- Social login providers are commented out
- Links to signup at bottom

**Friction Points:**
- **LOW: Standard and functional** -- login is the least problematic screen
- **MEDIUM: No feedback on failed login** -- error handling relies on Craft's flash messages, which are easy to miss
- **LOW: "Remember me" checkbox is centered below password, easy to miss**

**Missing Feedback:**
- No loading state on the login button
- No rate limiting feedback (brute-force protection is server-side only)

#### 1.2.3 Task Dashboard (`/tasks`)

**Current Implementation:**
- Fixed header bar with "Tasks" label and icon controls (pause all, hide inactive, show archived, create new)
- Grid of task cards (4 columns on XL, 3 on LG, 2 on MD, 1 on mobile)
- Cards show: title, type description ("More than X min" or "One off"), progress bar, countdown, Start/Stop or Done button, dollar amount at stake
- Cards are draggable for reordering (vuedraggable)
- 10-second auto-refresh polling
- Break warnings shown as alert-warning banners above cards

**Friction Points:**
- **HIGH: Header controls are icon-only with no labels** -- the pause icon, eye-slash icon, trash icon, and plus icon in the header bar rely entirely on title attributes for explanation. New users have no idea what these do. The trash icon for "show archived" is particularly confusing since trash typically means "delete."
- **HIGH: No empty state guidance** -- when a user has zero tasks, they see "You have no tasks yet" with no call-to-action button, no explanation of what to do next.
- **MEDIUM: Card information density is low for the space used** -- each card takes up significant space but primarily shows title, a one-line description, and a progress bar. Key information like schedule, streak, or upcoming deadline is not visible.
- **MEDIUM: "More than X min" / "One off" is unclear jargon** -- new users do not know what "More than 10 min" means in context.
- **MEDIUM: Dollar amount is shown only when the task is active for the day** -- meaning users often cannot see the stakes of their commitments at a glance.
- **LOW: Auto-refresh every 10 seconds can cause layout jumps** -- if a task changes state during drag or interaction, the UI can become inconsistent.
- **LOW: No visual distinction between task types** -- time-based and checkbox tasks look nearly identical until you notice Start/Stop vs Done.

**Missing Feedback:**
- No toast/snackbar confirmation when pausing/unpausing a task
- No haptic or visual feedback on drag-drop reorder completion
- No indication that changes were saved after reordering

#### 1.2.4 Task Card Design -- Status Communication Assessment

**Current Status System:**
| Status | Border Color | Trigger |
|--------|-------------|---------|
| Active | Blue (`#007bff`) | Task is active for today, not complete, not derailed |
| Inactive | Gray (`#adb5bd`) | Not active for today |
| Derailed | Red (`#c42400`) | Deadline passed without completion |
| Complete | Green (`#38a688`) | Task completed for today |
| Paused | Orange (`#f7913e`) | Manually paused or on break |

**Assessment:**
- **WORKS WELL:** The 3px colored border is visible and distinct. The five statuses cover all meaningful states.
- **PROBLEM:** Border color is the *only* status indicator besides a small green check icon for "complete." Users with color vision deficiency may struggle. There is no text label, no icon per status, and no background tint.
- **PROBLEM:** Timer-started state uses a dashed border, which is subtle and easy to miss when scanning multiple cards.
- **PROBLEM:** Archived tasks get 50% opacity but share the same layout, which can confuse users about whether they can interact.
- **PROBLEM:** Custom background colors (`backgroundColor` field) can clash with or obscure the status border, reducing the effectiveness of the status system.
- **RECOMMENDATION:** Add a small status badge/pill (e.g., "ACTIVE", "DERAILED", "DONE") inside each card, plus an icon. Use background tinting for derailed state (light red wash) to create urgency.

#### 1.2.5 Task Creation Form (`/tasks/new`)

**Current Implementation:**
- 254-line Twig template with 230+ lines of JavaScript
- Fields: Name, Start date (flatpickr), Deadline (time picker), $ committed per derail, More/Less radio, Time-based toggle, Work block length (minutes), Recurring toggle, Repeat schedule (weeks), Weekly day grid (number inputs or checkboxes depending on time-based), Background color picker, Pause toggle (edit only)
- Conditional field visibility: toggling "time based" shows/hides length and different week grids; toggling "recurring" shows/hides repeat/week sections
- A "derail check" AJAX call on edit submission warns if changes would cause a derail

**Assessment -- CRITICAL FRICTION:**
- **VERY HIGH: Form is overwhelming for new users** -- this is MAST's most serious UX problem. A brand-new user creating their first task faces 10+ fields, including a recurring schedule week grid with 7 day columns, with no guidance, no progressive disclosure, and no defaults explanation.
- **HIGH: The week grid is confusing** -- for time-based tasks, users must enter decimal numbers (0, 0.5, 1, 1.5...) per day per week. For checkbox tasks, they check/uncheck days. The "How many work blocks do you want to do each day?" question requires understanding the "work block" concept that has not been explained.
- **HIGH: "More or less of something" is opaque** -- the label "More or less of something" with radio buttons "More" / "Less" does not explain the behavioral model. What does "Less" mean? Less time doing something bad? The consequences of this choice are not explained.
- **HIGH: No smart defaults or templates** -- there are no presets like "Daily 30-min habit" or "Weekday-only task" that would let users skip the week grid entirely.
- **MEDIUM: Dollar commitment has no context** -- "$0.50 minimum" but no explanation of when/how charges happen, what derailing means financially, or suggested amounts based on goal type. **NOTE: Under the new upfront-charge model, this becomes even more critical. Users need to understand that they will be charged IMMEDIATELY when they commit, not hypothetically in the future. The form must communicate: "You will be charged $X right now. Complete your task to get it back."**
- **MEDIUM: "Work block length" is in minutes but stored internally in seconds** -- this is invisible to users but the conversion logic in JavaScript (multiply by 60) is a maintenance concern.
- **LOW: Background color picker with no preview** -- users pick a color but cannot see how it will look on the task card.
- **LOW: No form progress indicator** -- users do not know how close they are to completing the form.

**Recommendation:** Implement a wizard/stepper pattern: Step 1 (What), Step 2 (When), Step 3 (Stakes), Step 4 (Review). Provide templates. Explain each concept inline.

#### 1.2.6 Task Detail Page (`/tasks/{slug}`)

**Current Implementation:**
- Back link, H1 title, archive warning banner
- Key-value grid: start date, deadline, type, length, committed, recurring, paused, background color swatch
- Edit and Copy buttons
- Time entries list (TimesheetList Vue component) with pagination
- Yesterday's derail refund form (if applicable)

**Friction Points:**
- **MEDIUM: Pure data dump layout** -- the task detail is a list of key-value pairs with no visual hierarchy, no progress visualization, and no emotional engagement.
- **MEDIUM: No daily progress visible** -- the task detail shows static configuration but not today's status, progress bar, or history.
- **MEDIUM: Refund section is buried at the bottom** -- a user who was charged for a derail may not notice the refund option. **NOTE: Under the new upfront-charge model, the refund flow reverses entirely. Refunds happen on COMPLETION (the happy path), not as a manual request after derailing. The task detail page should prominently show the user's escrowed amount and make the "complete to earn back" loop visible and satisfying.**
- **LOW: Edit/Copy buttons are side by side with no visual distinction** -- both use btn styling, which can lead to accidental edits when intending to copy.
- **LOW: Time entries are listed but not summarized** -- no "total time this week" or "average daily" metrics.

#### 1.2.7 Analytics (`/analytics`)

**Current Implementation:**
- Metrics table: task name, time spent, money spent, completed count, derails count, with totals row
- "Charts" section with "New chart" dropdown (time spent, money spent, derails)
- Per-task color pickers
- Resizable Chart.js charts (line, bar, pie, polar area) with settings modal
- Chart settings modal: title, size, data tracked, type, all/specific tasks, cumulative, stacked, X axis grouping, date range (preset or custom)

**Assessment:**
- **WORKS WELL:** The metrics summary table is genuinely useful. It answers "how much have I done?" and "how much has it cost me?" at a glance. **NOTE: Under the new upfront-charge model, the "money spent" column semantics change. It should be reframed as "money lost" (forfeited from uncommpleted tasks) vs "money earned back" (refunded from completed tasks). This reframing turns a punishment metric into a reward metric.**
- **PROBLEM:** Chart creation is powerful but complex. The settings modal has 8+ configuration options. For most users, reasonable defaults (e.g., "show my time spent this month as a bar chart") would be better than a configuration panel.
- **PROBLEM:** No "insight" layer. Charts show data but do not highlight patterns, warn about trends, or provide actionable recommendations.
- **PROBLEM:** The color picker section is disconnected from the charts. Users must scroll up to change colors, then scroll down to see the effect.
- **PROBLEM:** `console.log(settings, oldSettings)` left in Chart.vue watcher -- debug code in production.
- **LOW: Chart size control (the 4-segment bar in Chart.vue) is not intuitive** -- it looks like a progress indicator, not a size selector.

#### 1.2.8 Breaks (`/breaks`)

**Current Implementation:**
- Title with plus icon to add break
- "Show past breaks" checkbox
- Table: title, start date, end date, edit/delete icons
- Modal forms for add/edit/delete
- Pagination

**Friction Points:**
- **MEDIUM: "Breaks" concept is not explained** -- new users do not know what a break does (pauses all tasks, no penalties). There is no onboarding tooltip or help text.
- **MEDIUM: Unlimited break is only accessible from the task dashboard header** -- yet scheduled breaks are managed here. These two break types live in different parts of the UI.
- **LOW: Column widths are fixed and break on mobile** -- the 4-column layout (title, start, end, actions) does not adapt well to small screens. The column sum is 4+3+3+3=13 which exceeds the 12-column grid (the last `col-2` in the template vs `col-3` in the header mismatch causes visual misalignment).

#### 1.2.9 Account (`/my-account`)

**Current Implementation:**
- Centered container with H1
- Payment method section: shows card type/last4/expiry, "Manage payment method" button (Stripe portal)
- OR "Setup card" button for new users
- "Update details" section: first name, last name, email, timezone, current password (hidden until needed), update button
- "Password" section: button to open change password modal

**Friction Points:**
- **HIGH: Payment method is a hard gate** -- users cannot access tasks, analytics, or breaks without a valid payment method. The redirect to `/my-account?errorCard=1` shows a generic warning. This is a major conversion barrier for new users who want to explore before committing. **NOTE: Under the new upfront-charge model, this gate is actually more justified -- you cannot commit without a way to pay. However, the messaging must shift from "we need a card to punish you" to "we need a card so you can invest in yourself." See Section 3.4 for onboarding payment framing.**
- **MEDIUM: The page is a flat stack of forms** -- payment, profile, and password are all visually undifferentiated sections with H2 headings. No cards, no tabs, no visual grouping.
- **LOW: No payment history visible** -- users cannot see past charges or refunds without going to Stripe. **NOTE: Under the new model, payment history becomes much more important. Users will have frequent charges (on commit) and refunds (on complete). A "wallet" or "investment history" view showing money escrowed, refunded, and forfeited is essential.**
- **LOW: Timezone change on this page uses the same raw select as signup** -- same UX problem.

#### 1.2.10 Timer UX Evaluation

**Current Flow:**
1. User sees "Start" text on an active time-based task card
2. Clicks "Start" -- AJAX call to `plugin-timer/timer/start`
3. Progress bar begins incrementing every second (1% per `progressPerSec`)
4. Card border changes from solid to dashed
5. User clicks "Stop" -- AJAX call to `plugin-timer/timer/stop`
6. Progress bar updates to server-calculated value

**Assessment:**
- **WORKS:** The basic start/stop mechanism is functional. The real-time progress bar provides satisfying visual feedback.
- **PROBLEM:** There is no time display -- users see a progress bar but not "12:34 elapsed" or "5:26 remaining." The countdown shows "Minutes until deadline" which is about the overall day deadline, not the timer itself.
- **PROBLEM:** Starting a timer on one card does not visually "focus" on that card. If you have 8 tasks, it is easy to lose track of which timer is running.
- **PROBLEM:** No confirmation before stopping a timer. Accidental taps on "Stop" immediately end the timer.
- **PROBLEM:** The `changingTimer` guard prevents double-clicks but provides no visual feedback that the click was registered (no loading spinner on the Start/Stop text).
- **PROBLEM:** Timer state is not synchronized across browser tabs. Opening MAST in two tabs can cause inconsistent state.
- **PROBLEM:** For "less" tasks (e.g., "Less than 30 min of social media"), the mental model of "Start/Stop" is inverted. Starting a timer means "I am doing the thing I want to do less of" but the UI does not acknowledge this inversion.

#### 1.2.11 Mobile Responsiveness Assessment

**Breakpoint Behavior:**
- XL (1200px+): 4-column task grid, full navigation
- LG (992px+): 3-column task grid, full navigation
- MD (768px+): 2-column task grid, hamburger menu
- SM/XS (<768px): 1-column task grid, full-width mobile menu overlay

**Assessment:**
- **WORKS:** The Bootstrap grid handles task cards reasonably well. The fixed header works on mobile.
- **PROBLEM:** The header icon bar (pause, hide, archive, add) has tiny touch targets (Font Awesome icons at `fs-3`/`fs-4` scale with no padding).
- **PROBLEM:** The task creation form's week grid (7 columns of number inputs) is barely usable on mobile. On phones, it wraps to 4-per-row with `col-3`, creating an awkward 4+3 layout.
- **PROBLEM:** Analytics metrics table uses a 5-column layout (`col-3, col-3, col-2, col-2, col-2`) that does not respond to small screens at all. Data overflows and truncates.
- **PROBLEM:** Breaks list has the same responsive issue with fixed column widths.
- **PROBLEM:** Chart settings modal on mobile is cramped.
- **PROBLEM:** Task detail page's key-value grid (`col-6 col-6`) works but is visually monotonous.

---

## 2. User Story Mapping

### 2.1 Core User Stories -- Current Coverage

| # | User Story | Current Screen(s) | Coverage Rating | Gaps |
|---|-----------|-------------------|----------------|------|
| S1 | "I want to invest in my future self by putting money on the line" | Task creation form | PARTIAL | Form is overwhelming; no explanation of upfront-charge model; no smart defaults; no "investment" framing |
| S2 | "I want to track my progress throughout the day" | Task dashboard (cards + progress bar) | GOOD | No elapsed time display; no daily summary view |
| S3 | "I want to see if I'm about to derail and take action" | Task card countdown, red border | PARTIAL | No push notifications; no "danger zone" escalation; countdown is easy to miss |
| S4 | "I want to understand my patterns over time" | Analytics page | GOOD | No insights/recommendations; no streak tracking; no trend alerts |
| S5 | "I want to take a break without being penalized" | Breaks page + unlimited break toggle | PARTIAL | Two break types in different UI locations; no explanation of break system |
| S6 | "I want to manage my payment method and see my investment history" | Account page (Stripe) | PARTIAL | No payment history; no escrow balance view; hard gate blocks exploration; no visibility into money earned back vs forfeited |

### 2.2 New Stories -- Current Gaps

| # | User Story | Current Support | Gap Severity |
|---|-----------|----------------|-------------|
| N1 | "As a parent, I want to set up commitments for my child" | NONE | CRITICAL -- no multi-user or parent/child model |
| N2 | "As a child, I want to see what I need to do today in a fun way" | NONE | CRITICAL -- no child-appropriate interface exists |
| N3 | "As a user, I want my AI agent to track my commitments for me" | NONE | CRITICAL -- no API, no agent integration, no automation hooks |
| N4 | "As a user, I want to sign up with minimal friction for agent mode" | NONE | HIGH -- current signup requires 6+ fields and payment method |
| N5 | "As a user, I want to see my streaks and feel proud of consistency" | NONE | HIGH -- no streak tracking exists at all |
| N6 | "As a user, I want to feel the emotional weight of my commitment" | PARTIAL | MEDIUM -- dollar amount shown but no emotional design, no "the stakes are real" moment |
| N7 | "As a user, I want to understand what happens when I derail" | PARTIAL | MEDIUM -- derail mechanics are implicit, not explained |
| N8 | "As a new user, I want to be guided through my first task" | NONE | HIGH -- no onboarding, no tutorial, no first-run experience |
| N9 | "As a user, I want to see how much money I have invested and earned back" | NONE | HIGH -- no wallet/escrow view; no investment-return framing |
| N10 | "As a user, I want to feel the satisfaction of getting my money back on completion" | NONE | HIGH -- no refund celebration moment exists |
| N11 | "As a user, I want to choose between Stripe and crypto for my commitments" | NONE | MEDIUM -- only Stripe exists; crypto escrow would enable near-100% refunds |

### 2.3 Story-to-Screen Journey Map

```
OLD MODEL JOURNEY (charge on fail):
ACQUISITION          ACTIVATION              DAILY USE                 RETENTION
-----------          ----------              ---------                 ---------
                     [Signup]                [Dashboard]               [Analytics]
[Landing Page] -->   [Payment Setup] -->    [Start Timer] -->         [Charts]
                     [First Task] -->       [Track Progress]          [Streaks*]
                     [?? No onboarding]     [Complete/Derail]         [Achievements*]
                                            [Manage Breaks]

NEW MODEL JOURNEY (invest upfront, earn back on complete):
ACQUISITION          ACTIVATION              DAILY USE                       RETENTION
-----------          ----------              ---------                       ---------
                     [Signup]                [Dashboard: see escrowed $]     [Analytics]
[Landing Page] -->   [Payment Setup] -->    [Start Timer]                   [Wallet/History]
                     [First Task:           [Track Progress]                [Streaks*]
                      CHARGED $X] -->       [Complete -> REFUND $X!]        [Achievements*]
                     [?? No onboarding]     [Fail -> Money forfeited]       [ROI view*]
                                            [Manage Breaks]

* = does not exist yet

CRITICAL GAPS (in addition to old gaps):
- No onboarding between signup and first task
- No "aha moment" -- user must figure out the value prop independently
- No retention mechanics beyond the financial penalty
- No win state celebration
- NEW: No escrow/wallet visualization -- users need to see money "held"
- NEW: No refund celebration moment -- the #1 emotional payoff is invisible
- NEW: No investment-return framing in analytics
- NEW: No payment method choice (Stripe vs crypto)
```

---

## 3. Design Recommendations per Variant

### 3.1 Adult Variant Design (Codename: Vorpal)

The adult variant should convey discipline, power, and consequence. The Vorpal codename evokes sharpness, precision, and finality -- a blade that cuts through excuses.

#### 3.1.1 Color Palette

| Token | Color | Hex | Purpose |
|-------|-------|-----|---------|
| `--primary` | Obsidian | `#1a1a2e` | Deep blue-black. Background for dark mode, text for light mode. |
| `--accent` | Crimson Edge | `#e63946` | Red that conveys urgency and stakes. Derail state, CTA buttons. |
| `--success` | Forged Steel | `#2d6a4f` | Dark green. Completion, achievement. |
| `--warning` | Ember | `#e76f51` | Warm orange. Approaching deadline, caution. |
| `--surface` | Slate | `#16213e` | Card backgrounds in dark mode. |
| `--surface-light` | Parchment | `#f8f9fa` | Card backgrounds in light mode. |
| `--highlight` | Blade Silver | `#a8dadc` | Accent for active timers, progress bars. |
| `--text-primary` | `#e8e8e8` (dark) / `#1a1a2e` (light) | High-contrast text. |
| `--text-secondary` | `#6c757d` | Muted text, secondary information. |

**Rationale:** Moving from purple (playful, creative) to obsidian/crimson (disciplined, high-stakes) reframes MAST from a "tool" to a "weapon." The palette borrows from dark fantasy and martial aesthetics without being childish.

#### 3.1.2 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Display / Hero | **Inter** or **Space Grotesk** | 700 | 2.5-3rem |
| Headings | Inter | 600 | 1.25-2rem |
| Body | Inter | 400 | 1rem (16px) |
| Data / Numbers | **JetBrains Mono** | 500 | 0.875-1rem |
| Labels / Caps | Inter | 500, uppercase, letter-spacing 0.05em | 0.75rem |

**Rationale:** Ubuntu is friendly and soft. Inter is neutral and sharp. JetBrains Mono for numbers (dollar amounts, time, progress) gives a data-driven, precise feel. Space Grotesk provides a geometric, modern option for display text that suggests engineering precision.

#### 3.1.3 Iconography Direction

- **Style:** Sharp geometric line icons, not rounded/friendly
- **Library:** Lucide Icons (open source, consistent 24x24 grid, sharp corners) or Phosphor Icons (bold weight)
- **Custom icons for MAST concepts:**
  - Commitment = Shield with blade
  - Derail = Broken chain or crack
  - Streak = Flame (ascending intensity)
  - Complete = Blade striking through (not a generic checkmark)
  - Timer = Hourglass with sand flowing
  - Break = Sheathed blade

#### 3.1.4 Gamification: Streaks, Achievements, Levels

**Streaks:**
- Track consecutive days of completing all active tasks
- Visual: flame icon that grows in intensity (1-7 days: small flame; 7-30: medium; 30-100: large; 100+: inferno)
- Streak freeze: users can "freeze" one day per month using accumulated credit from consistent performance
- Streak display: prominent on dashboard header, e.g., "17-day streak" with fire icon

**Achievements:**
- Milestone-based, not effort-based (avoid rewarding busywork)
- Examples:
  - "First Blood" -- complete your first task
  - "Iron Will" -- 7-day streak
  - "Unbreakable" -- 30-day streak
  - "Zero Derails" -- complete a full month with no derails
  - "High Stakes" -- commit $10+ to a single task
  - "Early Riser" -- complete a task before 8 AM
  - "Night Owl" -- complete a task after 10 PM
  - "Diversified" -- maintain 5+ active tasks simultaneously
  - "Comeback" -- recover from a derail and complete the next 7 days
- Achievement display: badge wall on profile, with locked/unlocked states

**Levels:**
- XP earned from: completing daily tasks (10 XP), maintaining streaks (5 XP/day of streak), achieving milestones (50-200 XP)
- Level names (martial progression): Initiate, Apprentice, Warrior, Knight, Champion, Master, Grandmaster, Legend
- Levels unlock: custom themes, additional chart types, streak freeze capability, badge frames

#### 3.1.5 Emotional Design: Making the Stakes Feel Real

The new upfront-charge model fundamentally changes the emotional arc. Instead of "avoid punishment," the arc becomes "invest in yourself, earn it back." This is psychologically more powerful because loss aversion kicks in immediately -- the money is already gone from your account.

- **Investment moment (replaces "commitment moment"):** When creating a task, show a "commitment contract" summary screen: "You are investing $[Y] in yourself. Complete [X] every [schedule] to earn it back. If you miss a day, the money is forfeited." The confirmation button should say "INVEST $5" not "Submit" -- the user must explicitly acknowledge the charge. Show the Stripe/crypto payment confirmation inline. This is the most important emotional moment in the app.
- **Charge confirmation:** Immediately after committing, show a clear receipt: "You invested $5.00 in tomorrow's exercise. Your card was charged. Complete it to earn it back." This is NOT a negative moment -- frame it as empowerment, not loss.
- **Refund celebration (NEW -- the #1 emotional payoff):** When a task is completed, show a satisfying refund animation. "$5.00 earned back!" with a brief green flash, a coin-return sound/animation, and update the wallet balance. This is the dopamine hit that drives retention. Under the old model, completing a task felt like... nothing. Under the new model, completing a task feels like getting paid.
- **Forfeit experience (replaces "derail experience"):** When a task is not completed by deadline, show: "You forfeited $5.00. That money is gone. Tomorrow, invest again." This is less jarring than "you were charged" because the money was already committed -- it is the absence of the refund, not a new charge. Show where the forfeited money goes (charity, platform, etc.).
- **Daily escrow display:** The dashboard should prominently show "You have $31 invested in today's commitments." This is money the user is fighting to earn back. It creates urgency without being punitive.
- **Win celebration:** When ALL tasks for the day are complete, show: "You earned back everything today! $31 returned." Confetti, blade strike animation, streak count. This daily "earn it all back" moment is the key retention loop.
- **Progress tension:** As deadline approaches, subtly intensify the card's visual urgency -- background tint shifts from neutral to warm to hot. The countdown becomes more prominent. Add the escrowed amount: "3 hours left to earn back $5."
- **Morning briefing:** A dashboard state that shows "Today's investments" with a clean summary of what is due and how much is at stake: "5 commitments. $31 invested. Earn it all back."

### 3.2 Children's App Design

Targeting ages 6-12, with distinct sub-approaches for 6-8 and 9-12.

#### 3.2.1 Age-Appropriate Visual Language

- **Colors:** Bright, saturated primary colors. Sky blue (`#4FC3F7`), sunshine yellow (`#FFD54F`), grass green (`#81C784`), coral (`#FF8A65`). White backgrounds for clarity.
- **Typography:** Rounded sans-serif such as **Nunito** or **Quicksand**. Larger base size (18px). Bold for emphasis, no all-caps.
- **Shapes:** Rounded corners (16px+), soft shadows, no sharp geometric forms.
- **Mascot:** A friendly character (e.g., a fox, robot, or dragon) that guides the child. The mascot reacts to progress (happy when tasks are done, sleepy when idle, concerned when deadline approaches).
- **Animations:** Bouncy micro-interactions. Stars burst when completing a task. Character does a dance when all tasks are done.

#### 3.2.2 Simplified Navigation

- **Tab bar (bottom):** 3-4 tabs maximum: Home (today's tasks), Stars (achievements/rewards), Settings (parent-controlled)
- **No hamburger menu:** All navigation is visible at all times
- **No text-heavy menus:** Icons with labels always visible
- **Minimum button size:** 64x64dp with 64px gap between buttons to reduce accidental touches
- **No nested modals or complex forms:** Everything is one screen deep

#### 3.2.3 Gamification for Children

**Stars (backed by parent escrow):**
- Children earn stars for completing tasks, not money. The parent configures the star-to-reward mapping (e.g., "10 stars = ice cream outing").
- Behind the scenes, parents pre-fund commitments using the upfront-charge model -- like an allowance escrow. When the parent creates a commitment, they deposit money into escrow. When the child completes the task, the parent gets refunded (or the money converts to a reward fund for the child). If the child misses, the money is forfeited (goes to a family savings account, charity, or is simply lost).
- The child NEVER sees dollar amounts. They see stars, rewards, and progress. The financial mechanics are entirely in the parent dashboard.
- Star collection is visible and countable. Physical metaphor: a jar filling up with stars.

**Badges:**
- Visual, collectible, themed (animals, space, underwater, dinosaurs)
- "Super Helper" (3-day streak), "Star Collector" (10 stars), "Early Bird" (before school), "Night Champion" (bedtime routine done)

**Characters:**
- The mascot character levels up visually: gains accessories, costumes, or evolves
- Child can customize their character with earned rewards

**Daily Quests:**
- Tasks framed as "quests" or "missions" rather than "tasks"
- "Today's Missions: Feed the dog, Practice piano, Read for 20 minutes"

#### 3.2.4 Progress Visualization for Children

- **Filling jar:** Instead of a percentage bar, show a jar or container that fills with colorful liquid/stars as progress is made.
- **Map/journey:** A visual path (like Candy Crush map) where each completed day moves the character forward.
- **Sticker chart:** Weekly view that resembles a physical sticker chart, with each day earning a sticker.
- **No decimals or complex numbers:** Progress is "3 out of 5 done" not "60%."

#### 3.2.5 Parent Dashboard vs Child View

**Parent View (web or separate app section):**
```
+---------------------------------------------------+
| PARENT DASHBOARD                          [Child1] |
+---------------------------------------------------+
|                                                     |
| Today's Progress: 3/5 tasks complete               |
| [============================------] 60%            |
|                                                     |
| COMMITMENT FUND                                     |
| Escrowed today: $7.50    Earned back: $4.50        |
| This month: $120 invested / $95 earned back (79%)  |
|                                                     |
| Tasks                          Status    Escrowed   |
| --------------------------------------------------  |
| Practice piano (20 min)        [x] Done    $1.50 R |
| Read for 20 minutes            [x] Done    $1.50 R |
| Clean room                     [x] Done    $1.50 R |
| Math homework (30 min)         [ ] Pending $1.50   |
| Brush teeth                    [ ] Pending $1.50   |
| (R = refunded)                                      |
|                                                     |
| This Week: Mon[*] Tue[*] Wed[*] Thu[.] Fri[.] Sat  |
|                                                     |
| [Manage Tasks]  [Rewards Settings]  [Fund Settings] |
|                                                     |
| Rewards Earned: 15 stars (5 until next reward)      |
| Forfeit destination: [Family savings v]             |
+---------------------------------------------------+
```

**Parent fund settings options:**
- Choose where forfeited money goes: family savings, charity, or platform
- Set per-task escrow amounts (hidden from child, shown as "difficulty level" stars)
- Pre-fund a weekly/monthly commitment budget
- View refund history and net cost of the children's commitment program

**Child View (tablet/phone):**
```
+-----------------------------------+
|  [Fox mascot waving]              |
|  "Hi Alex! You have 5 missions!" |
+-----------------------------------+
|                                   |
|  [Star jar: *** ** ]  15 stars!  |
|                                   |
|  TODAY'S MISSIONS                 |
|                                   |
|  [Piano icon]                     |
|  Practice Piano - 20 min         |
|  [  START  ]                      |
|                                   |
|  [Book icon]                      |
|  Read a Book - 20 min            |
|  [  START  ]                      |
|                                   |
|  [Broom icon]                     |
|  Clean Room                       |
|  [  DONE!  ]                      |
|                                   |
|  [Trophy icon]                    |
|  "3 more to earn a star!"        |
|                                   |
+-----------------------------------+
| [Home]    [Stars]    [Me]         |
+-----------------------------------+
```

### 3.3 Agent-First Design

The agent-first variant serves users who want AI to handle the tracking and accountability. The design philosophy is: "you set the rules, the agent enforces them."

#### 3.3.1 Ultra-Minimal Signup

The agent-first signup should have maximum 2 steps:

**Step 1: Identity**
```
+-------------------------------------------+
|                                            |
|   MAST                                     |
|                                            |
|   Let your agent keep you accountable.     |
|                                            |
|   [Continue with Google]                   |
|   [Continue with Apple]                    |
|   [Continue with email]                    |
|                                            |
+-------------------------------------------+
```

**Step 2: Connect Agent**
```
+-------------------------------------------+
|                                            |
|   Connect Your Agent                       |
|                                            |
|   Your agent needs an API key to track     |
|   your commitments and report progress.    |
|                                            |
|   API Key: [mast_ak_xxxxxx]  [Copy]       |
|                                            |
|   Agent Framework:                         |
|   [Claude] [OpenAI] [Custom]              |
|                                            |
|   [Complete Setup]                         |
|                                            |
+-------------------------------------------+
```

Payment method is required during onboarding because the agent will charge upfront on the user's behalf when creating commitments. The user pre-authorizes the agent to escrow funds within configurable limits (e.g., "my agent can commit up to $50/day on my behalf"). This pre-authorization is the key trust mechanism.

#### 3.3.2 Status Dashboard Concept

The agent-first dashboard is read-heavy, not interaction-heavy. The user monitors; the agent acts.

```
+-----------------------------------------------------------+
| MAST                                    [Agent: Connected] |
+-----------------------------------------------------------+
|                                                            |
| AGENT STATUS          Last action: 2 min ago              |
| [====================================] Active              |
|                                                            |
| TODAY'S INVESTMENTS           $15 escrowed / $5 earned back|
|                                                            |
| Exercise 30 min    [Agent verified: Strava]  DONE  $5 [R] |
| Write 1000 words   [Agent checking: Docs]    PEND  $5 [$] |
| No social media     [Agent monitoring]       ACTV  $3 [$] |
| Read 30 min         [Due by 10pm]            PEND  $2 [$] |
| ([$] = escrowed, [R] = refunded)                          |
|                                                            |
| AGENT ACTIONS LOG                                          |
| 14:32  Verified exercise via Strava (32 min) -> REFUND $5 |
| 14:30  Checked Google Docs word count (450/1000)          |
| 14:00  Screen time check: 12 min social media today       |
| 09:00  Escrowed $15 across 4 commitments                  |
|                                                            |
| STREAK: 12 days            DAILY LIMIT: $50 (used: $15)  |
|                                                            |
| [Agent Settings]    [Manual Override]    [View Analytics]  |
+-----------------------------------------------------------+
```

#### 3.3.3 Trust/Control Visualization

Key design patterns for agent-first:
- **Agent activity indicator:** Always-visible status showing when the agent last acted and its current state (connected, checking, idle, error)
- **Verification badges:** Each task shows HOW the agent verified completion (data source, method)
- **Override controls:** Clear "I want to handle this myself" escape hatch for any task
- **Transparency log:** Scrollable history of every action the agent took, timestamped -- including financial actions ("Escrowed $5 for exercise", "Refunded $5 after verification")
- **Permission levels:** Visual indicator of what the agent can and cannot do (read data, mark complete, create tasks, escrow money). Financial permissions are the most sensitive:
  - **Spending limit:** "Agent can escrow up to $X per day" with a clear slider/input
  - **Per-task cap:** "No single commitment over $Y"
  - **Approval required above threshold:** "Ask me before committing more than $Z to a single task"
  - **Payment method choice:** Agent can use Stripe or crypto based on user preference
- **Financial activity feed:** Distinct from the general activity log, a dedicated "money" tab showing all escrows, refunds, and forfeitures with running balance

#### 3.3.4 "Your Agent is Watching" Communication

- **Tone:** Calm confidence, not surveillance anxiety. "Your agent is keeping you on track" not "your agent is watching you."
- **Visual metaphor:** A small, always-present agent avatar (abstract, geometric -- not a face) that subtly animates when the agent is active. Think of it as a compass needle or a pulse indicator.
- **Notification language:** "Your agent noticed you completed your exercise goal early today" (positive) vs "Your agent flagged that your writing goal is at risk -- 3 hours until deadline" (escalation, not alarm)

### 3.4 Payment Model UX Implications

The shift from "charge on fail" to "charge upfront, refund on complete" is the most significant design change in this specification. It affects every screen, every flow, and the entire emotional arc of the product.

#### 3.4.1 Old Model vs New Model -- UX Comparison

| Aspect | Old Model (Charge on Fail) | New Model (Invest Upfront) |
|--------|---------------------------|---------------------------|
| **Commitment moment** | Abstract threat: "If you fail, you'll be charged" | Concrete action: "You are being charged $5 right now" |
| **Loss aversion** | Hypothetical (brain discounts future losses) | Immediate (the money is already gone from your account) |
| **Completion feeling** | Relief: "I avoided punishment" | Reward: "I earned my money back!" |
| **Failure feeling** | Shock: "I just got charged!" | Resignation: "I didn't earn it back" (softer) |
| **Daily dashboard** | "Here's what you could lose" | "Here's what you've invested -- earn it back" |
| **Analytics framing** | "Money spent on failures" (negative) | "Money invested vs earned back" (positive ROI) |
| **Motivation type** | Avoidance motivation (fear-based) | Achievement motivation (reward-based) |
| **Payment frequency** | Rare (only on derails) | Frequent (every commitment creates a charge) |
| **Refund frequency** | Rare (manual request after derail) | Frequent (automatic on every completion) |

**Psychological advantage:** Research on loss aversion shows that people feel losses approximately 2x more strongly than equivalent gains. In the old model, the loss was theoretical. In the new model, the loss is REAL AND PRESENT -- the user has already paid. Completing the task triggers the reward pathway (getting money back) rather than just the relief pathway (avoiding punishment). This dual mechanism -- immediate loss aversion PLUS reward on completion -- is more motivating than either alone.

#### 3.4.2 Payment Path UX -- Stripe vs Crypto-via-Card

**The Stripe fee problem (legacy path):** Stripe charges ~2.9% + $0.30 per transaction. On a $5 commitment, that is $0.45 -- a 9% tax on every round-trip. Stripe does not return processing fees on refunds.

**The solution: Crypto-via-card (Coinbase Onramp + Base L2).** Users pay with their credit card. Behind the scenes, Coinbase Onramp converts fiat → USDC on Base, deposits into a smart contract escrow, and off-ramps back to the user's card on completion. The user experience is identical to Stripe — pay with card, get refunded to card — but fees are ~$0.01 instead of ~$0.45.

**UX implications of the crypto-via-card path:**

1. **No fee disclaimers needed.** Unlike Stripe, there are no meaningful processing fees to disclose. The user sees: "Invest $5.00. Complete the task, get $5.00 back." Clean, simple, honest.

2. **Full refund messaging.** The #1 UX advantage: "Get 100% back." No asterisks, no "minus processing fees." This is a powerful trust signal and conversion driver.

3. **Same card UX.** The user adds their card once during onboarding (via Coinbase Onramp's embedded widget). From then on, commitments are charged to the card and refunds go back to the card. No wallet addresses, no gas tokens, no crypto jargon.

4. **Transparency as a bonus.** For curious users, the escrow contract is viewable on Base — they can verify their money is held in code, not by the platform. This is an opt-in trust feature, not a required interaction.

**Stripe fallback:** Stripe remains available as a fallback payment method. If Coinbase Onramp is unavailable in a user's region, or the user prefers traditional card processing, Stripe Connect handles the payment with the following fee mitigations:

- **Batched charges:** Charge a daily or weekly lump sum instead of per-task. 5 tasks at $5 each = one $25 charge ($1.03 fee, 4.1%) instead of five charges ($2.25 fees, 9%).
- **Minimum commitment:** $3-5 floor to keep fee percentage manageable.
- **"Fee absorber" framing:** "MAST covers part of the processing cost so you get more back."

#### 3.4.3 Crypto Path -- UX Design

Crypto escrow enables near-100% refunds with near-zero fees. **Crucially, users do NOT need a crypto wallet.** Modern on-ramp providers (Coinbase Onramp, Stripe Stablecoins) bridge credit/debit cards directly to USDC on Base L2. The crypto layer is invisible infrastructure — users pay with their card and get refunded to their card. The UX is identical to Stripe from the user's perspective, but with dramatically lower fees.

**Two UX modes:**

**Mode A: Card-based (default — crypto is invisible).**
Users pay with credit/debit card, Apple Pay, or Google Pay. Behind the scenes, Coinbase Onramp converts to USDC on Base, deposits into escrow, and off-ramps back to the user's card on completion. The user never sees a wallet address or signs a crypto transaction.

```
+-------------------------------------------+
|  YOUR COMMITMENT ESCROW                    |
|                                            |
|  Balance held: $31.00                      |
|  Locked until: 11:59 PM today             |
|                                            |
|  Complete all tasks -> full refund         |
|  Miss a task -> that portion forfeited     |
|                                            |
|  Payment method: Visa ending 4242          |
|  Refund to: same card                      |
|                                            |
|  [View escrow details]  (shows on-chain    |
|   contract for transparency)               |
+-------------------------------------------+
```

**Mode B: Wallet-connected (opt-in for crypto-native users).**
Power users can connect MetaMask, Coinbase Wallet, or Phantom to interact with the escrow contract directly. This is the fully trustless path — they deposit USDC themselves and can verify the contract on-chain.

```
+-------------------------------------------+
|  YOUR ESCROW CONTRACT                      |
|                                            |
|  Contract: 0x1a2b...3c4d  [View on Base]  |
|  Balance: $31.00 USDC                      |
|  Locked until: 11:59 PM today             |
|                                            |
|  Complete all tasks -> full release        |
|  Miss a task -> that portion forfeited     |
|                                            |
|  Wallet: 0x9f8e...7d6c (MetaMask)         |
+-------------------------------------------+
```

**UX principles for the crypto path:**

1. **Card is the default.** The onboarding flow should present card payment first. The "crypto wallet" option is secondary, for users who specifically want direct wallet interaction. Most users will never know crypto is involved.

2. **Trust advantage messaging (optional transparency):** For users who explore the escrow details: "Your money is held by a smart contract on Base — not by us. Complete your task, and the contract releases your funds automatically. No processing fees." This is a trust-builder, not a required step.

3. **Stablecoin only:** All amounts shown in dollars. USDC is the underlying token but users see "$5.00", not "5 USDC." For wallet-connected users, show "5.00 USDC" in secondary text.

4. **Zero visible fees:** On the card-via-crypto path (Coinbase Onramp), the user sees: "You invest $5.00. Complete the task, get $5.00 back." No fee disclaimers needed — because there are effectively no fees (~$0.01 gas).

5. **Gasless UX:** On Base with Coinbase Paymaster, transactions are gasless for USDC. Users never need ETH for gas. This eliminates the biggest crypto UX friction point.

6. **Forfeiture destination:** Smart contract can be configured to send forfeited funds to:
   - A charity address (transparent, verifiable on-chain)
   - A burn address (permanently destroyed -- ultimate commitment)
   - A community pool (redistributed to completers as bonus rewards)

#### 3.4.4 Wallet / Investment History Screen (NEW)

The new model creates a need for a screen that does not exist in the current app: a financial dashboard showing the user's commitment investment history.

```
+-----------------------------------------------------------+
| WALLET                                                     |
+-----------------------------------------------------------+
|                                                            |
| THIS MONTH                                                 |
| +------------------------+  +---------------------------+  |
| | Invested: $465         |  | Earned back: $430 (92%)   |  |
| | Forfeited: $35         |  | Processing fees: $12.50   |  |
| +------------------------+  +---------------------------+  |
|                                                            |
| NET COST OF COMMITMENT: $47.50                            |
| "You paid $47.50 to maintain a 92% completion rate.        |
|  That's $1.58/day for discipline."                         |
|                                                            |
| PAYMENT METHOD                                             |
| Visa ending 4242         [Manage]                          |
| Crypto wallet 0x1a2...   [Manage]                          |
|                                                            |
| FORFEITED MONEY GOES TO                                    |
| ( ) Charity: Doctors Without Borders                       |
| ( ) Platform (supports MAST development)                   |
| ( ) Burn (crypto only)                                     |
|                                                            |
| RECENT TRANSACTIONS                                        |
| Feb 20  Escrowed $31 (5 tasks)                            |
| Feb 20  Refunded $5 (Exercise complete)                   |
| Feb 19  Refunded $31 (all tasks complete!)                |
| Feb 18  Forfeited $5 (Read -- missed deadline)            |
| Feb 18  Refunded $26 (4/5 tasks complete)                 |
| [View all]                                                 |
|                                                            |
| ALL-TIME STATS                                             |
| Total invested: $2,340    Earned back: $2,180 (93%)       |
| Total forfeited: $160     Processing fees: $68            |
+-----------------------------------------------------------+
```

**Key UX principles for the wallet:**
- **Positive framing:** Lead with "earned back" percentage, not "forfeited" amount
- **ROI language:** "Your cost of discipline" frames forfeited money as an investment in self-improvement, not a loss
- **Full transparency:** Show processing fees separately so users understand where their money goes
- **Forfeiture destination:** Let users choose AND see where forfeited money goes. This increases buy-in and reduces resentment.
- **Transaction history:** Every charge and refund visible, searchable, exportable

#### 3.4.5 Forfeited Money Destination -- Design Decision

What happens to money from missed commitments is a critical design and trust decision. Options:

| Destination | Pros | Cons | UX Impact |
|-------------|------|------|-----------|
| **Charity** | Feels good even on failure ("at least it helped someone"); tax-deductible; PR-friendly | Users may intentionally "donate" by skipping; reduces punishment sting | Show charity logo on forfeit screen: "Your $5 went to [charity]" |
| **Platform (MAST revenue)** | Simple; funds development; aligns incentives | Users may resent "paying MAST to fail"; trust concern | Must be transparent: "Supports MAST development" |
| **Community pool** | Redistributed to successful users as bonus rewards | Complex; may incentivize gaming the system | "Your consistency earned you $2.30 in bonus rewards this month from the community pool" |
| **Burn (crypto only)** | Maximum commitment -- money is permanently destroyed | Only works with crypto; no benefit to anyone | "Your $5 has been permanently burned. This is the ultimate accountability." |
| **User choice** | Maximum autonomy; reduces resentment | More complex UI; decision fatigue | Offer during onboarding, changeable in settings |

**Recommendation:** Default to charity with user choice. During onboarding, present the options. In the forfeit moment, show where the money went. This turns a negative moment ("I failed") into a slightly positive one ("at least it helped someone").

#### 3.4.6 Break System Under New Model

Breaks interact with the upfront-charge model in important ways:

- **Scheduled break:** No charges are created for break days. The user is not invested, so there is nothing to refund or forfeit. Simple.
- **Unlimited break:** If the user activates an unlimited break mid-day AFTER being charged, the escrowed amount for that day should be refunded (since the user is choosing to pause, not failing). This is a "graceful exit" mechanism.
- **Break abuse prevention:** If a user creates a break after the deadline has passed (i.e., retroactively), the escrow should NOT be refunded. The break must be created before the charge/commitment period begins.

#### 3.4.7 Variant-Specific Payment Model UX

**Adult (Vorpal):**
- Full transparency on fees and escrow
- Investment/ROI language throughout
- Wallet screen is a core navigation item
- Supports both Stripe and crypto
- Community pool bonus rewards for high-achievers
- Achievement unlocked: "ROI Master" (95%+ earn-back rate for 3 months)

**Children's App:**
- Parent pre-funds commitments (like depositing allowance into escrow)
- Child never sees money -- only stars, badges, and rewards
- Parent dashboard shows investment/earn-back metrics
- Forfeiture destination: parent chooses (family savings account is a natural fit)
- Parent can set a weekly "commitment budget" that auto-allocates across tasks
- Stars-to-real-reward conversion is parent-configured

**Agent-First:**
- Agent escrows on behalf of the user with pre-authorized spending limits
- Agent can choose optimal payment method (Stripe for simplicity, crypto for lower fees)
- Agent activity log prominently shows all financial actions
- User sets daily/weekly spending caps that the agent cannot exceed
- Agent can automatically increase stakes if completion rate is high (with user consent)
- Dashboard shows "Agent has invested $15 for you today. 2/4 earned back so far."

---

## 4. Information Architecture

### 4.1 Current Sitemap

```
/                       Home (marketing/landing)
/sign-up                Signup form
/login                  Login form
/reset-password         Password reset
/set-password           Set new password (from email link)
/tasks                  Task dashboard (requires login + payment)
/tasks/new              New task form
/tasks/{slug}           Task detail + time entries
/edit-task?id={id}      Edit task form
/analytics              Analytics + charts
/breaks                 Break management
/my-account             Account + payment + profile
```

**Issues with current IA:**
- Edit task uses query parameter (`?id=`) instead of RESTful URL
- No clear hierarchy -- all pages are flat siblings
- No onboarding flow
- No settings page (account serves double duty)
- Task detail and task edit are separate pages with different URL patterns

### 4.2 Proposed Sitemap: Adult Variant (Vorpal)

```
/                           Landing page (marketing)
/signup                     Streamlined signup (2-3 steps)
/login                      Login
/onboarding                 First-time user guided flow
  /onboarding/welcome       Welcome + value prop + payment model explanation
  /onboarding/first-task    Guided task creation (first investment)
  /onboarding/payment       Payment setup (Stripe or crypto, fee explanation)
  /onboarding/forfeiture    Choose where forfeited money goes
/dashboard                  Main dashboard (today's investments + earn-back progress)
/tasks                      All tasks list/grid
  /tasks/new                New task wizard (invest step charges immediately)
  /tasks/{slug}             Task detail (with escrow status + refund history)
  /tasks/{slug}/edit        Edit task
  /tasks/{slug}/history     Task history/timesheets + financial history
/wallet                     Investment wallet (NEW -- core navigation item)
  /wallet/transactions      Full transaction history (charges, refunds, forfeitures)
  /wallet/methods           Payment methods (Stripe cards, crypto wallets)
  /wallet/forfeiture        Forfeiture destination settings
/analytics                  Analytics hub
  /analytics/overview       Metrics summary (reframed: invested vs earned back)
  /analytics/charts         Custom charts (new: ROI chart, earn-back rate chart)
  /analytics/insights       AI-generated insights (future)
/profile                    User profile
  /profile/achievements     Badges and achievements
  /profile/streaks          Streak history
/settings                   Settings hub
  /settings/breaks          Break management
  /settings/notifications   Notification preferences
  /settings/account         Email, password, timezone
```

### 4.3 Proposed Sitemap: Children's App

```
/                           Child home ("Today's Missions")
/stars                      Star collection + badges
/character                  Character customization
/history                    Simple weekly calendar view

Parent section (gated):
/parent                     Parent dashboard (with investment/earn-back metrics)
  /parent/tasks             Manage child's tasks (set escrow per task)
  /parent/rewards           Configure star-to-reward mapping
  /parent/fund              Commitment fund (pre-fund weekly budget, view earn-back)
  /parent/schedule          Set schedule/breaks
  /parent/settings          Account, payment methods, child profiles, forfeiture dest.
```

### 4.4 Proposed Sitemap: Agent-First

```
/                           Landing page (agent-focused)
/connect                    OAuth signup + agent connection + payment setup
/dashboard                  Status dashboard (read-heavy, shows escrow status)
  /dashboard/log            Agent activity log (including financial actions)
  /dashboard/finances       Agent spending summary (escrowed, refunded, forfeited)
/tasks                      Commitment list
  /tasks/{id}               Task detail with verification + escrow history
/analytics                  Analytics (same as adult, lighter, with ROI metrics)
/settings                   Settings
  /settings/agent           Agent config, API keys, permissions, spending limits
  /settings/integrations    Connected services (Strava, Docs, etc.)
  /settings/payment         Payment methods (Stripe + crypto)
  /settings/forfeiture      Where forfeited money goes
  /settings/account         Account details
```

### 4.5 Navigation Structure Changes

**Current:** Flat navigation managed by Craft CMS menu system ("main-navigation"). No sidebar, no breadcrumbs.

**Proposed (Adult):**
- **Top bar:** Logo, streak indicator, wallet balance ("$31 invested today"), notification bell, profile avatar
- **Sidebar (desktop) / Bottom tab bar (mobile):** Dashboard, Wallet, Analytics, Settings
- **Breadcrumbs:** On detail pages (Dashboard > Tasks > "Morning Run")

**Proposed (Children):**
- **Bottom tab bar only:** Home, Stars, Me (3 tabs)
- No top navigation. Mascot is always visible in top area.

**Proposed (Agent-First):**
- **Top bar:** Logo, agent status indicator, settings gear
- **Minimal sidebar:** Dashboard, Tasks, Analytics, Settings
- Emphasis on the dashboard as the primary view

---

## 5. Priority Screen Redesigns

### 5.1 Ranked Priority List

| Rank | Screen | Severity | Impact | Effort |
|------|--------|----------|--------|--------|
| 1 | Task Creation Wizard (investment flow) | CRITICAL | Blocks activation; must handle upfront charge | HIGH |
| 2 | Onboarding Flow (new) | CRITICAL | Does not exist; must explain invest/earn-back model | HIGH |
| 3 | Task Dashboard (escrow view) | HIGH | Daily usage; must show invested/earned-back amounts | MEDIUM |
| 4 | Wallet / Investment History (NEW) | HIGH | Does not exist; required by new payment model | HIGH |
| 5 | Signup (with payment method) | HIGH | First impression; payment method selection | MEDIUM |
| 6 | Task Detail (with escrow status) | MEDIUM | Engagement; show refund history per task | MEDIUM |
| 7 | Analytics (ROI framing) | MEDIUM | Retention; reframe money metrics | MEDIUM |
| 8 | Account/Settings | LOW | Utility | LOW |
| 9 | Breaks (escrow interaction) | LOW | Utility; must handle mid-day escrow refunds | LOW |

### 5.2 Top 5 Screen Redesigns

#### Screen 1: Task Creation Wizard (replaces current form)

**Before:**
```
+-------------------------------------+
| < Back                              |
| Create New Task                     |
|                                     |
| Name: [________________________]    |
| Start date: [__________]           |
| Deadline: [__________]             |
| $ committed: [______]              |
| (o) More  ( ) Less                 |
| [x] Time based task                |
| Work block length: [____] min      |
| [x] Recurring task                 |
| Repeat every [__] weeks            |
| Mon Tue Wed Thu Fri Sat Sun        |
| [1] [1] [1] [1] [1] [1] [1]      |
| Background color: [#]              |
| [Submit]                            |
+-------------------------------------+
```

**After (4-step wizard):**
```
STEP 1 OF 4: WHAT
+-------------------------------------+
|  What do you want to commit to?     |
|                                     |
|  [________________________]         |
|  e.g., "Exercise", "Study",        |
|  "Write", "No social media"        |
|                                     |
|  Quick templates:                   |
|  [Daily Exercise]  [Study Habit]    |
|  [Writing Goal]    [Screen Limit]   |
|  [Custom]                           |
|                                     |
|              [Next ->]              |
+-------------------------------------+

STEP 2 OF 4: WHEN
+-------------------------------------+
|  Step: [1] [2] [3] [4]             |
|                                     |
|  How often?                         |
|  (o) Every day                      |
|  ( ) Weekdays only                  |
|  ( ) Custom schedule                |
|                                     |
|  How long each day?                 |
|  (o) Timed: [30] minutes           |
|  ( ) Just check it off             |
|                                     |
|  Deadline: [11:59 PM]              |
|  "Complete by this time each day"   |
|                                     |
|     [<- Back]      [Next ->]        |
+-------------------------------------+

STEP 3 OF 4: INVEST
+-------------------------------------+
|  Step: [1] [2] [3] [4]             |
|                                     |
|  How much will you invest in        |
|  yourself each day?                 |
|                                     |
|  You'll be charged NOW for each     |
|  day's commitment. Complete it,     |
|  get it all back. Miss it, and      |
|  the money is gone.                 |
|                                     |
|  [$1]  [$5]  [$10]  [$___]         |
|                                     |
|  "Most users invest $5/day.         |
|   Enough to notice, not enough      |
|   to stress."                       |
|                                     |
|  Payment method:                    |
|  (o) Card ending 4242 (via escrow)  |
|  ( ) Crypto wallet (direct escrow)  |
|                                     |
|     [<- Back]      [Next ->]        |
+-------------------------------------+

STEP 4 OF 4: CONFIRM & PAY
+-------------------------------------+
|  Step: [1] [2] [3] [4]             |
|                                     |
|  YOUR COMMITMENT CONTRACT            |
|  ---------------------------------  |
|  I will: Exercise                   |
|  For: 30 minutes                    |
|  Schedule: Every day                |
|  Starting: February 20, 2026       |
|  Deadline: 11:59 PM daily          |
|  Daily investment: $5.00            |
|  ---------------------------------  |
|                                     |
|  You will be charged $5.00 NOW     |
|  for tomorrow's commitment.         |
|  Complete it -> get $5.00 back.     |
|  Miss it -> $5.00 forfeited.        |
|                                     |
|  Via card (escrow): Full $5.00      |
|  refundable on completion.          |
|                                     |
|  [x] I understand I'm being         |
|      charged right now              |
|                                     |
|     [<- Back]   [INVEST $5 ->]     |
+-------------------------------------+
```

#### Screen 2: Onboarding Flow (new)

```
WELCOME (after signup)
+-------------------------------------+
|                                     |
|  Welcome to MAST.                   |
|                                     |
|  MAST is a commitment device.       |
|  Here's how it works:               |
|                                     |
|  1. Pick a habit                    |
|  2. Invest real money               |
|  3. Complete it -> money back       |
|  4. Miss it -> money gone           |
|                                     |
|  You're investing in your future    |
|  self. The money is yours to earn   |
|  back every single day.             |
|                                     |
|  [Create Your First Investment]     |
|                                     |
+-------------------------------------+

FIRST TASK (guided wizard with tooltips)
+-------------------------------------+
|                                     |
|  "Let's start with something        |
|   small. Pick a habit you want      |
|   to invest in:"                    |
|                                     |
|  [Exercise]    [Reading]            |
|  [Writing]     [Meditation]         |
|  [Something else: ___________]      |
|                                     |
+-------------------------------------+

PAYMENT (context-appropriate)
+-------------------------------------+
|                                     |
|  To invest in yourself, we need     |
|  a way to hold your commitment.     |
|                                     |
|  [Card / Apple Pay / Google Pay]    |
|  Full refund on completion.         |
|  Your money is held in a secure     |
|  escrow until you earn it back.     |
|  No processing fees deducted.       |
|                                     |
|  ------- or -------                 |
|                                     |
|  [Connect Crypto Wallet]            |
|  Direct smart contract escrow.      |
|  For users who prefer to hold       |
|  their own keys.                    |
|                                     |
|  Where should forfeited money go?   |
|  ( ) Charity (choose one)           |
|  ( ) Platform (supports MAST)       |
|  ( ) Burn / lock forever            |
|                                     |
+-------------------------------------+
```

#### Screen 3: Task Dashboard Redesign

**Before:**
```
+-----------------------------------------------------+
| Tasks                    [pause][hide][trash][+]     |
+-----------------------------------------------------+
| +----------+ +----------+ +----------+ +----------+ |
| | Title    | | Title    | | Title    | | Title    | |
| | More >10m| | One off  | | More >30m| | One off  | |
| | [===  ]  | |          | | [======] | |          | |
| | Start $5 | | Done  $1 | | Stop  $10| | Done  $3 | |
| +----------+ +----------+ +----------+ +----------+ |
+-----------------------------------------------------+
```

**After:**
```
+-----------------------------------------------------+
| Good morning, Alex.          Streak: 17 days [fire] |
+-----------------------------------------------------+
| TODAY'S INVESTMENTS             $31 escrowed          |
| Earned back: $5 / $31          Feb 20                |
|                                                      |
| [Filter: All | Active | Complete | At Risk]         |
|                                                      |
| +----------+ +----------+ +----------+ +----------+ |
| | Exercise | | Write    | | Read     | | No Phone | |
| | 30 min   | | 1000 wrd | | 30 min   | | Check-in | |
| | [=====  ]| | [==     ]| | [       ]| |  [ ]     | |
| | 18:32    | | 12:04    | | --:--    | |  --:--   | |
| | remaining| | elapsed  | | not      | | not      | |
| |          | |          | | started  | | started  | |
| | [STOP]   | | [START]  | | [START]  | | [DONE]   | |
| |$5 invest | |$10 invest| | $5 invest| | $3 invest| |
| | ACTIVE   | | ACTIVE   | | PENDING  | | PENDING  | |
| +----------+ +----------+ +----------+ +----------+ |
|                                                      |
| COMPLETED TODAY                                      |
| +----------+                                         |
| | Meditate | $3 EARNED BACK [checkmark]             |
| +----------+                                         |
|                                                      |
| [+ New Investment]                                   |
+-----------------------------------------------------+
| [Dashboard]  [Wallet]  [Analytics]  [Settings]       |
+-----------------------------------------------------+
```

**Key changes:**
- Personalized greeting with streak display
- Total daily escrow visible ("$31 escrowed") with earn-back progress
- Filter bar for task states
- Each card shows: elapsed/remaining time, invested amount, clear status label
- Completed tasks move to a separate "earned back" section with satisfying visual
- Explicit "New Investment" button (not just a + icon)
- Bottom navigation bar includes "Wallet" (replaces "Tasks" as the second tab)

#### Screen 4: Signup Redesign

**Before:**
```
+-----------------------------------+
| First name: [____________]        |
| Last name:  [____________]        |
| Username:   [____________]        |
| Password:   [____________]        |
| Timezone:   [long dropdown v]     |
| [Register]                        |
| Already have an account? Login    |
+-----------------------------------+
```

**After:**
```
+-----------------------------------+
|                                   |
|  MAST                             |
|  Commit with real stakes.         |
|                                   |
|  [Continue with Google]           |
|  [Continue with Apple]            |
|                                   |
|  -------- or --------            |
|                                   |
|  Email: [________________]        |
|  Password: [_____________]        |
|                                   |
|  [Create Account]                 |
|                                   |
|  Already have an account? Login   |
|                                   |
+-----------------------------------+
```

**Key changes:**
- Social login as primary (reduces fields to zero)
- Email/password as secondary (just 2 fields)
- Name collected later (onboarding or profile)
- Timezone auto-detected from browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Value proposition visible ("Commit with real stakes")

#### Screen 5: Task Detail Redesign

**Before:**
```
+-----------------------------------+
| < Back                            |
| Morning Exercise                  |
| Starting date: 02/20/2026        |
| Deadline: 23:59                   |
| Type: More                        |
| Length: 30min                     |
| Committed: $5.00                  |
| Recurring: Yes                    |
| Paused: No                        |
| [Edit] [Copy]                     |
| Time entries:                     |
| 09:00 - 09:32  |  32min  | [x]   |
+-----------------------------------+
```

**After:**
```
+---------------------------------------------+
| < Dashboard     Morning Exercise     [Edit]  |
+---------------------------------------------+
|                                              |
|  TODAY                         Status: ACTIVE |
|  [==================-------]  18:32 / 30:00  |
|  [  STOP TIMER  ]                            |
|  $5.00 invested -- complete to earn it back  |
|                                              |
|  THIS WEEK                                   |
|  Mon[$R] Tue[$R] Wed[$R] Thu[$.] Fri[ ] Sat  |
|  ($R = invested & refunded, $. = invested)   |
|                                              |
|  STATS                                       |
|  Streak: 17 days    Avg: 28 min/day         |
|  Total time: 8h 24m                          |
|  Invested: $185    Earned back: $175 (95%)   |
|  Forfeited: $10 (2 misses)                   |
|  Completion rate: 89%                        |
|                                              |
|  SCHEDULE                                    |
|  Every day, 30 minutes, by 11:59 PM         |
|  $5.00 invested per day                      |
|                                              |
|  TIME ENTRIES                                |
|  Today    09:00-09:18 (18 min)              |
|  Today    14:00-14:14 (14 min)              |
|  Yesterday 08:30-09:02 (32 min)  [$5 back]  |
|  [View all entries]                          |
|                                              |
|  [Copy Task]  [Archive]                      |
+---------------------------------------------+
```

**Key changes:**
- Today's progress is front and center with live timer
- Invested amount shown with earn-back prompt ("complete to earn it back")
- Weekly calendar strip shows investment/refund status per day
- Aggregated stats reframed: invested vs earned back vs forfeited (positive framing)
- Schedule summary in plain language with daily investment amount
- Recent time entries with refund confirmation per day
- Edit button in header, destructive actions at bottom

---

## 6. Design System

### 6.1 Shared Design Tokens Across Variants

All three variants (Adult, Children, Agent) should share a common design token architecture, with variant-specific values.

```scss
// Shared token structure (variant values differ)
:root {
  // Spacing scale (shared across all variants)
  --space-1: 0.25rem;   // 4px
  --space-2: 0.5rem;    // 8px
  --space-3: 0.75rem;   // 12px
  --space-4: 1rem;      // 16px
  --space-5: 1.5rem;    // 24px
  --space-6: 2rem;      // 32px
  --space-7: 3rem;      // 48px
  --space-8: 4rem;      // 64px

  // Border radius (variant-specific)
  --radius-sm: 4px;     // Adult: 4px, Children: 12px, Agent: 2px
  --radius-md: 8px;     // Adult: 8px, Children: 16px, Agent: 4px
  --radius-lg: 12px;    // Adult: 12px, Children: 24px, Agent: 8px
  --radius-full: 9999px;

  // Shadows (variant-specific)
  --shadow-sm: ...;
  --shadow-md: ...;
  --shadow-lg: ...;

  // Transitions (shared)
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;

  // Z-index scale (shared)
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;

  // Typography scale (variant-specific values)
  --font-family-body: ...;
  --font-family-heading: ...;
  --font-family-mono: ...;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-size-4xl: 2.5rem;

  // Status colors (shared semantics, variant-specific values)
  --color-status-active: ...;
  --color-status-complete: ...;
  --color-status-derailed: ...;
  --color-status-paused: ...;
  --color-status-inactive: ...;

  // Financial status colors (new -- for payment model)
  --color-money-escrowed: ...;     // Blue/neutral -- money is held
  --color-money-refunded: ...;     // Green -- money earned back
  --color-money-forfeited: ...;    // Red/gray -- money lost
  --color-money-processing: ...;   // Yellow/amber -- transaction in progress
  --color-money-fee: ...;          // Muted gray -- processing fees
}
```

### 6.2 Component Library Approach

**Recommended approach:** Build a shared component library using Vue 3 composables and headless components, with variant-specific styling layers.

**Component tiers:**

| Tier | Examples | Sharing |
|------|----------|---------|
| Primitives | Button, Input, Select, Card, Modal, Badge, Toast | Shared structure, variant-styled |
| Patterns | TaskCard, ProgressBar, TimerControl, StreakIndicator, EscrowBadge, RefundAnimation, WalletBalance | Shared logic, variant views |
| Features | Dashboard, TaskWizard, Analytics, Settings | Variant-specific compositions |

**Implementation:**
```
components/
  primitives/           # Headless or minimally styled
    BaseButton.vue
    BaseInput.vue
    BaseCard.vue
    BaseModal.vue
  patterns/
    TaskCard/
      TaskCard.vue      # Logic + slot structure
      TaskCardAdult.vue # Adult styling/layout
      TaskCardChild.vue # Children styling/layout
      TaskCardAgent.vue # Agent styling/layout
    ProgressIndicator/
      ProgressBar.vue   # Adult: bar
      ProgressJar.vue   # Children: filling jar
      ProgressText.vue  # Agent: percentage text
    EscrowStatus/
      EscrowBadge.vue   # Shows escrowed/refunded/forfeited per task
      WalletBalance.vue # Running balance display (all variants)
      RefundToast.vue   # "$X earned back!" notification
      ForfeitNotice.vue # Forfeiture acknowledgment
  features/
    adult/
      AdultDashboard.vue
      AdultTaskWizard.vue
    children/
      ChildHome.vue
      ChildMissions.vue
    agent/
      AgentDashboard.vue
      AgentStatus.vue
```

### 6.3 Dark Mode Considerations

**Adult variant:** Dark mode should be the *default*, with light mode as an option. The obsidian/crimson palette is designed dark-first.

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | `#ffffff` | `#1a1a2e` |
| Surface | `#f8f9fa` | `#16213e` |
| Text primary | `#1a1a2e` | `#e8e8e8` |
| Text secondary | `#6c757d` | `#8d99ae` |
| Border | `#dee2e6` | `#2a2a4a` |
| Accent | `#e63946` | `#e63946` (same) |

**Children's variant:** Light mode only. Dark mode is not appropriate for the target age group and complicates the bright, friendly palette.

**Agent variant:** Follow system preference. Minimal styling makes both modes straightforward.

### 6.4 Accessibility Improvements

**Current issues:**
- Color-only status indicators (border colors) fail WCAG 2.1 for users with color vision deficiency
- No ARIA labels on icon-only buttons (header controls)
- No skip-to-content link
- No focus indicators beyond browser defaults
- Form error messages use color alone (red `is-invalid` class)
- Timer start/stop actions are text-only with no button role or keyboard accessibility
- Contrast ratio of `$light` (`#6c757d`) on white background is only 4.6:1, just barely meeting AA for normal text

**Required improvements:**
1. Add text labels or `aria-label` to all icon-only controls
2. Add status text badges alongside colored borders on task cards
3. Add visible focus rings (`:focus-visible` with 2px offset outline)
4. Add skip-to-content link
5. Add `role="button"` and keyboard handlers (`Enter`/`Space`) to the Start/Stop/Done click targets
6. Add `aria-live="polite"` to progress bar and countdown regions for screen reader updates
7. Ensure all interactive elements have minimum 44x44px touch targets (WCAG 2.5.5)
8. Add form error announcements via `aria-describedby` linking inputs to error messages
9. Ensure color contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text) across all color combinations
10. Add `prefers-reduced-motion` media query support to disable animations

### 6.5 Animation & Micro-Interaction Opportunities

**Adult variant (subtle, purposeful):**
| Trigger | Animation | Purpose |
|---------|-----------|---------|
| Investment confirmed | Currency symbol scales up briefly + card border solidifies | Commitment weight |
| Timer start | Pulse ring on card border | Confirm action |
| Timer stop | Border solidifies from dashed | Confirm action |
| Task complete + refund | Green flash + "$5 earned back" floats up + wallet balance counter increments | Reward dopamine |
| All tasks done + full refund | Confetti burst + "$31 earned back!" prominent overlay (1.5s) + blade strike | Daily win |
| Forfeit (deadline passed) | Card dims + amount fades to gray + brief shake | Consequence, not punishment |
| Streak milestone | Badge unlock animation | Achievement |
| Card drag | Lift shadow + slight scale | Affordance |
| Page transition | Slide or fade (200ms) | Continuity |
| Wallet balance update | Number count-up animation on balance | Satisfaction |

**Children's variant (expressive, rewarding):**
| Trigger | Animation | Purpose |
|---------|-----------|---------|
| Mission accepted | Mascot gives thumbs up + "Let's go!" speech bubble | Engagement |
| Task complete | Stars burst from card + mascot celebration | Joy |
| Star earned | Star flies into jar with bounce + jar sparkles | Accumulation |
| All tasks done | Full-screen celebration with mascot dance + "ALL MISSIONS COMPLETE!" | Daily win |
| Badge unlock | Badge spins in, sparkle effect | Achievement |
| Mission start | Mascot gives encouragement speech bubble | Guidance |
| Streak milestone | Character evolution animation | Progression |
| Mission missed | Mascot looks sad briefly, then encouraging: "Try again tomorrow!" | Gentle consequence |

**Agent variant (minimal, informational):**
| Trigger | Animation | Purpose |
|---------|-----------|---------|
| Agent escrows funds | Brief "$X invested" notification slide-in | Awareness of spend |
| Agent action | Subtle pulse on agent status indicator | Awareness |
| Verification complete + refund | Check mark fade-in + "$X refunded" in green | Confirmation + reward |
| Dashboard data update | Number count-up animation on balances | Data freshness |
| Connection status change | Smooth color transition on indicator | Status awareness |
| Spending limit approached | Yellow pulse on spending indicator | Caution |

---

## Appendix A: Competitive Analysis Summary

### Beeminder
- **Strengths:** Quantified Self integration, detailed graphs with "Bright Red Line," automatic data syncing from many services
- **Weaknesses:** Complex interface, graph-heavy approach overwhelming for casual users, steep learning curve
- **Takeaway for MAST:** Integrate data sources (like Beeminder) but present data more simply. The "road" metaphor is powerful but needs better visualization.

### StickK
- **Strengths:** Referee system (accountability partners), journal entries, social support, behavioral economics foundation (Yale researchers)
- **Weaknesses:** Navigation issues, app crashes, complex commitment creation flow
- **Takeaway for MAST:** The referee/social accountability layer is valuable. MAST could add optional "accountability partners" who can view your progress. Avoid StickK's navigation confusion.

### Habitica
- **Strengths:** Deep gamification (RPG mechanics), social quests, character progression, multiple task types (habits, dailies, to-dos), effective with younger users
- **Weaknesses:** Overwhelming for non-gamers, game mechanics can distract from actual habit formation, requires daily maintenance of the game itself
- **Takeaway for MAST:** Gamification drives engagement but must serve the core purpose. MAST's gamification should enhance commitment, not replace it. Streaks and achievements are the sweet spot -- RPG mechanics would be overkill for the adult variant but could work for children.

### Forfeit
- **Strengths:** Photo/video proof of completion, simple interface, strong commitment mechanism
- **Weaknesses:** Limited to photo-verifiable goals, no analytics
- **Takeaway for MAST:** Verification mechanisms beyond self-reporting increase accountability. The agent-first variant should incorporate automated verification.

## Appendix B: Research References

- Beeminder UX patterns and "Bright Red Line" goal tracking: [Beeminder Overview](https://www.beeminder.com/overview)
- StickK commitment contract design and referee system: [StickK Tour](https://www.stickk.com/tour)
- Habitica gamification case study and RPG task mechanics: [Habitica Gamification Strategy (Trophy)](https://trophy.so/blog/habitica-gamification-case-study)
- Gamification design challenge analysis: [Gamification Design Challenge for Habitica (Medium)](https://sduquee.medium.com/gamification-design-challenge-for-habitica-f5b071a8ee8e)
- UX design for children principles (motor skills, age groups, safety): [Smashing Magazine Guide](https://www.smashingmagazine.com/2024/02/practical-guide-design-children/)
- Child-friendly interface guidelines (button sizes, navigation): [AufaitUX Design Tips](https://www.aufaitux.com/blog/ui-ux-designing-for-children/)
- UX design for kids (mascots, age-appropriate visual language): [Gapsy Studio Guide](https://gapsystudio.com/blog/ux-design-for-kids/)
- Gamification streaks and milestones data (40-60% higher DAU): [Plotline Streaks Guide](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps)
- Gamification in product design 2025: [Arounda Agency](https://arounda.agency/blog/gamification-in-product-design-in-2024-ui-ux)
- Productivity app gamification examples: [Trophy Productivity Examples](https://trophy.so/blog/productivity-gamification-examples)
