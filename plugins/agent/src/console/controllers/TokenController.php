<?php

namespace Plugins\Agent\console\controllers;

use Plugins\Agent\Agent;
use craft\elements\User;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\helpers\Console;

class TokenController extends Controller
{
    public ?string $email = null;
    public int $perCommitCap = 1000;
    public int $dailyCap = 5000;

    public function options($actionID): array
    {
        return array_merge(parent::options($actionID), [
            'email',
            'perCommitCap',
            'dailyCap',
        ]);
    }

    /**
     * Generate an agent API token for a user.
     *
     * Usage: php craft plugin-agent/token/generate --email=user@example.com
     */
    public function actionGenerate(): int
    {
        if (!$this->email) {
            $this->stderr("Error: --email is required\n", Console::FG_RED);
            return ExitCode::USAGE;
        }

        $user = User::find()->email($this->email)->one();
        if (!$user) {
            $this->stderr("Error: No user found with email {$this->email}\n", Console::FG_RED);
            return ExitCode::DATAERR;
        }

        $token = Agent::$plugin->token->generateToken($user, $this->perCommitCap, $this->dailyCap);

        $siteUrl = rtrim(\Craft::$app->sites->primarySite->baseUrl, '/');

        $this->stdout("\n", Console::FG_GREEN);
        $this->stdout("=== MAST Agent API ===\n", Console::FG_GREEN, Console::BOLD);
        $this->stdout("\n");
        $this->stdout("User:     {$user->fullName} ({$user->email})\n");
        $this->stdout("Token:    {$token}\n", Console::FG_YELLOW);
        $this->stdout("Base URL: {$siteUrl}/api/agent\n");
        $this->stdout("\n");
        $this->stdout("Per-commit cap: \$" . number_format($this->perCommitCap / 100, 2) . "\n");
        $this->stdout("Daily cap:      \$" . number_format($this->dailyCap / 100, 2) . "\n");
        $this->stdout("\n");
        $this->stdout("--- Paste this into your agent ---\n", Console::FG_CYAN);
        $this->stdout("\n");
        $this->stdout("MAST Commitment API: {$siteUrl}/api/agent\n");
        $this->stdout("Authorization: Bearer {$token}\n");
        $this->stdout("\n");
        $this->stdout("Endpoints:\n");
        $this->stdout("  POST /api/agent/commit    {\"title\":\"...\",\"amount_cents\":500,\"deadline\":\"23:00\"}\n");
        $this->stdout("  POST /api/agent/complete  {\"id\": <daily_task_id>}\n");
        $this->stdout("  GET  /api/agent/status\n");
        $this->stdout("  GET  /api/agent/me\n");
        $this->stdout("\n");
        $this->stdout("WARNING: Save this token now. It cannot be retrieved later.\n", Console::FG_RED);
        $this->stdout("\n");

        return ExitCode::OK;
    }

    /**
     * Revoke all agent tokens for a user.
     *
     * Usage: php craft plugin-agent/token/revoke --email=user@example.com
     */
    public function actionRevoke(): int
    {
        if (!$this->email) {
            $this->stderr("Error: --email is required\n", Console::FG_RED);
            return ExitCode::USAGE;
        }

        $user = User::find()->email($this->email)->one();
        if (!$user) {
            $this->stderr("Error: No user found with email {$this->email}\n", Console::FG_RED);
            return ExitCode::DATAERR;
        }

        Agent::$plugin->token->revokeTokens($user->id);
        $this->stdout("All agent tokens revoked for {$user->email}\n", Console::FG_GREEN);

        return ExitCode::OK;
    }
}
