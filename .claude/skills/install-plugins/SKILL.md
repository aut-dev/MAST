---
name: install-plugins
description: Install all Claude Code plugins listed in plugins.txt. Run this when setting up a new environment or after cloning the repo.
allowed-tools:
  - Read
  - Bash(claude plugin marketplace add)
  - Bash(ls:*)
  - Bash(npm install)
  - Bash(npm run build)
  - Bash(nvm:*)
  - Bash(node --version)
  - Bash(go build:*)
  - Bash(go version)
  - Bash(make install:*)
  - Bash(make build:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(ln:*)
  - Bash(codesign:*)
  - Bash(which:*)
  - Glob
---

# Install Plugins

Install all Claude Code plugins required for this project from plugins.txt.

## Instructions

1. Read the `plugins.txt` file from the repository root.

2. For each line that is NOT empty and does NOT start with `#`:
   - Extract the plugin name (ignore inline comments after `#`)
   - Run: `claude plugin marketplace add <plugin>`
   - Report success or failure for each plugin

3. **Post-install: Build and install `bd` CLI** (if beads was installed):
   - Check if `bd` is already on PATH: `which bd`
   - If NOT, build and install from the beads marketplace source:
     a. Find the beads source: `~/.claude/plugins/marketplaces/beads-marketplace/`
     b. Check if Go is available: `go version` (also try `/usr/local/go/bin/go version`)
     c. If Go is missing, tell the user:
        ```
        Beads CLI (bd) requires Go but it's not installed.
        Install Go first, then run in the beads directory:
          make install
        ```
     d. If Go is available, build and install:
        ```bash
        cd ~/.claude/plugins/marketplaces/beads-marketplace
        SKIP_UPDATE_CHECK=1 make install
        ```
        This builds the `bd` binary and installs it to `~/.local/bin/bd` with a `beads` symlink.
     e. Verify installation: `~/.local/bin/bd version`
     f. If `~/.local/bin` is not on PATH, warn the user to add it:
        ```
        Add to your shell profile: export PATH="$HOME/.local/bin:$PATH"
        ```

4. **Post-install: Build Cortex plugin** (if cortex was installed):
   - Check if `~/.claude/plugins/cache/cortex/cortex/*/dist/mcp-server.js` exists
   - If NOT, Cortex needs to be built:
     a. Find the Cortex install path: `~/.claude/plugins/cache/cortex/cortex/<version>/`
     b. Check if Node.js is available: `node --version`
     c. If Node.js is missing, tell the user:
        ```
        Cortex requires Node.js but it's not installed.
        Install Node.js first, then run in the Cortex directory:
          npm install && npm run build
        ```
     d. If Node.js is available, build Cortex:
        ```bash
        cd ~/.claude/plugins/cache/cortex/cortex/<version>
        npm install
        npm run build
        ```
     e. If build fails with "Could not resolve src/index.ts", the source files are missing.
        Re-clone from git:
        ```bash
        rm -rf ~/.claude/plugins/cache/cortex/cortex/<version>
        git clone --depth 1 https://github.com/hjertefolger/cortex ~/.claude/plugins/cache/cortex/cortex/<version>
        cd ~/.claude/plugins/cache/cortex/cortex/<version>
        npm install && npm run build
        ```

5. After all plugins are processed, summarize:
   - How many plugins were installed successfully
   - Any plugins that failed to install
   - Whether `bd` CLI was built and installed successfully
   - Whether Cortex was built successfully
   - **Remind user to restart Claude Code** if any plugins were installed/built

6. **Post-install setup for specific plugins**:
   - **Cortex**: After restarting Claude Code, run `/cortex-setup` to initialize the database and configure preferences (auto-save frequency, statusline, etc.)

## Example

If plugins.txt contains:
```
# Comment
steveyegge/beads
hjertefolger/cortex  # Requires build
```

Run:
```bash
claude plugin marketplace add steveyegge/beads
claude plugin marketplace add hjertefolger/cortex
# Then build cortex if needed
```

## Notes

- Plugins that are already installed will be skipped or updated
- If a plugin fails, continue with the remaining plugins
- Cortex is a TypeScript MCP server that must be compiled before use
- **Cortex requires additional setup**: After install and restart, run `/cortex-setup` to initialize
- Report the final status to the user
