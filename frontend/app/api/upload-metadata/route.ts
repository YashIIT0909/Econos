import { NextRequest, NextResponse } from 'next/server'
import { PinataSDK } from 'pinata-web3'
import { keccak256, toBytes } from 'viem'

// Initialize Pinata with server-side JWT (NOT exposed to client)
const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
})

export async function POST(request: NextRequest) {
    try {
        const metadata = await request.json()

        // Validate metadata
        if (!metadata.name || !metadata.description || !metadata.category) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Upload to IPFS
        const upload = await pinata.upload.json(metadata)
        const cid = upload.IpfsHash

        console.log('Metadata uploaded to IPFS:', cid)

        // Convert CID to bytes32 using keccak256
        const cidBytes32 = keccak256(toBytes(cid))

        return NextResponse.json({
            success: true,
            cid,
            bytes32: cidBytes32,
            gatewayUrl: `https://${process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'}/ipfs/${cid}`
        })

    } catch (error) {
        console.error('IPFS upload error:', error)
        return NextResponse.json(
            { error: 'Failed to upload metadata to IPFS', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
