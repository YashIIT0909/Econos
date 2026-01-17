/**
 * Contract Service (Gasless & Selector Compatible)
 * * Updates:
 * 1. Uses zksync-ethers for Paymaster support.
 * 2. ABI updated to use 'bytes' for submitWork and TaskCompleted.
 * 3. Encodes resultHash correctly to match the 0xcfdf46c7 selector.
 */

import { Provider, Wallet, Contract, utils } from 'zksync-ethers'; // CRITICAL: Use zksync-ethers
import { ethers } from 'ethers';
import { getWorkerAddress, cronosConfig } from '../config/cronos';
import { getContractAddresses } from '../config/contracts';
import { logger } from '../utils/logger';

/**
 * NativeEscrow ABI
 * Updated to match your new Solidity contract: submitWork(bytes32, bytes)
 */
const ESCROW_ABI = [
    'event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount)',
    // Updated Event: result is now 'bytes'
    'event TaskCompleted(bytes32 indexed taskId, bytes result)',
    'event TaskRefunded(bytes32 indexed taskId)',
    'function tasks(bytes32) view returns (address master, address worker, uint256 amount, uint256 deadline, uint8 status)',
    // Updated Function: _result is now 'bytes'
    // This matches selector 0xcfdf46c7 required by your Paymaster
    'function submitWork(bytes32 _taskId, bytes calldata _result) external',
];

const REGISTRY_ABI = [
    'function isWorkerActive(address _worker) view returns (bool)',
    'function workers(address) view returns (address walletAddress, bytes32 metadataPointer, uint8 reputation, bool isActive, uint256 registrationTime)',
];

export enum OnChainTaskStatus {
    OPEN = 0,
    COMPLETED = 1,
    DISPUTED = 2,
    REFUNDED = 3,
}

export interface OnChainTask {
    master: string;
    worker: string;
    amount: bigint;
    deadline: number;
    status: OnChainTaskStatus;
}

export interface TaskCreatedEvent {
    taskId: string;
    master: string;
    worker: string;
    amount: bigint;
}

export class ContractService {
    private provider: Provider;
    private wallet: Wallet;
    private escrowContract: Contract;
    private registryContract: Contract;
    private workerAddress: string;

    constructor() {
        const addresses = getContractAddresses();
        
        // 1. Initialize zkSync Provider
        this.provider = new Provider(cronosConfig.rpcUrl);

        // 2. Initialize zkSync Wallet (Required for EIP-712 signing)
        const privateKey = process.env.WORKER_PRIVATE_KEY;
        if (!privateKey) throw new Error('WORKER_PRIVATE_KEY is not set');
        
        this.wallet = new Wallet(privateKey, this.provider);
        this.workerAddress = this.wallet.address;

        // 3. Connect Escrow Contract to zkSync Wallet
        this.escrowContract = new Contract(
            addresses.nativeEscrow,
            ESCROW_ABI,
            this.wallet 
        );

        this.registryContract = new Contract(
            addresses.workerRegistry,
            REGISTRY_ABI,
            this.provider
        );
    }

    async getTask(taskIdBytes32: string): Promise<OnChainTask | null> {
        try {
            const result = await this.escrowContract.tasks(taskIdBytes32);
            if (result.amount === 0n) return null;

            return {
                master: result.master,
                worker: result.worker,
                amount: result.amount,
                deadline: Number(result.deadline),
                status: Number(result.status) as OnChainTaskStatus,
            };
        } catch (error) {
            logger.error('Failed to get task from chain', { taskId: taskIdBytes32, error });
            return null;
        }
    }

    async isTaskValid(taskIdBytes32: string): Promise<boolean> {
        const task = await this.getTask(taskIdBytes32);
        if (!task) return false;

        const now = Math.floor(Date.now() / 1000);
        return (
            task.status === OnChainTaskStatus.OPEN &&
            task.deadline > now &&
            task.worker.toLowerCase() === this.workerAddress.toLowerCase()
        );
    }

    /**
     * Submit work result via Paymaster (Gasless)
     */
    async submitWork(taskIdBytes32: string, resultHash: string): Promise<string> {
        logger.info('Submitting work on-chain (Gasless)', { taskId: taskIdBytes32, resultHash });

        const addresses = getContractAddresses();

        try {
            // 1. Construct Paymaster Params (General Flow)
            const paymasterParams = utils.getPaymasterParams(addresses.paymaster, {
                type: 'General',
                innerInput: new Uint8Array(),
            });

            // 2. Convert result string to bytes
            // Since the contract expects 'bytes', we encode the string.
            const resultBytes = ethers.toUtf8Bytes(resultHash);

            // 3. Send Transaction with customData
            const tx = await this.escrowContract.submitWork(taskIdBytes32, resultBytes, {
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParams,
                },
            });

            logger.info('submitWork transaction sent', { txHash: tx.hash });

            const receipt = await tx.wait();

            logger.info('submitWork confirmed', {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(), // Should be 0 cost to worker wallet
            });

            return receipt.hash;
        } catch (error) {
            logger.error('Failed to submit work', { taskId: taskIdBytes32, error });
            throw error;
        }
    }

    async isWorkerActive(): Promise<boolean> {
        try {
            return await this.registryContract.isWorkerActive(this.workerAddress);
        } catch (error) {
            logger.error('Failed to check worker status', { error });
            return false;
        }
    }

    onTaskCreated(callback: (event: TaskCreatedEvent) => void): () => void {
        const filter = this.escrowContract.filters.TaskCreated(null, null, this.workerAddress);

        const handler = (taskId: string, master: string, worker: string, amount: bigint) => {
            if (worker.toLowerCase() === this.workerAddress.toLowerCase()) {
                callback({ taskId, master, worker, amount });
            }
        };

        this.escrowContract.on(filter, handler);
        logger.info('Subscribed to TaskCreated events', { worker: this.workerAddress });

        return () => {
            this.escrowContract.off(filter, handler);
        };
    }

    onTaskCompleted(callback: (taskId: string, resultHash: string) => void): () => void {
        // Listener must interpret the 'bytes' result back to string
        const handler = (taskId: string, resultBytes: string) => {
            try {
                // Try to decode bytes back to utf8 string
                const resultStr = ethers.toUtf8String(resultBytes);
                callback(taskId, resultStr);
            } catch (e) {
                // Fallback if it's raw hex
                callback(taskId, resultBytes);
            }
        };

        this.escrowContract.on('TaskCompleted', handler);

        return () => {
            this.escrowContract.off('TaskCompleted', handler);
        };
    }

    getEscrowAddress(): string {
        return this.escrowContract.target as string;
    }

    getWorkerAddress(): string {
        return this.workerAddress;
    }
}

let contractServiceInstance: ContractService | null = null;

export function getContractService(): ContractService {
    if (!contractServiceInstance) {
        contractServiceInstance = new ContractService();
    }
    return contractServiceInstance;
}

export function toBytes32(taskId: string): string {
    if (taskId.startsWith('0x') && taskId.length === 66) {
        return taskId;
    }
    return ethers.keccak256(ethers.toUtf8Bytes(taskId));
}