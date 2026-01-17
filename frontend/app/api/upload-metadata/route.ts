import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { keccak256, toBytes, pad } from 'viem'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { metadata, walletAddress } = body

        // Validate input
        if (!metadata?.name || !metadata?.description || !metadata?.category) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            )
        }

        // Initialize Supabase client
        const supabase = createServerSupabaseClient()

        // Insert metadata into Supabase
        const { data, error } = await supabase
            .from('agent_metadata')
            .insert({
                wallet_address: walletAddress,
                name: metadata.name,
                description: metadata.description,
                category: metadata.category,
                endpoint: metadata.endpoint || null,
                capabilities: metadata.capabilities || null,
                price: metadata.price || null,
            })
            .select('id')
            .single()

        if (error) {
            console.error('Supabase insert error:', error)
            return NextResponse.json(
                { error: 'Failed to save metadata', details: error.message },
                { status: 500 }
            )
        }

        const uuid = data.id
        console.log('Metadata saved to Supabase:', uuid)

        // Convert UUID to bytes32 for contract storage
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
        // Remove dashes and convert to bytes, then hash for consistent bytes32
        const uuidBytes = toBytes(`0x${uuid.replace(/-/g, '')}`)
        const bytes32 = keccak256(uuidBytes)

        return NextResponse.json({
            success: true,
            id: uuid,
            bytes32,
        })

    } catch (error) {
        console.error('Metadata upload error:', error)
        return NextResponse.json(
            { error: 'Failed to save metadata', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
