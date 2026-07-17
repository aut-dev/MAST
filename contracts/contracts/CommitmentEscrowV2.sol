// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommitmentEscrowV2
 * @notice Self-service commitment escrow on Base L2, in two modes.
 *
 *         SOLO MODE — deposit USDC, lock it against your own goals,
 *         release it back when you follow through. If the deadline
 *         passes, anyone can trigger expiry and the stake is routed
 *         per your forfeit plan: any mix of your own address, the
 *         MAST project, a burn address, charities, or anticharities,
 *         weighted in basis points summing to 10000. No plan set
 *         means the forfeit goes to the platform (contract owner).
 *
 *         POD MODE — two or more people form a pod with a shared
 *         $/minute rate. Goals are logged on-chain only as integer
 *         IDs plus percent progress (names stay off-chain). Stakes
 *         that expire during a week accumulate in that week's pool.
 *         After the week ends, members vote on the outcome — in the
 *         normal case everyone's agent reads the chain, computes the
 *         winner, and votes for them; the pool pays out on majority.
 *         On anomalies (e.g. a timer left running) members can vote
 *         instead to send the pool to charity, an anticharity, burn
 *         it, recall it to contributors, or award any member. If no
 *         majority forms within the grace window, anyone can trigger
 *         a full refund to contributors.
 */
