// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommitmentEscrow
 * @notice Fully self-service commitment escrow on Base L2.
 *         Users deposit USDC, lock it against their own goals,
 *         and release it back when they follow through.
 *         No admin is involved in the commit/complete flow.
 *         If the deadline passes, anyone can trigger expiry and
 *         the funds are forfeited to the platform.
 */
contract CommitmentEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

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

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Committed(bytes32 indexed taskId, address indexed user, uint256 amount, uint256 deadline);
    event Completed(bytes32 indexed taskId, address indexed user, uint256 amount);
    event Expired(bytes32 indexed taskId, address indexed user, uint256 amount);

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ── Anyone can deposit / withdraw their own USDC ──────────

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

    // ── User locks their own funds against a commitment ───────

    function commit(bytes32 taskId, uint256 amount, uint256 deadline) external {
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

    // ── User releases their own funds on completion ───────────

    function complete(bytes32 taskId) external {
        Commitment storage c = commitments[taskId];
        require(c.user == msg.sender, "not yours");
        require(!c.completed && !c.expired, "already settled");

        c.completed = true;
        locked[c.user] -= c.amount;
        balances[c.user] += c.amount;

        emit Completed(taskId, c.user, c.amount);
    }

    // ── Anyone can expire a task after its deadline ───────────

    function expire(bytes32 taskId) external {
        Commitment storage c = commitments[taskId];
        require(c.user != address(0), "not found");
        require(!c.completed && !c.expired, "already settled");
        require(block.timestamp > c.deadline, "not expired yet");

        c.expired = true;
        locked[c.user] -= c.amount;
        platformBalance += c.amount;

        emit Expired(taskId, c.user, c.amount);
    }

    // ── Admin: collect forfeited funds ────────────────────────

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
}
