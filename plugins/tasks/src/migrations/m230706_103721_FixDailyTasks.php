<?php

namespace Plugins\Tasks\migrations;

use Craft;
use Plugins\Tasks\Tasks;
use craft\db\Migration;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use DateInterval;

/**
 * m230706_103721_FixDailyTasks migration.
 */
class m230706_103721_FixDailyTasks extends Migration
{
    /**
     * @inheritdoc
     */
    public function safeUp(): bool
    {
        // $now = DateTimeHelper::toDateTime('now');
        // foreach (Entry::find()->section('task')->all() as $task) {
        //     $day = $task->author->getDate($task->startDate);
        //     while ($day < $now) {
        //         $task = Tasks::$plugin->tasks->getOrCreateDailyTask($task, $day);
        //         if ($day->format('d-m-Y') != $now->format('d-m-Y')) {
        //             $task->setFieldValue('processed', true);
        //         }
        //         \Craft::$app->elements->saveElement($task, false);
        //         $day->add(new DateInterval('P1D'));
        //     }
        // }
        return true;
    }

    /**
     * @inheritdoc
     */
    public function safeDown(): bool
    {
        echo "m230706_103721_FixDailyTasks cannot be reverted.\n";
        return false;
    }
}
