import { ethers } from 'ethers';

/**
 * Hash a string using keccak256
 */
export function keccak256(data: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
}

/**
 * Hash an object by JSON stringifying it first
 */
export function hashObject(obj: unknown): string {
    const jsonString = JSON.stringify(obj, Object.keys(obj as object).sort());
    return keccak256(jsonString);
}

/**
 * Create a response hash for signing
 * Combines service name, request ID, response data, and timestamp
 */
export function createResponseHash(
    serviceName: string,
    requestId: string,
    responseData: unknown,
    timestamp: number
): string {
    const payload = {
        serviceName,
        requestId,
        responseHash: hashObject(responseData),
        timestamp,
    };
    return hashObject(payload);
}
