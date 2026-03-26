<?php

namespace Plugins\Agent\services;

use craft\base\Component;
use craft\db\Query;
use craft\elements\User;

class TokenService extends Component
{
    public function generateToken(User $user, int $perCommitCap = 1000, int $dailyCap = 5000): string
    {
        $token = 'mast_' . bin2hex(random_bytes(32));
        $hash = password_hash($token, PASSWORD_DEFAULT);

        \Craft::$app->db->createCommand()->insert('{{%agent_tokens}}', [
            'userId' => $user->id,
            'tokenHash' => $hash,
            'perCommitCap' => $perCommitCap,
            'dailyCap' => $dailyCap,
            'createdAt' => (new \DateTime())->format('Y-m-d H:i:s'),
        ])->execute();

        return $token;
    }

    public function validateToken(string $token): ?array
    {
        if (strpos($token, 'mast_') !== 0) {
            return null;
        }

        $rows = (new Query())
            ->select(['id', 'userId', 'tokenHash', 'perCommitCap', 'dailyCap'])
            ->from('{{%agent_tokens}}')
            ->all();

        foreach ($rows as $row) {
            if (password_verify($token, $row['tokenHash'])) {
                $user = User::find()->id($row['userId'])->status(null)->one();
                if (!$user || $user->status !== User::STATUS_ACTIVE) {
                    return null;
                }

                \Craft::$app->db->createCommand()->update('{{%agent_tokens}}', [
                    'lastUsedAt' => (new \DateTime())->format('Y-m-d H:i:s'),
                ], ['id' => $row['id']])->execute();

                return [
                    'user' => $user,
                    'perCommitCap' => (int)$row['perCommitCap'],
                    'dailyCap' => (int)$row['dailyCap'],
                ];
            }
        }

        return null;
    }

    public function revokeTokens(int $userId): bool
    {
        \Craft::$app->db->createCommand()->delete('{{%agent_tokens}}', [
            'userId' => $userId,
        ])->execute();

        return true;
    }
}
