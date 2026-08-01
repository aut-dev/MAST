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
 *         that expire during a period accumulate in that period's pool.
 *         After the period ends, members vote on the outcome — in the
 *         normal case every agent reads the chain, computes the same
 *         parimutuel split (members who hit their own weekly target
 *         share the pool pro-rata by the stake they had at risk), and
 *         votes for that share vector; it executes on majority.
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
    uint64 public constant WEEK = 7 days; // the natural pod period; testing can use shorter
    // Grace / refund windows are relative to each pod's own period, so a
    // 7-day pod behaves weekly while a short test pod stays fully testable.
    // After a period ends: majority suffices once everyone voted; past one
    // extra period a majority of cast votes suffices; past two extra
    // periods anyone can force a refund to contributors.

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
        uint32 targetMinutes;  // informational target used by agents
        uint64 periodZero;       // anchor timestamp; periodLength n = [periodZero + n*periodLength, periodZero + (n+1)*periodLength)
        uint64 periodLength;         // seconds per settlement period (WEEK for real pods, shorter for tests)
        bool exists;
    }

    enum ResolutionKind { None, Winner, Charity, Anticharity, Recall, Burn, Split, Rollover }

    struct Vote {
        ResolutionKind kind;
        address target;
        bool cast;
    }

    mapping(bytes32 => Pod) private pods;
    mapping(bytes32 => mapping(address => bool)) public isPodMember;
    mapping(bytes32 => bytes32) public taskPod; // taskId => podId (0 for solo tasks)
    mapping(bytes32 => mapping(uint256 => uint256)) public podPool; // podId => period => forfeited pool
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public podContrib;
    mapping(bytes32 => mapping(uint256 => mapping(address => Vote))) private podVotes;
    // Split votes carry a share vector (aligned to pod.members, bps summing
    // to 10000); the hash is what majority-matching compares.
    mapping(bytes32 => mapping(uint256 => mapping(address => uint16[]))) private splitVotes;
    mapping(bytes32 => mapping(uint256 => mapping(address => bytes32))) private splitHash;
    mapping(bytes32 => mapping(uint256 => bool)) public periodResolved;

    // ── Events ────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Committed(bytes32 indexed taskId, address indexed user, uint256 amount, uint256 deadline);
    event Completed(bytes32 indexed taskId, address indexed user, uint256 amount);
    event Expired(bytes32 indexed taskId, address indexed user, uint256 amount);
    event ForfeitPlanSet(address indexed user, address[] targets, uint16[] weightsBps);
    event ForfeitRouted(address indexed user, address indexed target, uint256 amount);
    event PodCreated(bytes32 indexed podId, address[] members, uint256 ratePerMinute, uint32 targetMinutes, uint64 periodZero, uint64 periodLength);
    event ProgressLogged(bytes32 indexed podId, address indexed member, uint256 indexed goalId, uint16 percentBps, uint32 minutesSpent, uint256 timestamp);
    event VoteCast(bytes32 indexed podId, uint256 indexed period, address indexed member, ResolutionKind kind, address target);
    event PeriodResolved(bytes32 indexed podId, uint256 indexed period, ResolutionKind kind, address target, uint256 amount);
    event PeriodRefunded(bytes32 indexed podId, uint256 indexed period, uint256 amount);

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
            uint256 period = periodOf(podId, c.deadline);
            podPool[podId][period] += c.amount;
            podContrib[podId][period][c.user] += c.amount;
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
        uint32 targetMinutes,
        uint64 periodZero,
        uint64 periodLength
    ) external {
        require(!pods[podId].exists, "pod exists");
        require(members.length >= 2, "need 2+ members");
        require(ratePerMinute > 0, "zero rate");
        require(periodLength > 0, "zero periodLength");
        bool callerIn;
        for (uint256 i = 0; i < members.length; i++) {
            require(members[i] != address(0), "zero member");
            require(!isPodMember[podId][members[i]], "duplicate member");
            isPodMember[podId][members[i]] = true;
            if (members[i] == msg.sender) callerIn = true;
        }
        require(callerIn, "creator must be a member");
        pods[podId] = Pod(members, ratePerMinute, targetMinutes, periodZero, periodLength, true);
        emit PodCreated(podId, members, ratePerMinute, targetMinutes, periodZero, periodLength);
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

    function periodOf(bytes32 podId, uint256 timestamp) public view returns (uint256) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        require(timestamp >= p.periodZero, "before period zero");
        return (timestamp - p.periodZero) / p.periodLength;
    }

    function periodEnd(bytes32 podId, uint256 period) public view returns (uint256) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        return p.periodZero + (period + 1) * p.periodLength;
    }

    /// @notice Vote on what happens to a finished period's pool. On
    ///         anomalies, vote Charity/Anticharity/Burn/Recall/Rollover/
    ///         Winner as the pod decides. The normal parimutuel path is
    ///         votePeriodSplit. Re-voting is allowed until resolution.
    function votePeriod(bytes32 podId, uint256 period, ResolutionKind kind, address target) external {
        require(isPodMember[podId][msg.sender], "not a member");
        require(block.timestamp > periodEnd(podId, period), "period not over");
        require(!periodResolved[podId][period], "already resolved");
        require(kind != ResolutionKind.None, "invalid kind");
        require(kind != ResolutionKind.Split, "use votePeriodSplit");
        if (kind == ResolutionKind.Winner) {
            require(isPodMember[podId][target], "winner not a member");
        } else if (kind == ResolutionKind.Charity || kind == ResolutionKind.Anticharity) {
            require(target != address(0), "zero target");
        } else {
            require(target == address(0), "target must be zero");
        }
        podVotes[podId][period][msg.sender] = Vote(kind, target, true);
        delete splitVotes[podId][period][msg.sender];
        delete splitHash[podId][period][msg.sender];
        emit VoteCast(podId, period, msg.sender, kind, target);
    }

    /// @notice The normal weekly path: parimutuel settlement. Every agent
    ///         computes the same share vector from on-chain data — members
    ///         who hit their own weekly target split the pool pro-rata by
    ///         the stake they had at risk (completers split the forfeits,
    ///         weighted by stake) — and votes for it. Shares align with the
    ///         pod's member order and must sum to 10000 bps. Honest agents
    ///         reading the same chain produce identical vectors, so
    ///         majority agreement is the natural outcome.
    function votePeriodSplit(bytes32 podId, uint256 period, uint16[] calldata sharesBps) external {
        require(isPodMember[podId][msg.sender], "not a member");
        require(block.timestamp > periodEnd(podId, period), "period not over");
        require(!periodResolved[podId][period], "already resolved");
        Pod storage p = pods[podId];
        require(sharesBps.length == p.members.length, "shares/members mismatch");
        uint256 sum;
        for (uint256 i = 0; i < sharesBps.length; i++) sum += sharesBps[i];
        require(sum == BPS, "shares must sum to 10000");
        podVotes[podId][period][msg.sender] = Vote(ResolutionKind.Split, address(0), true);
        splitVotes[podId][period][msg.sender] = sharesBps;
        splitHash[podId][period][msg.sender] = keccak256(abi.encodePacked(sharesBps));
        emit VoteCast(podId, period, msg.sender, ResolutionKind.Split, address(0));
    }

    /// @notice Execute the majority resolution. Callable by anyone once a
    ///         strict majority of members agrees on an identical option and
    ///         either all members have voted or one extra period has elapsed.
    function resolvePeriod(bytes32 podId, uint256 period) external nonReentrant {
        require(!periodResolved[podId][period], "already resolved");
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        uint256 end = periodEnd(podId, period);
        require(block.timestamp > end, "period not over");

        uint256 n = p.members.length;
        uint256 castCount;
        for (uint256 i = 0; i < n; i++) {
            if (podVotes[podId][period][p.members[i]].cast) castCount++;
        }
        require(castCount == n || block.timestamp > end + p.periodLength, "waiting for votes");

        // Find an option with a strict majority of all members. Split votes
        // match only if their share vectors are identical (compared by hash).
        ResolutionKind winKind = ResolutionKind.None;
        address winTarget;
        address winVoter;
        for (uint256 i = 0; i < n; i++) {
            Vote storage v = podVotes[podId][period][p.members[i]];
            if (!v.cast) continue;
            bytes32 vHash = splitHash[podId][period][p.members[i]];
            uint256 count;
            for (uint256 j = 0; j < n; j++) {
                Vote storage w = podVotes[podId][period][p.members[j]];
                if (!w.cast || w.kind != v.kind || w.target != v.target) continue;
                if (v.kind == ResolutionKind.Split && splitHash[podId][period][p.members[j]] != vHash) continue;
                count++;
            }
            if (count * 2 > n) {
                winKind = v.kind;
                winTarget = v.target;
                winVoter = p.members[i];
                break;
            }
        }
        require(winKind != ResolutionKind.None, "no majority");

        periodResolved[podId][period] = true;
        uint256 pool = podPool[podId][period];
        podPool[podId][period] = 0;

        if (pool > 0) {
            if (winKind == ResolutionKind.Split) {
                _distributeSplit(p, splitVotes[podId][period][winVoter], pool);
            } else if (winKind == ResolutionKind.Winner) {
                balances[winTarget] += pool;
            } else if (winKind == ResolutionKind.Recall) {
                _refundContributors(podId, period, pool);
            } else if (winKind == ResolutionKind.Rollover) {
                podPool[podId][period + 1] += pool;
            } else if (winKind == ResolutionKind.Burn) {
                usdc.safeTransfer(BURN_ADDRESS, pool);
            } else {
                usdc.safeTransfer(winTarget, pool);
            }
        }
        emit PeriodResolved(podId, period, winKind, winTarget, pool);
    }

    function _distributeSplit(Pod storage p, uint16[] storage sharesBps, uint256 pool) internal {
        uint256 distributed;
        uint256 lastNonzero;
        for (uint256 i = 0; i < sharesBps.length; i++) {
            if (sharesBps[i] > 0) lastNonzero = i;
        }
        for (uint256 i = 0; i < sharesBps.length; i++) {
            if (sharesBps[i] == 0) continue;
            // Last nonzero share takes the rounding remainder.
            uint256 amount = i == lastNonzero ? pool - distributed : (pool * sharesBps[i]) / BPS;
            distributed += amount;
            balances[p.members[i]] += amount;
        }
    }

    /// @notice Failsafe: if voting never produced a majority, anyone can
    ///         return the whole pool to whoever forfeited into it.
    function refundPeriod(bytes32 podId, uint256 period) external nonReentrant {
        require(!periodResolved[podId][period], "already resolved");
        require(block.timestamp > periodEnd(podId, period) + 2 * pods[podId].periodLength, "refund window not open");
        periodResolved[podId][period] = true;
        uint256 pool = podPool[podId][period];
        podPool[podId][period] = 0;
        if (pool > 0) _refundContributors(podId, period, pool);
        emit PeriodRefunded(podId, period, pool);
    }

    function _refundContributors(bytes32 podId, uint256 period, uint256 pool) internal {
        Pod storage p = pods[podId];
        uint256 returned;
        for (uint256 i = 0; i < p.members.length; i++) {
            address m = p.members[i];
            uint256 contrib = podContrib[podId][period][m];
            if (contrib == 0) continue;
            podContrib[podId][period][m] = 0;
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
        address[] memory members, uint256 ratePerMinute, uint32 targetMinutes, uint64 periodZero, uint64 periodLength
    ) {
        Pod storage p = pods[podId];
        require(p.exists, "no such pod");
        return (p.members, p.ratePerMinute, p.targetMinutes, p.periodZero, p.periodLength);
    }

    function getVote(bytes32 podId, uint256 period, address member) external view returns (
        ResolutionKind kind, address target, bool cast
    ) {
        Vote memory v = podVotes[podId][period][member];
        return (v.kind, v.target, v.cast);
    }

    function getSplitVote(bytes32 podId, uint256 period, address member) external view returns (uint16[] memory) {
        return splitVotes[podId][period][member];
    }
}
