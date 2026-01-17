"use client"

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'

export function ConnectWalletButton() {
    const { address, isConnected } = useAccount()
    const { connect, connectors, isPending, error } = useConnect()
    const { disconnect } = useDisconnect()
    const [mounted, setMounted] = useState(false)

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true)
    }, [])

    // Return a placeholder during SSR to avoid hydration mismatch
    if (!mounted) {
        return (
            <button
                type="button"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold opacity-50"
                disabled
            >
                Connect Wallet
            </button>
        )
    }

    const handleConnect = () => {
        // Find the injected connector (MetaMask) from config
        const injectedConnector = connectors.find(c => c.id === 'injected')
        if (injectedConnector) {
            connect({ connector: injectedConnector })
        }
    }

    if (isConnected && address) {
        return (
            <button
                onClick={() => disconnect()}
                type="button"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold hover:border-zinc-600 transition-all duration-200 shadow-lg shadow-zinc-950/50"
            >
                {address.slice(0, 6)}...{address.slice(-4)}
            </button>
        )
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <button
                onClick={handleConnect}
                disabled={isPending}
                type="button"
                className="group relative px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold hover:border-zinc-600 transition-all duration-200 shadow-lg shadow-zinc-950/50 hover:shadow-zinc-900/50 disabled:opacity-50"
            >
                <span className="relative z-10">
                    {isPending ? 'Connecting...' : 'Connect Wallet'}
                </span>
            </button>
            {error && (
                <p className="text-red-400 text-xs max-w-xs text-right">{error.message}</p>
            )}
        </div>
    )
}
