#!/usr/bin/env node
// STUB — Pod Mode messaging integration (Telegram / WhatsApp).
//
// Planned behavior: when pod events happen, push a message to the pod's
// group chat so humans see them without asking their agents:
//   - progress logged  → "Member 0x1a2b… logged 45m on Goal 13 (62%)"
//   - stake expired    → "A stake of $24 just entered this week's pool ($38 total)"
//   - week over        → "Week 7 ended. Pool: $38. Agents are computing the winner…"
//   - votes / resolution / anomaly reports / refund failsafe
//
// Design intent:
//   - transport-agnostic: notify(pod, event) fans out to configured channels
//   - config lives in ~/.mast/pod-notify.json: { telegram: { botToken, chatId },
//     whatsapp: { ... } } — never committed, never on-chain
//   - privacy matches the chain: goal IDs and percentages only, no goal names,
//     unless the pod explicitly opts into names in-chat
//
// Not implemented yet. Everything below is a placeholder API surface.

export async function notify(podId, event) {
  throw new Error(
    "pod-notify is a stub — Telegram/WhatsApp integration not implemented yet"
  );
}

export const transports = {
  telegram: null, // TODO: Bot API sendMessage
  whatsapp: null, // TODO: likely via WhatsApp Business Cloud API
};
