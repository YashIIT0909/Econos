import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, type AgentMetadata } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Missing id parameter' },
                { status: 400 }
            )
        }

        const supabase = createServerSupabaseClient()

        const { data, error } = await supabase
            .from('agent_metadata')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Metadata not found' },
                    { status: 404 }
                )
            }
            console.error('Supabase fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch metadata', details: error.message },
                { status: 500 }
            )
        }

        const agentData = data as AgentMetadata

        return NextResponse.json({
            success: true,
            metadata: {
                name: agentData.name,
                description: agentData.description,
                category: agentData.category,
                endpoint: agentData.endpoint,
                capabilities: agentData.capabilities,
                price: agentData.price,
            },
            walletAddress: agentData.wallet_address,
            createdAt: agentData.created_at,
        })

    } catch (error) {
        console.error('Metadata fetch error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch metadata', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
