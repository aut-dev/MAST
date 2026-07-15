---
name: mast-status
description: Print the full MAST status board — balances, today's commitments vs the time log, and lifetime settlement history. Use when the user asks "status", "how am I doing", "what's on the line", or similar.
---

Run the status script and present its output:

```bash
node /Users/gaga/MAST/mast-mcp/status.js
```

The script is read-only and prints: on-chain balances (wallet / escrow available / locked / platform forfeits), today's commitments with progress bars from `~/.mast/timelog.jsonl`, hours until each deadline, and lifetime returned/forfeited totals.

Present the output faithfully — either verbatim in a code block or reformatted as a table, whichever reads better in context. Add at most 1-2 sentences of interpretation: what is at risk right now, what the user should start next, and how tight the runway to midnight is. If any timer is running (`▶`), mention it. Do not editorialize beyond that.

If the script errors on RPC issues, retry once; if it still fails, fall back to `mast_commitments` and `mast_balance` MCP tools plus `node /Users/gaga/MAST/mast-timer/timer.js today`.
