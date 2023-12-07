<?php

namespace Plugins\Tasks\variables;

use craft\elements\Entry;

class TasksVariable
{
    public function getTasks(): array
    {
        $tasks = [];
        foreach (Entry::find()->section('task')->authorId(\Craft::$app->user->identity->id)->all() as $task) {
            $tasks[$task->id] = [
                'title' => $task->title,
                'id' => $task->id,
                'color' => (string)$task->color
            ];
        }
        return $tasks;
    }
}
