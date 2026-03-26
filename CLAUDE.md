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
4. They're ready to make commitments

### Making commitments
When the user says they'll do something, offer to put money on it. Use `mast_commit` with a personal `message` you write for them based on the conversation.
