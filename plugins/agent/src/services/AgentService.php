<?php

namespace Plugins\Agent\services;

use craft\base\Component;

/**
 * AgentService — Stripe fallback path (legacy).
 *
 * The primary agent API is the standalone Node.js service in /agent-api/
 * which uses USDC on Base L2 for near-zero-fee escrow.
 *
 * This PHP service remains available for Stripe-based flows if needed
 * in the future (e.g. users who prefer card payments via Stripe).
 */
class AgentService extends Component
{
}
