// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IWorkerRegistry {
    function isWorkerActive(address) external view returns (bool);
    function slashReputation(address, address) external;
}

contract NativeEscrow is ReentrancyGuard {
    using ECDSA for bytes32;

    IWorkerRegistry public registry;

    enum TaskStatus { OPEN, COMPLETED, DISPUTED, REFUNDED }

    struct Task {
        address master;
        address worker;
        uint256 amount;
        uint256 deadline;
        TaskStatus status;
    }

    mapping(bytes32 => Task) public tasks;

    event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount);
    event TaskCompleted(bytes32 indexed taskId, bytes result);
    event TaskRefunded(bytes32 indexed taskId);

    constructor(address _registry) {
        registry = IWorkerRegistry(_registry);
    }

    // Standard Deposit
    function depositTask(bytes32 _taskId, address _worker, uint256 _duration) external payable {
        require(msg.value > 0, "Deposit required");
        require(tasks[_taskId].amount == 0, "Task ID exists");
        
        tasks[_taskId] = Task({
            master: msg.sender,
            worker: _worker,
            amount: msg.value,
            deadline: block.timestamp + _duration,
            status: TaskStatus.OPEN
        });

        emit TaskCreated(_taskId, msg.sender, _worker, msg.value);
    }

    /**
     * @notice GASLESS SETTLEMENT (The Magic Function)
     * The Master calls this function and pays the gas.
     * The contract validates that the Worker *signed* this specific result.
     */
    function submitWorkRelayed(
        bytes32 _taskId, 
        bytes calldata _resultHash, 
        bytes calldata _signature
    ) external nonReentrant {
        Task storage t = tasks[_taskId];
        
        require(t.status == TaskStatus.OPEN, "Task not open");
        require(block.timestamp <= t.deadline, "Task expired");

        // 1. Reconstruct the message the worker signed
        // We assume the worker signed: keccak256(taskId + resultHash)
        bytes32 messageHash = keccak256(abi.encodePacked(_taskId, _resultHash));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        // 2. Recover the signer from the signature
        address signer = ECDSA.recover(ethSignedMessageHash, _signature);

        // 3. Verify it was truly the assigned Worker
        require(signer == t.worker, "Invalid signature: Not signed by assigned worker");

        // 4. Complete Task & Transfer Funds
        t.status = TaskStatus.COMPLETED;
        
        // Pay the worker
        (bool success, ) = payable(t.worker).call{value: t.amount}("");
        require(success, "Transfer failed");

        emit TaskCompleted(_taskId, _resultHash);
    }
    
    // Fallback refund
    function refundAndSlash(bytes32 _taskId) external nonReentrant {
        Task storage t = tasks[_taskId];
        require(t.status == TaskStatus.OPEN && block.timestamp > t.deadline, "Cannot refund yet");
        require(msg.sender == t.master, "Not master");

        t.status = TaskStatus.REFUNDED;
        registry.slashReputation(t.worker, msg.sender);
        
        payable(t.master).transfer(t.amount);
        emit TaskRefunded(_taskId);
    }
}