contract CommitmentEscrowV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    // USDC reverts on transfers to address(0), so burning uses the
    // conventional dead address.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant BPS = 10000;
    uint8 public constant MAX_PLAN_ENTRIES = 8;
    uint256 public constant WEEK = 7 days;
    // After a pod week ends: majority suffices once everyone voted;
    // past VOTE_GRACE a majority of cast votes suffices; past
    // REFUND_DEADLINE anyone can force a refund to contributors.
    uint256 public constant VOTE_GRACE = 3 days;
    uint256 public constant REFUND_DEADLINE = 7 days;

    // ── Shared commitment state ───────────────────────────────

    struct Commitment {
        address user;
        uint256 amount;
        uint256 deadline;
        bool completed;
        bool expired;
    }

    mapping(address => uint256) public balances;
    mapping(bytes32 => Commitment) public commitments;
    mapping(address => uint256) public locked;

    uint256 public platformBalance;

    // ── Solo mode: forfeit plans ──────────────────────────────

    struct ForfeitSplit {
        address target;
        uint16 weightBps;
    }

    mapping(address => ForfeitSplit[]) private forfeitPlans;

    // ── Pod mode ──────────────────────────────────────────────

    struct Pod {
        address[] members;
        uint256 ratePerMinute; // USDC (6 decimals) per minute — the pod's single $/min parameter
        uint32 weeklyMinutes;  // informational target used by agents
        uint64 weekZero;       // anchor timestamp; week n = [weekZero + n*WEEK, weekZero + (n+1)*WEEK)
        bool exists;
    }

    enum ResolutionKind { None, Winner, Charity, Anticharity, Recall, Burn }

    struct Vote {
        ResolutionKind kind;
        address target;
        bool cast;
    }

    mapping(bytes32 => Pod) private pods;
    mapping(bytes32 => mapping(address => bool)) public isPodMember;
    mapping(bytes32 => bytes32) public taskPod; // taskId => podId (0 for solo tasks)
    mapping(bytes32 => mapping(uint256 => uint256)) public podPool; // podId => week => forfeited pool
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public podContrib;
    mapping(bytes32 => mapping(uint256 => mapping(address => Vote))) private podVotes;
    mapping(bytes32 => mapping(uint256 => bool)) public weekResolved;

    // ── Events ────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Committed(bytes32 indexed taskId, address indexed user, uint256 amount, uint256 deadline);
    event Completed(bytes32 indexed taskId, address indexed user, uint256 amount);
    event Expired(bytes32 indexed taskId, address indexed user, uint256 amount);
    event ForfeitPlanSet(address indexed user, address[] targets, uint16[] weightsBps);
    event ForfeitRouted(address indexed user, address indexed target, uint256 amount);
    event PodCreated(bytes32 indexed podId, address[] members, uint256 ratePerMinute, uint32 weeklyMinutes, uint64 weekZero);
    event ProgressLogged(bytes32 indexed podId, address indexed member, uint256 indexed goalId, uint16 percentBps, uint32 minutesSpent, uint256 timestamp);
    event VoteCast(bytes32 indexed podId, uint256 indexed week, address indexed member, ResolutionKind kind, address target);
    event WeekResolved(bytes32 indexed podId, uint256 indexed week, ResolutionKind kind, address target, uint256 amount);
    event WeekRefunded(bytes32 indexed podId, uint256 indexed week, uint256 amount);

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ── Deposit / withdraw ────────────────────────────────────

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        require(balances[msg.sender] >= amount, "insufficient balance");
        balances[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ── Solo mode: forfeit plan ───────────────────────────────

    function setForfeitPlan(address[] calldata targets, uint16[] calldata weightsBps) external {
        require(targets.length == weightsBps.length, "length mismatch");
        require(targets.length > 0 && targets.length <= MAX_PLAN_ENTRIES, "bad plan size");
        uint256 sum;
        delete forfeitPlans[msg.sender];
        for (uint256 i = 0; i < targets.length; i++) {
            require(targets[i] != address(0), "zero target; use BURN_ADDRESS to burn");
            require(weightsBps[i] > 0, "zero weight");
            sum += weightsBps[i];
            forfeitPlans[msg.sender].push(ForfeitSplit(targets[i], weightsBps[i]));
        }
        require(sum == BPS, "weights must sum to 10000");
        emit ForfeitPlanSet(msg.sender, targets, weightsBps);
    }

    /// @notice Revert to the default: forfeits go to the platform.
    function clearForfeitPlan() external {
        delete forfeitPlans[msg.sender];
    }

    function getForfeitPlan(address user) external view returns (address[] memory targets, uint16[] memory weightsBps) {
        ForfeitSplit[] storage plan = forfeitPlans[user];
        targets = new address[](plan.length);
        weightsBps = new uint16[](plan.length);
        for (uint256 i = 0; i < plan.length; i++) {
            targets[i] = plan[i].target;
            weightsBps[i] = plan[i].weightBps;
        }
    }

    // ── Commit / complete / expire ────────────────────────────

    function commit(bytes32 taskId, uint256 amount, uint256 deadline) public {
        require(commitments[taskId].user == address(0), "task exists");
        require(balances[msg.sender] >= amount, "insufficient balance");
        require(amount > 0, "zero amount");
        require(deadline > block.timestamp, "deadline in past");

        balances[msg.sender] -= amount;
        locked[msg.sender] += amount;

        commitments[taskId] = Commitment({
            user: msg.sender,
            amount: amount,
            deadline: deadline,
            completed: false,
            expired: false
        });

        emit Committed(taskId, msg.sender, amount, deadline);
    }

    function complete(bytes32 taskId) external {
        Commitment storage c = commitments[taskId];
        require(c.user == msg.sender, "not yours");
        require(!c.completed && !c.expired, "already settled");

        c.completed = true;
        locked[c.user] -= c.amount;
        balances[c.user] += c.amount;

        emit Completed(taskId, c.user, c.amount);
    }

    function expire(bytes32 taskId) external nonReentrant {
        Commitment storage c = commitments[taskId];
        require(c.user != address(0), "not found");
        require(!c.completed && !c.expired, "already settled");
        require(block.timestamp > c.deadline, "not expired yet");

        c.expired = true;
        locked[c.user] -= c.amount;

        bytes32 podId = taskPod[taskId];
        if (podId != bytes32(0)) {
            uint256 week = weekOf(podId, c.deadline);
            podPool[podId][week] += c.amount;
            podContrib[podId][week][c.user] += c.amount;
        } else {
            _routeForfeit(c.user, c.amount);
        }

        emit Expired(taskId, c.user, c.amount);
    }

    function _routeForfeit(address user, uint256 amount) internal {
        ForfeitSplit[] storage plan = forfeitPlans[user];
        if (plan.length == 0) {
            platformBalance += amount;
            emit ForfeitRouted(user, owner(), amount);
            return;
        }
        uint256 remaining = amount;
        for (uint256 i = 0; i < plan.length; i++) {
            // Last entry takes the rounding remainder so nothing is stranded.
            uint256 share = i == plan.length - 1 ? remaining : (amount * plan[i].weightBps) / BPS;
            remaining -= share;
            if (share == 0) continue;
            usdc.safeTransfer(plan[i].target, share);
            emit ForfeitRouted(user, plan[i].target, share);
        }
    }

    // ── Pod mode ──────────────────────────────────────────────

    function createPod(
        bytes32 podId,
        address[] calldata members,
        uint256 ratePerMinute,
        uint32 weeklyMinutes,
        uint64 weekZero
    ) external {
        require(!pods[podId].exists, "pod exists");
        require(members.length >= 2, "need 2+ members");
        require(ratePerMinute > 0, "zero rate");
        bool callerIn;
        for (uint256 i = 0; i < members.length; i++) {
            require(members[i] != address(0), "zero member");
            require(!isPodMember[podId][members[i]], "duplicate member");
            isPodMember[podId][members[i]] = true;
            if (members[i] == msg.sender) callerIn = true;
        }
        require(callerIn, "creator must be a member");
        pods[podId] = Pod(members, ratePerMinute, weeklyMinutes, weekZero, true);
        emit PodCreated(podId, members, ratePerMinute, weeklyMinutes, weekZero);
    }

    function commitPod(bytes32 podId, bytes32 taskId, uint256 amount, uint256 deadline) external {
        require(pods[podId].exists, "no such pod");
        require(isPodMember[podId][msg.sender], "not a member");
        taskPod[taskId] = podId;
        commit(taskId, amount, deadline);
    }

    /// @notice Log a work session publicly. Only the integer goalId and
    ///         progress go on-chain — the goal's name stays private.
    function logProgress(bytes32 podId, uint256 goalId, uint16 percentBps, uint32 minutesSpent) external {
        require(isPodMember[podId][msg.sender], "not a member");
        require(percentBps <= BPS, "percent > 100%");
        emit ProgressLogged(podId, msg.sender, goalId, percentBps, minutesSpent, block.timestamp);
    }

    function weekOf(bytes32 podId, uint256 timestamp) public view returns (uint256) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        require(timestamp >= p.weekZero, "before week zero");
        return (timestamp - p.weekZero) / WEEK;
    }

    function weekEnd(bytes32 podId, uint256 week) public view returns (uint256) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        return p.weekZero + (week + 1) * WEEK;
    }

    /// @notice Vote on what happens to a finished week's pool. In the
    ///         normal case every member's agent computes the winner from
    ///         ProgressLogged events and votes Winner for them. On
    ///         anomalies, vote Charity/Anticharity/Burn/Recall/Winner as
    ///         the pod decides. Re-voting is allowed until resolution.
    function voteWeek(bytes32 podId, uint256 week, ResolutionKind kind, address target) external {
        require(isPodMember[podId][msg.sender], "not a member");
        require(block.timestamp > weekEnd(podId, week), "week not over");
        require(!weekResolved[podId][week], "already resolved");
        require(kind != ResolutionKind.None, "invalid kind");
        if (kind == ResolutionKind.Winner) {
            require(isPodMember[podId][target], "winner not a member");
        } else if (kind == ResolutionKind.Charity || kind == ResolutionKind.Anticharity) {
            require(target != address(0), "zero target");
        } else {
            require(target == address(0), "target must be zero");
        }
        podVotes[podId][week][msg.sender] = Vote(kind, target, true);
        emit VoteCast(podId, week, msg.sender, kind, target);
    }

    /// @notice Execute the majority resolution. Callable by anyone once a
    ///         strict majority of members agrees on an identical option and
    ///         either all members have voted or VOTE_GRACE has elapsed.
    function resolveWeek(bytes32 podId, uint256 week) external nonReentrant {
        require(!weekResolved[podId][week], "already resolved");
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        uint256 end = weekEnd(podId, week);
        require(block.timestamp > end, "week not over");

        uint256 n = p.members.length;
        uint256 castCount;
        for (uint256 i = 0; i < n; i++) {
            if (podVotes[podId][week][p.members[i]].cast) castCount++;
        }
        require(castCount == n || block.timestamp > end + VOTE_GRACE, "waiting for votes");

        // Find an option with a strict majority of all members.
        ResolutionKind winKind = ResolutionKind.None;
        address winTarget;
        for (uint256 i = 0; i < n; i++) {
            Vote storage v = podVotes[podId][week][p.members[i]];
            if (!v.cast) continue;
            uint256 count;
            for (uint256 j = 0; j < n; j++) {
                Vote storage w = podVotes[podId][week][p.members[j]];
                if (w.cast && w.kind == v.kind && w.target == v.target) count++;
            }
            if (count * 2 > n) {
                winKind = v.kind;
                winTarget = v.target;
                break;
            }
        }
        require(winKind != ResolutionKind.None, "no majority");

        weekResolved[podId][week] = true;
        uint256 pool = podPool[podId][week];
        podPool[podId][week] = 0;

        if (pool > 0) {
            if (winKind == ResolutionKind.Winner) {
                balances[winTarget] += pool;
            } else if (winKind == ResolutionKind.Recall) {
                _refundContributors(podId, week, pool);
            } else if (winKind == ResolutionKind.Burn) {
                usdc.safeTransfer(BURN_ADDRESS, pool);
            } else {
                usdc.safeTransfer(winTarget, pool);
            }
        }
        emit WeekResolved(podId, week, winKind, winTarget, pool);
    }

    /// @notice Failsafe: if voting never produced a majority, anyone can
    ///         return the whole pool to whoever forfeited into it.
    function refundWeek(bytes32 podId, uint256 week) external nonReentrant {
        require(!weekResolved[podId][week], "already resolved");
        require(block.timestamp > weekEnd(podId, week) + REFUND_DEADLINE, "refund window not open");
        weekResolved[podId][week] = true;
        uint256 pool = podPool[podId][week];
        podPool[podId][week] = 0;
        if (pool > 0) _refundContributors(podId, week, pool);
        emit WeekRefunded(podId, week, pool);
    }

    function _refundContributors(bytes32 podId, uint256 week, uint256 pool) internal {
        Pod storage p = pods[podId];
        uint256 returned;
        for (uint256 i = 0; i < p.members.length; i++) {
            address m = p.members[i];
            uint256 contrib = podContrib[podId][week][m];
            if (contrib == 0) continue;
            podContrib[podId][week][m] = 0;
            balances[m] += contrib;
            returned += contrib;
        }
        // Contributions always sum to the pool; anything unaccounted
        // (impossible in practice) goes to the platform rather than sticking.
        if (pool > returned) platformBalance += pool - returned;
    }

    // ── Admin: collect platform-routed forfeits ───────────────

    function withdrawPlatform(address to, uint256 amount) external onlyOwner {
        require(amount <= platformBalance, "exceeds platform balance");
        platformBalance -= amount;
        usdc.safeTransfer(to, amount);
    }

    // ── Views ─────────────────────────────────────────────────

    function getCommitment(bytes32 taskId) external view returns (
        address user, uint256 amount, uint256 deadline, bool completed, bool expired
    ) {
        Commitment memory c = commitments[taskId];
        return (c.user, c.amount, c.deadline, c.completed, c.expired);
    }

    function getUserInfo(address user) external view returns (
        uint256 available, uint256 lockedAmount
    ) {
        return (balances[user], locked[user]);
    }

    function getPod(bytes32 podId) external view returns (
        address[] memory members, uint256 ratePerMinute, uint32 weeklyMinutes, uint64 weekZero
    ) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        return (p.members, p.ratePerMinute, p.weeklyMinutes, p.weekZero);
    }

    function getVote(bytes32 podId, uint256 week, address member) external view returns (
        ResolutionKind kind, address target, bool cast
    ) {
        Vote memory v = podVotes[podId][week][member];
        return (v.kind, v.target, v.cast);
    }
}
