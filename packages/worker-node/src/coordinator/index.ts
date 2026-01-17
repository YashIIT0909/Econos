/**
 * Coordinator Module Exports
 * 
 * Re-exports all coordinator components for easy importing.
 */

export { TaskCoordinator, getTaskCoordinator, registerAuthorization } from './taskCoordinator';
export { ContractService, getContractService, toBytes32, OnChainTaskStatus } from './contractService';
export type { OnChainTask, TaskCreatedEvent } from './contractService';
export { AuthorizationVerifier, getAuthorizationVerifier } from './authorizationVerifier';
export type { TaskAuthorization, TaskAuthorizationMessage, TaskPayload, AuthorizationResult } from './authorizationVerifier';
export { TaskStateManager, getTaskStateManager, TaskState } from './taskStateManager';
export type { TaskRecord, TaskStats } from './taskStateManager';
export { canonicalize, computeResultHash, prepareResult, verifyResultHash } from './resultCanonicalizer';
export type { ResultPayload } from './resultCanonicalizer';
