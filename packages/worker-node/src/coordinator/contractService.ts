/**
 * Contract Service (Gasless & Selector Compatible)
 * * Updates:
 * 1. Uses zksync-ethers for Paymaster support.
 * 2. ABI updated to use 'bytes' for submitWork and TaskCompleted.
 * 3. Encodes resultHash correctly to match the 0xcfdf46c7 selector.
 */

import { ethers, Wallet, Contract, JsonRpcProvider, EventLog } from 'ethers';
import { getContractAddresses } from '../config/contracts';
import { cronosConfig } from '../config/cronos';
import { logger } from '../utils/logger';

/**
 * NativeEscrow ABI
 * Updated to match your new Solidity contract: submitWork(bytes32, bytes)
 */
const ESCROW_ABI = [
    'event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount)',
    'event TaskCompleted(bytes32 indexed taskId, bytes result)',
    'function tasks(bytes32) view returns (address master, address worker, uint256 amount, uint256 deadline, uint8 status)',
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
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    private escrowContract: Contract;
    private registryContract: Contract;
    private workerAddress: string;

    constructor() {
        const addresses = getContractAddresses();

        console.log("---------------------------------------------------");
        console.log("🔍 DEBUG: Contract Service Initialization");
        console.log("   RPC URL:", cronosConfig.rpcUrl);
        console.log("   Escrow Address:", addresses.nativeEscrow);
        console.log("   Registry Address:", addresses.workerRegistry);
        console.log("   Worker Private Key Set?", !!process.env.WORKER_PRIVATE_KEY);
        console.log("---------------------------------------------------");
        // -----------------------------
        
        // 1. Initialize Standard EVM Provider (Cronos Testnet)
        this.provider = new JsonRpcProvider(cronosConfig.rpcUrl);

        // 2. Initialize Wallet (For SIGNING only, not paying gas)
        const privateKey = process.env.WORKER_PRIVATE_KEY;
        if (!privateKey) throw new Error('WORKER_PRIVATE_KEY is not set');
        
        this.wallet = new Wallet(privateKey, this.provider);
        this.workerAddress = this.wallet.address;

        // 3. Connect Contracts (Read-Only or Signing)
        this.escrowContract = new Contract(addresses.nativeEscrow, ESCROW_ABI, this.provider);
        this.registryContract = new Contract(addresses.workerRegistry, REGISTRY_ABI, this.provider);
    }
    getWallet(): Wallet {
        return this.wallet;
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
   
    async isWorkerActive(): Promise<boolean> {
        try {
            return await this.registryContract.isWorkerActive(this.workerAddress);
        } catch (error) {
            logger.error('Failed to check worker status', { error });
            return false;
        }
    }

    // In packages/worker-node/src/coordinator/contractService.ts

    onTaskCreated(callback: (event: TaskCreatedEvent) => void): () => void {
        let isRunning = true;
        let lastBlockChecked = 0;

        const pollEvents = async () => {
            if (!isRunning) return;

            try {
                const currentBlock = await this.provider.getBlockNumber();
                if (lastBlockChecked === 0) lastBlockChecked = currentBlock - 100;

                if (lastBlockChecked < currentBlock) {
                    const filter = this.escrowContract.filters.TaskCreated();
                    const events = await this.escrowContract.queryFilter(filter, lastBlockChecked + 1, currentBlock);

                    for (const event of events) {
                        if (event instanceof EventLog) {
                            const [taskId, master, worker, amount] = event.args;
                            if (worker.toLowerCase() === this.workerAddress.toLowerCase()) {
                                logger.info('👀 Polling found new task!', { taskId });
                                callback({ taskId, master, worker, amount });
                            }
                        }
                    }
                    lastBlockChecked = currentBlock;
                }
            } catch (error) { /* squelch */ }

            setTimeout(pollEvents, 3000);
        };

        logger.info('Started Task Polling (Robust Mode)', { worker: this.workerAddress });
        pollEvents();
        return () => { isRunning = false; };
    }

    /**
     * Listen for TaskCompleted events (Robust Polling Version)
     */
    onTaskCompleted(callback: (taskId: string, resultHash: string) => void): () => void {
        let isRunning = true;
        let lastBlockChecked = 0;

        const pollCompletion = async () => {
            if (!isRunning) return;
            try {
                const currentBlock = await this.provider.getBlockNumber();
                if (lastBlockChecked === 0) lastBlockChecked = currentBlock - 100;

                if (lastBlockChecked < currentBlock) {
                    const filter = this.escrowContract.filters.TaskCompleted();
                    const events = await this.escrowContract.queryFilter(filter, lastBlockChecked + 1, currentBlock);

                    for (const event of events) {
                        if (event instanceof EventLog) {
                            const [taskId, resultHash] = event.args;
                            callback(taskId, resultHash);
                        }
                    }
                    lastBlockChecked = currentBlock;
                }
            } catch (e) { /* squelch */ }
            setTimeout(pollCompletion, 3000);
        };

        pollCompletion();
        return () => { isRunning = false; };
    }

    getEscrowAddress(): string {
        return this.escrowContract.target as string;
    }

    getWorkerAddress(): string {
        return this.workerAddress;
    }
}

let instance: ContractService | null = null;
export function getContractService(): ContractService {
    if (!instance) instance = new ContractService();
    return instance;
}
export function toBytes32(id: string): string {
    return id.startsWith('0x') && id.length === 66 ? id : ethers.keccak256(ethers.toUtf8Bytes(id));
}