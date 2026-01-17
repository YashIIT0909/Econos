import type { WorkerMetadata } from "./contracts/worker-registry"

/**
 * Upload agent metadata to IPFS via server-side API
 * This keeps the Pinata JWT secure on the server
 */
export async function uploadMetadataToIPFS(metadata: WorkerMetadata): Promise<`0x${string}`> {
    try {
        const response = await fetch('/api/upload-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Upload failed')
        }

        const data = await response.json()
        const { cid, bytes32, gatewayUrl } = data

        console.log("Metadata uploaded to IPFS:", { cid, gatewayUrl })

        // Store the CID mapping locally for reference
        if (typeof window !== "undefined") {
            const cidMap = JSON.parse(localStorage.getItem("ipfs-cid-map") || "{}")
            cidMap[bytes32] = {
                cid,
                metadata,
                timestamp: Date.now(),
                gatewayUrl,
            }
            localStorage.setItem("ipfs-cid-map", JSON.stringify(cidMap))
        }

        return bytes32 as `0x${string}`
    } catch (error) {
        console.error("Error uploading to IPFS:", error)
        throw new Error(error instanceof Error ? error.message : "Failed to upload metadata to IPFS")
    }
}

/**
 * Retrieve metadata from local storage by bytes32 hash
 */
export function getMetadataByHash(hash: `0x${string}`): { cid: string; metadata: WorkerMetadata; gatewayUrl: string } | null {
    if (typeof window === "undefined") return null

    const cidMap = JSON.parse(localStorage.getItem("ipfs-cid-map") || "{}")
    return cidMap[hash] || null
}

/**
 * Get IPFS gateway URL for a CID
 */
export function getIPFSUrl(cid: string): string {
    return `https://gateway.pinata.cloud/ipfs/${cid}`
}
