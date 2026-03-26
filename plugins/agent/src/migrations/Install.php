<?php

namespace Plugins\Agent\migrations;

use craft\db\Migration;

class Install extends Migration
{
    public function safeUp(): bool
    {
        $this->createTable('{{%agent_tokens}}', [
            'id' => $this->primaryKey(),
            'userId' => $this->integer()->notNull(),
            'tokenHash' => $this->string(255)->notNull(),
            'perCommitCap' => $this->integer()->notNull()->defaultValue(1000),
            'dailyCap' => $this->integer()->notNull()->defaultValue(5000),
            'createdAt' => $this->dateTime()->notNull(),
            'lastUsedAt' => $this->dateTime()->null(),
        ]);

        $this->addForeignKey(
            'fk_agent_tokens_userId',
            '{{%agent_tokens}}',
            'userId',
            '{{%users}}',
            'id',
            'CASCADE'
        );

        $this->createIndex('idx_agent_tokens_userId', '{{%agent_tokens}}', 'userId');

        return true;
    }

    public function safeDown(): bool
    {
        $this->dropTableIfExists('{{%agent_tokens}}');
        return true;
    }
}
