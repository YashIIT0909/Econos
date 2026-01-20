import { WorkerIndexer } from '../worker-selection/indexer';
import { WorkerWithMetadata, WorkerManifest } from '../types/worker';
import { ServiceCapability, CapabilitySummary } from '../types/pipeline';
import { logger } from '../utils/logger';

// Supabase URL for fetching agent metadata
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmbqxdlzfktohtakeyxo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Capability Discovery Service
 * 
 * Discovers and aggregates service capabilities from all registered workers.
 * Used by the Task Analyzer to understand what services are available.
 */
export class CapabilityDiscovery {
    private indexer: WorkerIndexer;
    private knownWorkers: Map<string, string> = new Map(); // address -> endpoint
    private cachedCapabilities: CapabilitySummary | null = null;
    private cacheValidityMs: number = 60000; // 1 minute

    constructor() {
        this.indexer = new WorkerIndexer();
    }

    /**
     * Register a known worker with endpoint
     */
    addWorker(address: string, endpoint: string): void {
        this.knownWorkers.set(address.toLowerCase(), endpoint);
        this.invalidateCache();
    }

    /**
     * Remove a worker
     */
    removeWorker(address: string): void {
        this.knownWorkers.delete(address.toLowerCase());
        this.invalidateCache();
    }

    /**
     * Invalidate the capability cache
     */
    private invalidateCache(): void {
        this.cachedCapabilities = null;
    }

    /**
     * Check if cache is valid
     */
    private isCacheValid(): boolean {
        if (!this.cachedCapabilities) return false;
        const age = Date.now() - this.cachedCapabilities.updatedAt * 1000;
        return age < this.cacheValidityMs;
    }

