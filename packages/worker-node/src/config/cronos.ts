import { ethers } from 'ethers';

/**
 * Cronos zkEVM Testnet Configuration
 */
export const cronosConfig = {
    rpcUrl: process.env.CRONOS_RPC_URL || 'https://338.rpc.thirdweb.com/7bd99c672d1088111d153b91a2e1112d',
    chainId: parseInt(process.env.CRONOS_CHAIN_ID || '338', 10),
    blockConfirmations: parseInt(process.env.BLOCK_CONFIRMATIONS || '2', 10),
    networkName: 'Cronos EVM Testnet (T3)',
    currencySymbol: 'TCRO',
    explorerUrl: 'https://explorer.zkevm.cronos.org/testnet',
};

/**
 * Create a read-only provider for Cronos zkEVM
 */
export function getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(cronosConfig.rpcUrl, {
        chainId: cronosConfig.chainId,
        name: cronosConfig.networkName,
    });
}

/**
 * Create a signer wallet for the worker
 */
export function getWorkerWallet(): ethers.Wallet {
    const privateKey = process.env.WORKER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('WORKER_PRIVATE_KEY is not set in environment variables');
    }
    return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Get the worker's address
 */
export function getWorkerAddress(): string {
    const address = process.env.WORKER_ADDRESS;
    if (!address) {
        throw new Error('WORKER_ADDRESS is not set in environment variables');
    }
    return address;
}
