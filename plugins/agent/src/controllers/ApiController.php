<?php

namespace Plugins\Agent\controllers;

use Plugins\Agent\Agent;
use Plugins\Tasks\Tasks;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\MoneyHelper;
use craft\web\Controller;
use yii\web\Response;

class ApiController extends Controller
{
    protected array|bool|int $allowAnonymous = self::ALLOW_ANONYMOUS_LIVE | self::ALLOW_ANONYMOUS_OFFLINE;
    public $enableCsrfValidation = false;

    private ?User $_user = null;
    private int $_perCommitCap = 1000;
    private int $_dailyCap = 5000;

    public function beforeAction($action): bool
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        $authHeader = $this->request->getHeaders()->get('Authorization');
        if (!$authHeader || strpos($authHeader, 'Bearer ') !== 0) {
            $this->response->setStatusCode(401);
            $this->response->data = json_encode(['error' => 'Missing Authorization header']);
            $this->response->format = Response::FORMAT_JSON;
            return false;
        }

        $token = substr($authHeader, 7);
        $result = Agent::$plugin->token->validateToken($token);

        if (!$result) {
            $this->response->setStatusCode(401);
            $this->response->data = json_encode(['error' => 'Invalid token']);
            $this->response->format = Response::FORMAT_JSON;
            return false;
        }

        $this->_user = $result['user'];
        $this->_perCommitCap = $result['perCommitCap'];
        $this->_dailyCap = $result['dailyCap'];

        // Rate limiting: 60 requests per minute
        $cacheKey = 'agent_rate_' . $this->_user->id;
        $count = \Craft::$app->cache->get($cacheKey) ?: 0;
        if ($count >= 60) {
            $this->response->setStatusCode(429);
            $this->response->data = json_encode(['error' => 'Rate limit exceeded. Max 60 requests per minute.']);
            $this->response->format = Response::FORMAT_JSON;
            return false;
        }
        \Craft::$app->cache->set($cacheKey, $count + 1, 60);

