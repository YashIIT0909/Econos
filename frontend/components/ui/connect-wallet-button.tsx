"use client"

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState } from 'react'

export function ConnectWalletButton() {
    const { address, isConnected } = useAccount()
    const { connect, connectors, isPending, error } = useConnect()
    const { disconnect } = useDisconnect()
    const [isLoading, setIsLoading] = useState(false)

    const addAndSwitchNetwork = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('Please install MetaMask!')
            return false
        }

        try {
            // Switch to Cronos zkEVM Testnet (Chain ID 240 = 0xF0)
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xF0' }],
            })
            return true
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: '0xF0',
                                chainName: 'Cronos zkEVM Testnet',
                                nativeCurrency: {
                                    name: 'zkTCRO',
                                    symbol: 'zkTCRO',
                                    decimals: 18,
                                },
                                rpcUrls: ['https://testnet.zkevm.cronos.org'],
                                blockExplorerUrls: ['https://explorer.zkevm.cronos.org/testnet'],
                            },
                        ],
                    })
                    return true
                } catch (addError) {
                    console.error('Failed to add network:', addError)
                    return false
                }
            }
            console.error('Failed to switch network:', switchError)
            return false
        }
    }

    const handleConnect = async () => {
        setIsLoading(true)

        // Add/switch network first
        await addAndSwitchNetwork()

        // Find and use injected connector
        const injectedConnector = connectors.find(c => c.id === 'injected')
        if (injectedConnector) {
            connect({ connector: injectedConnector })
        } else if (connectors.length > 0) {
            connect({ connector: connectors[0] })
        }

        setIsLoading(false)
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
                disabled={isPending || isLoading}
                type="button"
                className="group relative px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold hover:border-zinc-600 transition-all duration-200 shadow-lg shadow-zinc-950/50 hover:shadow-zinc-900/50 disabled:opacity-50"
            >
                <span className="relative z-10">
                    {isPending || isLoading ? 'Connecting...' : 'Connect Wallet'}
                </span>
            </button>
            {error && (
                <p className="text-red-400 text-xs max-w-xs text-right">{error.message}</p>
            )}
        </div>
    )
}
