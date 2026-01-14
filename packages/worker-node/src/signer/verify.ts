import { ethers } from 'ethers';
import { SignPayload } from './sign';

/**
 * Verify an EIP-191 signature and recover the signer
 * 
 * @param payload - The original payload that was signed
 * @param signature - The EIP-191 signature
 * @returns The recovered signer address
 */
export function recoverSigner(payload: SignPayload, signature: string): string {
    const message = JSON.stringify({
        serviceName: payload.serviceName,
        requestId: payload.requestId,
        responseHash: payload.responseHash,
        timestamp: payload.timestamp,
    });

    // Recover the signer from the personal_sign signature
    return ethers.verifyMessage(message, signature);
}

/**
 * Verify that a signature was created by the expected signer
 * 
 * @param payload - The original payload that was signed
 * @param signature - The EIP-191 signature
 * @param expectedSigner - The expected signer address
 * @returns True if signature is valid and matches expected signer
 */
export function verifySignature(
    payload: SignPayload,
    signature: string,
    expectedSigner: string
): boolean {
    try {
        const recoveredSigner = recoverSigner(payload, signature);
        return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
    } catch {
        return false;
    }
}

/**
 * Verify a signed inference response
 * 
 * @param response - The full response object from the worker
 * @param expectedWorker - The expected worker address
 * @returns Verification result with details
 */
export function verifyInferenceResponse(
    response: {
        data: unknown;
        signature: string;
        requestId: string;
        worker: string;
        timestamp: number;
        serviceName: string;
        responseHash: string;
    },
    expectedWorker: string
): { valid: boolean; error?: string; recoveredSigner?: string } {
    try {
        const payload: SignPayload = {
            serviceName: response.serviceName,
            requestId: response.requestId,
            responseHash: response.responseHash,
            timestamp: response.timestamp,
        };

        const recoveredSigner = recoverSigner(payload, response.signature);

        if (recoveredSigner.toLowerCase() !== expectedWorker.toLowerCase()) {
            return {
                valid: false,
                error: `Signer mismatch. Expected: ${expectedWorker}, Got: ${recoveredSigner}`,
                recoveredSigner,
            };
        }

        return {
            valid: true,
            recoveredSigner,
        };
    } catch (error) {
        return {
            valid: false,
            error: `Signature verification failed: ${error}`,
        };
    }
}
