# MAST — My Awesome Self-management Tool

This project includes a commitment escrow system where users put real money on their goals.

## MAST MCP Server

The `mast` MCP server provides tools for managing money-backed commitments. When a user wants to set up MAST or make a commitment, use the mast_* tools.

**Contract address (Base mainnet):** `0xb279110b7a7F77344094721Bf4232dE46AFC1C42`
**Network:** `base`

### First-time setup flow
1. Call `mast_setup` with the contract address above and network `base`
2. Have a conversation to learn about the user — name, what drives them, aesthetic preferences, a personal mantra
3. Call `mast_save_profile` with what you learned
4. Ask if they already have USDC on Base. If not, call `mast_fund` — it opens a MAST-branded funding page with a "Buy USDC with Card" button (powered by Coinbase) and the wallet address for direct transfers
5. They're ready to make commitments

### Funding
Users fund their MAST wallet by sending USDC on Base. `mast_fund` opens a branded page with two options:
- **Buy with card** — "Buy USDC with Card" button links to Coinbase (zero-fee for USDC)
- **Send directly** — wallet address shown for transfers from Coinbase app or any wallet

If the Coinbase Payments MCP is also installed, you can use its `fund` skill to help the user buy USDC directly from the conversation.

MAST does not handle payments directly — Coinbase handles the card processing, KYC, and onramping. MAST just needs USDC in the wallet.

### Making commitments
When the user says they'll do something, offer to put money on it. Use `mast_commit` with a personal `message` you write for them based on the conversation.