    /**
     * Fetch agent metadata from Supabase by their bytes32 IDs
     */
    private async fetchAgentsFromSupabase(metadataPointers: string[]): Promise<Map<string, any>> {
        const agentMap = new Map<string, any>();

        if (!SUPABASE_URL || metadataPointers.length === 0) {
            return agentMap;
        }

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/agents?id=in.(${metadataPointers.map(p => `"${p}"`).join(',')})`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
            });

            if (response.ok) {
                const agents = await response.json() as Array<{ wallet_address?: string;[key: string]: unknown }>;
                for (const agent of agents) {
                    agentMap.set(agent.wallet_address?.toLowerCase() || '', agent);
                }
            }
        } catch (error) {
            logger.warn('Failed to fetch agents from Supabase', { error: String(error) });
        }

        return agentMap;
    }

    /**
     * Discover workers from the contract and fetch their capabilities
     */
    async discoverFromContract(): Promise<void> {
        try {
            logger.info('Discovering workers from contract...');
            const contractWorkers = await this.indexer.getAllWorkersFromContract();

            for (const worker of contractWorkers) {
                // Try to get endpoint from Supabase metadata or use default
                // For now, we'll need endpoints to be provided or discovered
                logger.info('Found contract worker', {
                    address: worker.address,
                    metadataPointer: worker.metadataPointer
                });
            }

            logger.info('Contract discovery complete', { count: contractWorkers.length });
        } catch (error) {
            logger.warn('Failed to discover from contract', { error: String(error) });
        }
    }

    /**
     * Discover all capabilities from registered workers
     */
    async discoverCapabilities(): Promise<CapabilitySummary> {
        // Return cached if valid
        if (this.isCacheValid() && this.cachedCapabilities) {
            return this.cachedCapabilities;
        }

        logger.info('Discovering worker capabilities', {
            workerCount: this.knownWorkers.size,
        });

        // If no known workers, try to discover from contract
        if (this.knownWorkers.size === 0) {
            await this.discoverFromContract();
        }

        const services: ServiceCapability[] = [];
        const serviceTypesSet = new Set<string>();

        // Fetch manifests from all known workers
        for (const [address, endpoint] of this.knownWorkers) {
            try {
                const manifest = await this.fetchManifest(endpoint);
                if (manifest) {
                    // Extract services from manifest
                    for (const service of manifest.services) {
                        services.push({
                            serviceId: service.id,
                            name: service.name,
                            description: service.description,
                            priceWei: service.priceWei,
                            workerAddress: address,
                            workerEndpoint: endpoint,
                        });
                        serviceTypesSet.add(service.id);
                    }
                }
            } catch (error) {
                logger.warn('Failed to fetch manifest from worker', {
                    address,
                    endpoint,
                    error: String(error),
                });
            }
        }

        // Create text summary for Gemini
        const textSummary = this.createTextSummary(services);

        const summary: CapabilitySummary = {
            services,
            availableServiceTypes: Array.from(serviceTypesSet),
            textSummary,
            updatedAt: Math.floor(Date.now() / 1000),
        };

        this.cachedCapabilities = summary;

        logger.info('Capability discovery complete', {
            totalServices: services.length,
            serviceTypes: summary.availableServiceTypes,
        });

        return summary;
    }

    /**
     * Fetch worker manifest
     */
    private async fetchManifest(endpoint: string): Promise<WorkerManifest | null> {
        try {
            const response = await fetch(`${endpoint}/manifest`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                return null;
            }

            return await response.json() as WorkerManifest;
        } catch (error) {
            logger.debug('Manifest fetch failed', { endpoint, error });
            return null;
        }
    }

    /**
     * Create human-readable summary for Gemini
     */
    private createTextSummary(services: ServiceCapability[]): string {
        if (services.length === 0) {
            return 'No services currently available from registered workers.';
        }

        const lines: string[] = ['Available AI services from registered workers:'];

        // Group by service type
        const byType = new Map<string, ServiceCapability[]>();
        for (const service of services) {
            const existing = byType.get(service.serviceId) || [];
            existing.push(service);
            byType.set(service.serviceId, existing);
        }

        for (const [serviceType, providers] of byType) {
            const cheapest = providers.reduce((a, b) =>
                BigInt(a.priceWei) < BigInt(b.priceWei) ? a : b
            );

            lines.push(`\n- ${serviceType}:`);
            lines.push(`  Description: ${cheapest.description}`);
            lines.push(`  Available from ${providers.length} worker(s)`);
            lines.push(`  Price range: ${this.formatPrice(cheapest.priceWei)} - ${this.formatPrice(providers.reduce((a, b) => BigInt(a.priceWei) > BigInt(b.priceWei) ? a : b).priceWei)}`);
        }

        return lines.join('\n');
    }

    /**
     * Format price in wei to readable format
     */
    private formatPrice(priceWei: string): string {
        const wei = BigInt(priceWei);
        const eth = Number(wei) / 1e18;
        return `${eth.toFixed(4)} zkTCRO`;
    }

    /**
     * Find workers that offer a specific service
     */
    findWorkersForService(serviceType: string): ServiceCapability[] {
        if (!this.cachedCapabilities) {
            return [];
        }

        return this.cachedCapabilities.services.filter(
            s => s.serviceId === serviceType
        );
    }

    /**
     * Get cheapest worker for a service
     */
    getCheapestWorkerForService(serviceType: string): ServiceCapability | null {
        const workers = this.findWorkersForService(serviceType);
        if (workers.length === 0) return null;

        return workers.reduce((a, b) =>
            BigInt(a.priceWei) < BigInt(b.priceWei) ? a : b
        );
    }

    /**
     * Check if a service type is available
     */
    isServiceAvailable(serviceType: string): boolean {
        if (!this.cachedCapabilities) return false;
        return this.cachedCapabilities.availableServiceTypes.includes(serviceType);
    }

    /**
     * Get all known workers
     */
    getKnownWorkers(): Map<string, string> {
        return new Map(this.knownWorkers);
    }

    /**
     * Set cache validity duration
     */
    setCacheValidity(ms: number): void {
        this.cacheValidityMs = ms;
    }
}
