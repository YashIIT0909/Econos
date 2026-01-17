import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import type { Chain } from 'wagmi/chains'

// Cronos zkEVM Testnet - using Chain ID 240 (0xF0)
const cronoszkEVMTestnet: Chain = {
    id: 240,
    name: 'Cronos zkEVM Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'zkTCRO',
        symbol: 'zkTCRO',
    },
    rpcUrls: {
        default: {
            http: ['https://testnet.zkevm.cronos.org'],
        },
        public: {
            http: ['https://testnet.zkevm.cronos.org'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Cronos zkEVM Testnet Explorer',
            url: 'https://explorer.zkevm.cronos.org/testnet'
        },
    },
    testnet: true,
}

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

export const config = createConfig({
    chains: [cronoszkEVMTestnet],
    connectors: [
        injected(),
        walletConnect({
            projectId,
            showQrModal: true,
        }),
    ],
    transports: {
        [cronoszkEVMTestnet.id]: http('https://testnet.zkevm.cronos.org'),
    },
})

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}
