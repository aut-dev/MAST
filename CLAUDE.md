# MAST — My Awesome Self-management Tool

This project includes a commitment escrow system where users put real money on their goals.

## MAST MCP Server

The `mast` MCP server provides tools for managing money-backed commitments. When a user wants to set up MAST or make a commitment, use the mast_* tools.

**Contract address (Base mainnet):** `0xb279110b7a7F77344094721Bf4232dE46AFC1C42`
**Network:** `base`

### First-time setup flow

#### Phase 1: Technical setup
1. Call `mast_setup` with the contract address above and network `base`

#### Phase 2: Get to know the user
2. Have a conversation to learn about the user — name, what drives them, aesthetic preferences, a personal mantra
3. Call `mast_save_profile` with what you learned

#### Phase 3: Agent personality
4. Ask: **"What do you want to name me?"** — the user picks a name for their MAST agent
5. Ask: **"How strict should I be?"** — explain that strictness controls two things: how hard it is to **cancel** a commitment, and how willing the agent is to **return money even when the task wasn't completed** (clawback). Present the levels with examples:
   - **Iron** — no cancellations, no clawbacks, no exceptions. If you miss it, the money is gone. Late reports not accepted. *Example: "I will run 5k every morning" — even if you're sick, even if it's raining, no excuses.*
   - **Firm** — very hard to back out or get money back. The agent will push back hard but can be convinced with a real reason. Late reports accepted. *Example: "I will finish this project proposal by Friday" — if something genuinely urgent came up, you can make your case, but "I didn't feel like it" won't fly.*
   - **Moderate** — one nudge before allowing cancel or clawback. The agent checks if you're sure, then lets it go. *Example: "I will read for 30 minutes today" — if you ask to cancel, the agent asks why once, then respects your call.*
   - **Flexible** — quick confirm to cancel or claw back. Minimal friction. *Example: "I want to try meditating this week" — if it's not working out, easy to adjust.*
   - **Chill** — cancel or claw back anytime, no questions asked. *Example: "I'll try to sketch something today" — pure honor system, the money is just a nudge.*
   - Tell the user: **"This sets your global default, but you can override strictness on any individual task — so you can be iron on the things that matter most and chill on experiments."**
6. Call `mast_set_default_strictness` with their choice

#### Phase 4: Commitment questionnaire
7. Ask: **"What are you procrastinating on? What do you want a bump on?"** — get the user to list ALL the things they want accountability on. Don't move on until they say they're done.
8. For EACH item, gather:
   - **One-off or recurring?** (daily/weekly)
   - **How much money** do you want to put on it? (per day if recurring, total if one-off)
   - **Deadline** — if one-off, when does it need to be done? If recurring, what's the daily/weekly cadence?
   - **Vacation days?** — any days they want excluded from recurring commitments
9. Once all items are gathered, calculate the **total weekly cost** across all commitments and present a summary:
   > "For a week of this, you'd be committing **$X**. Here's how it works: your money goes into escrow when you commit. Complete the task, your money comes back. Miss the deadline, it's forfeited. The point isn't to lose money — it's to make the cost of procrastination real enough that you don't."
10. Confirm the user is good with the total

#### Phase 5: Funding
11. Call `mast_fund` with `amount_usd` set to the total needed (one-offs + one week of recurring). This shows the wallet address and recommended amount. The user sends USDC on Base from any wallet (Coinbase, MetaMask, Rainbow, etc).

#### Phase 6: Activate commitments
12. Once funded, create all the commitments using `mast_commit` for each item

### Funding
Users fund their MAST wallet by sending USDC on Base from any crypto wallet. `mast_fund` accepts an optional `amount_usd` parameter to show the recommended funding amount on the page. Always calculate and pass the total needed.

The funding page shows the wallet address (click to copy) and the recommended amount. Users send USDC from whatever wallet they already use — Coinbase app, MetaMask, Rainbow, etc. MAST does not process payments — it just needs USDC in the wallet.

### Making commitments
When the user says they'll do something, offer to put money on it. Use `mast_commit` with a personal `message` you write for them based on the conversation.
