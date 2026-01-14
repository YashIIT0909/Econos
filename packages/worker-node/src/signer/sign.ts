import { ethers } from 'ethers';
import { getWorkerWallet } from '../config/cronos';
import { hashObject } from '../utils/hash';

/**
 * Payload to be signed
 */
export interface SignPayload {
    serviceName: string;
    requestId: string;
    responseHash: string;
    timestamp: number;
}

/**
 * Signed response structure
 */
export interface SignedResponse {
    signature: string;
    messageHash: string;
    signer: string;
}

/**
 * Create the message to be signed (EIP-191 personal message)
 */
function createSignMessage(payload: SignPayload): string {
    return JSON.stringify({
        serviceName: payload.serviceName,
        requestId: payload.requestId,
        responseHash: payload.responseHash,
        timestamp: payload.timestamp,
    });
}

/**
 * Sign a response using EIP-191 personal message signing
 * 
 * This creates a verifiable signature that binds:
 * - The service name
 * - The request ID
 * - The hash of the response data
 * - The timestamp
 * 
 * To the worker's on-chain identity.
 */
export async function signResponse(payload: SignPayload): Promise<SignedResponse> {
    const wallet = getWorkerWallet();
    const message = createSignMessage(payload);
    const messageHash = hashObject(payload);

    // Sign using EIP-191 (personal_sign)
    const signature = await wallet.signMessage(message);

    return {
        signature,
        messageHash,
        signer: wallet.address,
    };
}

/**
 * Sign inference output
 * 
 * Convenience function that takes raw output data and creates
 * a fully signed response ready for the client.
 */
export async function signInferenceOutput(
    serviceName: string,
    requestId: string,
    outputData: unknown,
    timestamp: number
): Promise<SignedResponse> {
    const responseHash = hashObject(outputData);

    return signResponse({
        serviceName,
        requestId,
        responseHash,
        timestamp,
    });
}
