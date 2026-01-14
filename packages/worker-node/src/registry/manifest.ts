import { getAllServices, ServiceConfig } from '../config/services';
import { cronosConfig, getWorkerAddress } from '../config/cronos';

/**
 * Service manifest entry exposed to consumers
 */
export interface ServiceManifestEntry {
    id: string;
    name: string;
    description: string;
    endpoint: string;
    priceWei: string;
    priceDisplay: string;
    version: string;
}

/**
 * Full worker manifest
 */
export interface WorkerManifest {
    worker: {
        address: string;
        network: string;
        chainId: number;
        rpcUrl: string;
        explorerUrl: string;
    };
    services: ServiceManifestEntry[];
    protocol: {
        name: string;
        version: string;
        paymentHeader: string;
        responseFormat: string;
    };
    timestamp: number;
}

/**
 * Convert internal service config to manifest entry
 */
function toManifestEntry(service: ServiceConfig): ServiceManifestEntry {
    return {
        id: service.id,
        name: service.name,
        description: service.description,
        endpoint: service.endpoint,
        priceWei: service.price.toString(),
        priceDisplay: service.priceDisplay,
        version: service.version,
    };
}

/**
 * Generate the full worker manifest
 * 
 * This manifest allows master agents to discover:
 * - Available services and their pricing
 * - Worker identity and payment address
 * - Network configuration for payments
 * - Protocol details for request/response handling
 */
export function generateManifest(): WorkerManifest {
    const services = getAllServices();

    return {
        worker: {
            address: getWorkerAddress(),
            network: cronosConfig.networkName,
            chainId: cronosConfig.chainId,
            rpcUrl: cronosConfig.rpcUrl,
            explorerUrl: cronosConfig.explorerUrl,
        },
        services: services.map(toManifestEntry),
        protocol: {
            name: 'Econos x402',
            version: '1.0.0',
            paymentHeader: 'X-Payment',
            responseFormat: 'signed-json',
        },
        timestamp: Math.floor(Date.now() / 1000),
    };
}
