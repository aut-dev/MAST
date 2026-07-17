#!/usr/bin/env node
// mast-timer — start/stop time tracking for MAST commitments.
// Data: ~/.mast/timelog.jsonl, one session per line:
//   {"project":"writing","start":"2026-07-13T19:20:52-0600","stop":null}
// An entry with stop:null is a running timer.

import fs from "fs";
import os from "os";
import path from "path";

const MAST_DIR = path.join(os.homedir(), ".mast");
const LOG_FILE = path.join(MAST_DIR, "timelog.jsonl");
const COMMITMENTS_FILE = path.join(MAST_DIR, "commitments.json");

function loadEntries() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function saveEntries(entries) {
  if (!fs.existsSync(MAST_DIR)) fs.mkdirSync(MAST_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : ""));
}

function tsNow() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}${pad(Math.abs(off) % 60)}`
  );
}

function tsFromDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tsNow().slice(-5)}`;
}

// "--at 19:40" or "--at 7:40pm" → ISO timestamp, LOCAL time. A future
// time resolves to yesterday; anything more than 12h in the past is
// refused unless --force, because it is usually a timezone mistake
// (e.g. an agent passing UTC). Prefer --ago, which cannot go wrong.
function tsAt(spec, force) {
  const m = spec.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!m) die(`Cannot parse time "${spec}" — use HH:MM or H:MMam/pm (LOCAL time), or --ago <minutes>`);
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  if (d > new Date()) d.setDate(d.getDate() - 1); // a future time means yesterday's
  const hoursAgo = (new Date() - d) / 3600000;
  if (hoursAgo > 12 && !force) {
    die(
      `--at ${spec} resolves to ${tsFromDate(d)} — ${hoursAgo.toFixed(1)}h ago.\n` +
      `That is usually a timezone mistake (--at is LOCAL time, now ${tsNow().slice(11, 16)}).\n` +
      `Use --ago <minutes> for relative backdating, or add --force if you really mean it.`
    );
  }
  return tsFromDate(d);
}

// "--ago 5" / "--ago 5m" / "--ago 1.5h" → ISO timestamp that long ago.
// Relative, so timezones cannot bite.
function tsAgo(spec) {
  const m = spec.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)?$/);
  if (!m) die(`Cannot parse duration "${spec}" — use e.g. --ago 5, --ago 45m, --ago 1.5h`);
  const n = parseFloat(m[1]);
  const minutes = (m[2] || "m").startsWith("h") ? n * 60 : n;
  if (minutes > 12 * 60) die(`--ago ${spec} is more than 12 hours — refusing; edit ${LOG_FILE} by hand if you really mean it.`);
  return tsFromDate(new Date(Date.now() - minutes * 60000));
}

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
}

function localDay(ts) {
  return ts.slice(0, 10);
}

function today() {
  return tsNow().slice(0, 10);
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Targets from active commitments: titles like "Writing — 20 minutes"
function loadTargets() {
  if (!fs.existsSync(COMMITMENTS_FILE)) return {};
  const commits = JSON.parse(fs.readFileSync(COMMITMENTS_FILE, "utf-8"));
  const targets = {};
  for (const c of Object.values(commits)) {
    if (c.status !== "active") continue;
    const m = c.title.match(/^(.+?)\s*—\s*(\d+)\s*min/i);
    if (m) targets[m[1].trim().toLowerCase()] = parseInt(m[2], 10);
  }
  return targets;
}

function openEntry(entries, project) {
  return entries.find((e) => e.project === project && e.stop === null);
}

const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes("--force");
const atIdx = rest.indexOf("--at");
const agoIdx = rest.indexOf("--ago");
if (atIdx >= 0 && agoIdx >= 0) die("Use --at or --ago, not both.");
const at = atIdx >= 0 ? tsAt(rest[atIdx + 1] || "", force)
  : agoIdx >= 0 ? tsAgo(rest[agoIdx + 1] || "")
  : null;
const flagIdx = Math.max(atIdx, agoIdx);
const project = rest
  .filter((_, i) => flagIdx < 0 || (i !== flagIdx && i !== flagIdx + 1))
  .filter((a) => a !== "--force")
  .join(" ").trim().toLowerCase();

const entries = loadEntries();

switch (cmd) {
  case "start": {
    if (!project) die("Usage: timer start <project> [--at HH:MM]");
    const open = openEntry(entries, project);
    if (open) die(`"${project}" already running since ${open.start}. Stop it first.`);
    const start = at || tsNow();
    entries.push({ project, start, stop: null });
    saveEntries(entries);
    const minsAgo = minutesBetween(start, tsNow());
    console.log(`Started "${project}" at ${start.slice(0, 16).replace("T", " ")}${minsAgo >= 1 ? ` (${minsAgo.toFixed(0)} min ago)` : ""}`);
    break;
  }

  case "stop": {
    if (!project) die("Usage: timer stop <project> [--at HH:MM]");
    const open = openEntry(entries, project);
    if (!open) die(`No running timer for "${project}".`);
    open.stop = at || tsNow();
    const mins = minutesBetween(open.start, open.stop);
    if (mins < 0) die(`Stop time is before start time (${open.start}) — not saved.`);
    saveEntries(entries);
    console.log(`Stopped "${project}" — ${mins.toFixed(1)} min this session.`);
    if (mins > 8 * 60) {
      console.log(`⚠ That is ${(mins / 60).toFixed(1)} hours — forgotten timer? Session started ${open.start.slice(0, 16).replace("T", " ")}. Edit ${LOG_FILE} if wrong.`);
    }
    break;
  }

  case "status": {
    const open = entries.filter((e) => e.stop === null);
    if (!open.length) {
      console.log("No running timers.");
    } else {
      for (const e of open) {
        console.log(`"${e.project}" running — ${minutesBetween(e.start, tsNow()).toFixed(1)} min (since ${e.start.slice(11, 16)})`);
      }
    }
    break;
  }

  case "today": {
    const targets = loadTargets();
    const totals = {};
    for (const e of entries) {
      if (localDay(e.start) !== today()) continue;
      const stop = e.stop || tsNow();
      totals[e.project] = (totals[e.project] || 0) + minutesBetween(e.start, stop);
    }
    const projects = new Set([...Object.keys(totals), ...Object.keys(targets)]);
    if (!projects.size) {
      console.log("Nothing tracked today, no active targets.");
      break;
    }
    for (const p of projects) {
      const done = totals[p] || 0;
      const target = targets[p];
      const running = openEntry(entries, p) ? " (running)" : "";
      if (target) {
        const mark = done >= target ? "DONE" : `${Math.max(0, target - done).toFixed(0)} min left`;
        console.log(`${p}: ${done.toFixed(1)} / ${target} min — ${mark}${running}`);
      } else {
        console.log(`${p}: ${done.toFixed(1)} min (no target)${running}`);
      }
    }
    break;
  }

  default:
    console.log("Usage: timer <start|stop|status|today> [project] [--at HH:MM (local) | --ago <minutes>] [--force]");
    process.exit(cmd ? 1 : 0);
}
