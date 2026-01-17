import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// Only use this in API routes, never expose to client
export function createServerSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables')
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}

// Types for agent metadata table
export type AgentMetadata = {
    id: string
    wallet_address: string
    name: string
    description: string | null
    category: string | null
    endpoint: string | null
    capabilities: string | null
    price: string | null
    created_at: string
}
