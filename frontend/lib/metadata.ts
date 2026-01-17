import type { WorkerMetadata } from "./contracts/worker-registry"

/**
 * Upload agent metadata to Supabase via server-side API
 */
export async function uploadMetadata(
    metadata: WorkerMetadata,
    walletAddress: string
): Promise<`0x${string}`> {
    try {
        const response = await fetch('/api/upload-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ metadata, walletAddress }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Upload failed')
        }

        const data = await response.json()
        const { id, bytes32 } = data

        console.log("Metadata saved to Supabase:", { id, bytes32 })

        // Store the ID mapping locally for reference
        if (typeof window !== "undefined") {
            const metadataMap = JSON.parse(localStorage.getItem("metadata-id-map") || "{}")
            metadataMap[bytes32] = {
                id,
                metadata,
                timestamp: Date.now(),
            }
            localStorage.setItem("metadata-id-map", JSON.stringify(metadataMap))
        }

        return bytes32 as `0x${string}`
    } catch (error) {
        console.error("Error saving metadata:", error)
        throw new Error(error instanceof Error ? error.message : "Failed to save metadata")
    }
}

/**
 * Fetch agent metadata by ID from Supabase
 */
export async function fetchMetadataById(id: string): Promise<WorkerMetadata | null> {
    try {
        const response = await fetch(`/api/fetch-metadata?id=${encodeURIComponent(id)}`)

        if (!response.ok) {
            if (response.status === 404) return null
            const error = await response.json()
            throw new Error(error.error || 'Fetch failed')
        }

        const data = await response.json()
        return data.metadata as WorkerMetadata
    } catch (error) {
        console.error("Error fetching metadata:", error)
        return null
    }
}

/**
 * Retrieve metadata from local storage by bytes32 hash
 */
export function getMetadataByHash(hash: `0x${string}`): { id: string; metadata: WorkerMetadata } | null {
    if (typeof window === "undefined") return null

    const metadataMap = JSON.parse(localStorage.getItem("metadata-id-map") || "{}")
    return metadataMap[hash] || null
}
