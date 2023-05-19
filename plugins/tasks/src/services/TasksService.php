<?php

namespace Plugins\Tasks\services;

use craft\base\Component;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;
use DateTime;

class TasksService extends Component
{
    public function createTask(string $name, ?User $user = null): Entry
    {
        if (!$user) {
            $user = \Craft::$app->user->identity;
        }
        if (!$user) {
            throw new Exception("Can't create a task without a user");
        }
        if (!$name) {
            throw new Exception("Can't create a task without a name");
        }
        $section = \Craft::$app->sections->getSectionByHandle('task');
        $types = $section->entryTypes;
        $type = reset($types);
        $task = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $user->id,
            'title' => $name
        ]);
        $task->scenario = Element::SCENARIO_LIVE;
        if (\Craft::$app->elements->saveElement($task)) {
            return $task;
        }
        throw new Exception("Couldn't save task : " . print_r($task->errors, true));
    }

    public function createBlocks(Entry $task, DateTime $startDate, int $length, DateTime $deadline, int $committed): array
    {
        $blocks = [];
        $section = \Craft::$app->sections->getSectionByHandle('taskBlock');
        $types = $section->entryTypes;
        $type = reset($types);
        $block = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId,
        ]);
        $block->setFieldValues([
            'task' => [$task->id],
            'day' => $startDate,
            'length' => $length * 60,
            'committed' => $committed * 100,
            'deadline' => $deadline
        ]);
        $block->scenario = Element::SCENARIO_LIVE;
        if (\Craft::$app->elements->saveElement($block)) {
            $blocks[] = $block;
        } else {
            throw new Exception("Couldn't save block : " . print_r($block->errors, true));
        }
        return $blocks;
    }

    public function getTodaysBlocks(User $user): array
    {
        $start = (new DateTime())->setTime(0, 0, 0);
        $end = (clone $start)->setTime(23, 59, 59);
        $dayField = 'content.field_day_' . \Craft::$app->fields->getFieldByHandle('day')->columnSuffix;
        $query = Entry::find()->section('taskBlock')->with('task')->authorId($user->id)->where(['between', $dayField, $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')]);
        return $query->all();
    }
}
