---
name: mast-frontend
description: Serve the MAST web dashboard — a live, profile-styled page with today's commitments, progress bars, balances, and deadlines. Use when the user asks for the frontend, dashboard, or a visual view of their commitments.
---

Start the dashboard server (if not already running) and open it:

1. Check if it's already up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:7777/`
2. If not `200`, start it as a background task (use run_in_background, NOT a foreground call — the server does not exit):
   ```bash
   node /Users/gaga/MAST/mast-mcp/server.js 7777
   ```
3. Open it in the browser: `open http://localhost:7777` (on the local machine)
4. Tell the user the URL, the secret token (from `~/.mast/frontend-token`), and that the page live-updates every 5 seconds (running timers pulse ▶, completed targets get ✓).

**Public access:** The server binds to 0.0.0.0 by default, meaning any computer can reach it at `http://<your-machine-ip>:7777?token=<secret>`. The token is persistent and auto-generated on first run; regenerate with `node /Users/gaga/MAST/mast-mcp/server.js --new-token`. Pass `--local-only` to bind 127.0.0.1 instead (bypasses token check from localhost only).

The server is read-only (never touches the private key), styles itself from `~/.mast/profile.json`, and reads live data from `~/.mast/commitments.json` and `~/.mast/timelog.jsonl` plus cached on-chain balances. Useful for accountability pod members to watch your progress in real time.

If port 7777 is taken by something that is NOT the MAST dashboard, pick another port (e.g. 7778), pass it as the argument, and open that instead. Set `MAST_PUBLIC_PORT` env var to change the default.
