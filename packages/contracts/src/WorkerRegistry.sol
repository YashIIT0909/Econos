// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract WorkerRegistry is Ownable {
    struct Worker {
        address walletAddress;
        bytes32 metadataPointer; // Supabase UUID (keccak256 hashed)
        uint8 reputation; // 0-100
        bool isActive;
        uint256 registrationTime;
    }

    mapping(address => Worker) public workers;

    // Whitelist the Escrow contract so it can call slash()
    address public escrowContract;

    event WorkerRegistered(address indexed worker, bytes32 metadata);
    event WorkerSlashed(
        address indexed worker,
        address indexed slasher,
        uint8 newScore
    );
    event WorkerBanned(address indexed worker);

    constructor() Ownable(msg.sender) {}

    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
    }

    /**
     * @notice Register as a new worker. Starts with 100 Reputation.
     */
    function register(bytes32 _metadataPointer) external {
        require(
            workers[msg.sender].walletAddress == address(0),
            "Already registered"
        );

        workers[msg.sender] = Worker({
            walletAddress: msg.sender,
            metadataPointer: _metadataPointer,
            reputation: 100,
            isActive: true,
            registrationTime: block.timestamp
        });

        emit WorkerRegistered(msg.sender, _metadataPointer);
    }

    /**
     * @notice Called by Escrow contract when a Master reports a fault.
     * Decreases score by 10. Bans if below 50.
     */
    function slashReputation(address _worker, address _slasher) external {
        require(msg.sender == escrowContract, "Only Escrow can slash");

        Worker storage w = workers[_worker];
        require(w.isActive, "Worker not active");

        if (w.reputation > 10) {
            w.reputation -= 10;
        } else {
            w.reputation = 0;
        }

        emit WorkerSlashed(_worker, _slasher, w.reputation);

        // Ban threshold
        if (w.reputation < 50) {
            w.isActive = false;
            emit WorkerBanned(_worker);
        }
    }

    function isWorkerActive(address _worker) external view returns (bool) {
        return workers[_worker].isActive;
    }
}