        return true;
    }

    /**
     * POST /api/agent/commit
     * Create a commitment and charge immediately.
     */
    public function actionCommit(): Response
    {
        $this->requirePostRequest();

        $body = json_decode($this->request->getRawBody(), true);
        if (!$body) {
            return $this->asJson(['error' => 'Invalid JSON body'])->setStatusCode(400);
        }

        $title = $body['title'] ?? null;
        $amountCents = $body['amount_cents'] ?? null;
        $deadline = $body['deadline'] ?? '23:59';

        if (!$title || !$amountCents) {
            return $this->asJson(['error' => 'Required fields: title, amount_cents'])->setStatusCode(400);
        }

        $amountCents = (int)$amountCents;

        // Validate spending caps
        list($valid, $reason) = Agent::$plugin->agent->validateSpendingCaps(
            $this->_user, $amountCents, $this->_perCommitCap, $this->_dailyCap
        );
        if (!$valid) {
            return $this->asJson(['error' => $reason])->setStatusCode(402);
        }

        // Check payment method
        if (!$this->_user->stripeCustomer || !$this->_user->paymentMethod) {
            return $this->asJson(['error' => 'No payment method configured. Set up Stripe first.'])->setStatusCode(400);
        }

        // Create task entry
        $taskSection = \Craft::$app->sections->getSectionByHandle('task');
        $taskTypes = $taskSection->entryTypes;
        $taskType = reset($taskTypes);

        $task = new Entry([
            'sectionId' => $taskSection->id,
            'typeId' => $taskType->id,
            'authorId' => $this->_user->id,
        ]);

        $task->title = $title;

        $today = new \DateTime('now', new \DateTimeZone($this->_user->timezone ?? 'UTC'));

        $task->setFieldValues([
            'startDate' => $today,
            'deadline' => new \DateTime($deadline),
            'committed' => ['value' => number_format($amountCents / 100, 2), 'currency' => 'USD'],
            'recurring' => false,
            'timeBased' => false,
        ]);

        $task->scenario = Element::SCENARIO_LIVE;
        if (!\Craft::$app->elements->saveElement($task)) {
            return $this->asJson(['error' => 'Failed to create task', 'details' => $task->errors])->setStatusCode(500);
        }

        // Create daily task
        $dailyTask = Tasks::$plugin->tasks->getOrCreateDailyTask($task);
        if (!$dailyTask) {
            \Craft::$app->elements->deleteElement($task, true);
            return $this->asJson(['error' => 'Failed to create daily task'])->setStatusCode(500);
        }

        // Charge immediately
        list($charged, $intent) = Agent::$plugin->agent->chargeOnCommit($dailyTask);

        if (!$charged) {
            // Clean up: delete the task and daily task
            \Craft::$app->elements->deleteElement($dailyTask, true);
            \Craft::$app->elements->deleteElement($task, true);
            return $this->asJson(['error' => 'Stripe charge failed. Check payment method.'])->setStatusCode(402);
        }

        return $this->asJson([
            'id' => $dailyTask->id,
            'task_id' => $task->id,
            'title' => $title,
            'status' => 'charged',
            'amount_cents' => $amountCents,
            'deadline' => $deadline,
            'charged_at' => (new \DateTime())->format('c'),
        ]);
    }

    /**
     * POST /api/agent/complete
     * Mark a commitment done and refund.
     */
    public function actionComplete(): Response
    {
        $this->requirePostRequest();

        $body = json_decode($this->request->getRawBody(), true);
        $id = $body['id'] ?? null;

        if (!$id) {
            return $this->asJson(['error' => 'Required field: id (daily task ID)'])->setStatusCode(400);
        }

        $dailyTask = Entry::find()
            ->section('dailyTask')
            ->id($id)
            ->authorId($this->_user->id)
            ->one();

        if (!$dailyTask) {
            return $this->asJson(['error' => 'Daily task not found'])->setStatusCode(404);
        }

        // Already refunded — return existing state (idempotent)
        if ($dailyTask->refunded) {
            return $this->asJson([
                'id' => $dailyTask->id,
                'status' => 'already_refunded',
                'amount_cents' => (int)(MoneyHelper::toNumber($dailyTask->committed) * 100),
            ]);
        }

        if (!$dailyTask->chargeId) {
            return $this->asJson(['error' => 'No charge found on this task — nothing to refund'])->setStatusCode(400);
        }

        if ($dailyTask->processed && $dailyTask->hasDerailed) {
            return $this->asJson(['error' => 'Task has already derailed — charge is forfeited'])->setStatusCode(409);
        }

        $refunded = Agent::$plugin->agent->refundOnComplete($dailyTask);

        if (!$refunded) {
            return $this->asJson(['error' => 'Stripe refund failed'])->setStatusCode(500);
        }

        return $this->asJson([
            'id' => $dailyTask->id,
            'status' => 'refunded',
            'amount_cents' => (int)(MoneyHelper::toNumber($dailyTask->committed) * 100),
            'refunded_at' => (new \DateTime())->format('c'),
        ]);
    }

    /**
     * GET /api/agent/status
     * Get status of active daily tasks.
     */
    public function actionStatus(): Response
    {
        $id = $this->request->getQueryParam('id');

        $query = Entry::find()
            ->section('dailyTask')
            ->authorId($this->_user->id)
            ->with('task');

        if ($id) {
            $query->id($id);
        } else {
            // Default: today's tasks
            $today = (new \DateTime('now', new \DateTimeZone($this->_user->timezone ?? 'UTC')))->format('Y-m-d');
            $query->startDate($today);
        }

        $tasks = $query->all();

        $result = [];
        foreach ($tasks as $dt) {
            $parentTask = $dt->task->one() ?? null;
            $result[] = [
                'id' => $dt->id,
                'task_id' => $parentTask ? $parentTask->id : null,
                'title' => $parentTask ? $parentTask->title : $dt->title,
                'amount_cents' => (int)(MoneyHelper::toNumber($dt->committed) * 100),
                'deadline' => $dt->deadline ? $dt->deadline->format('H:i') : null,
                'done' => (bool)$dt->done,
                'charged' => (bool)$dt->chargeSucceeded,
                'refunded' => (bool)$dt->refunded,
                'derailed' => (bool)$dt->hasDerailed,
                'processed' => (bool)$dt->processed,
            ];
        }

        return $this->asJson([
            'tasks' => $result,
            'count' => count($result),
        ]);
    }

    /**
     * GET /api/agent/me
     * Get user profile and spending info.
     */
    public function actionMe(): Response
    {
        $todaySpent = Agent::$plugin->agent->getTodaySpent($this->_user);

        return $this->asJson([
            'name' => $this->_user->fullName,
            'email' => $this->_user->email,
            'timezone' => $this->_user->timezone ?? 'UTC',
            'has_payment_method' => (bool)$this->_user->paymentMethod,
            'per_commit_cap_cents' => $this->_perCommitCap,
            'daily_cap_cents' => $this->_dailyCap,
            'today_spent_cents' => $todaySpent,
            'today_remaining_cents' => max(0, $this->_dailyCap - $todaySpent),
        ]);
    }
}
