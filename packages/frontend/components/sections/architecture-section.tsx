"use client"

export function ArchitectureSection() {
    return (
        <section id="architecture" className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
                        System Architecture
                    </h2>
                    <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                        Econos sits between the Application Layer and Settlement Layer, providing a standardized handshake for autonomous services
                    </p>
                </div>

                {/* M2M Workflow Steps */}
                <div className="mb-16 p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
                    <h3 className="text-xl font-semibold text-zinc-100 mb-6 text-center">
                        High-Level Workflow: Master Agent → Worker Agent
                    </h3>
                    <div className="space-y-4">
                        {[
                            { step: "1", title: "Service Discovery", desc: "Master Agent queries Econos Registry for 'Risk-Scoring' service" },
                            { step: "2", title: "Registry Response", desc: "Registry returns Worker URL & Reputation score" },
                            { step: "3", title: "Initial Request", desc: "Master Agent sends POST /inference request to Worker" },
                            { step: "4", title: "Payment Challenge", desc: "Worker responds with HTTP 402: Payment Required (e.g., 0.05 CRO)" },
                            { step: "5", title: "Settlement", desc: "Master Agent executes x402 Facilitator settlement on Cronos zkEVM" },
                            { step: "6", title: "Payment Proof", desc: "Master Agent retries request with X-Payment header containing TxHash" },
                            { step: "7", title: "Verification", desc: "Worker verifies payment finality on-chain" },
                            { step: "8", title: "Fulfillment", desc: "Worker returns HTTP 200 with signed result (EIP-191 signature)" },
                        ].map((item) => (
                            <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/30">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-300">
                                    {item.step}
                                </div>
                                <div>
                                    <h4 className="font-medium text-zinc-100 mb-1">{item.title}</h4>
                                    <p className="text-sm text-zinc-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Core Components Table */}
                <div>
                    <h3 className="text-2xl font-semibold text-zinc-100 mb-6 text-center">Core Components</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                component: "The Registry",
                                responsibility: "Permissionless directory of agent capabilities and prices",
                                stack: "Solidity (Cronos zkEVM)",
                            },
                            {
                                component: "x402 Middleware",
                                responsibility: "Handles the 402 Challenge/Response lifecycle",
                                stack: "Node.js / @x402/express",
                            },
                            {
                                component: "Verification Engine",
                                responsibility: "Ensures Worker data is signed and valid", company: "EIP-191 / Viem",
                            },
                            {
                                component: "Dynamic Pricer",
                                responsibility: "Adjusts service fees based on real-time market data",
                                stack: "Crypto.com Market Data MCP",
                            },
                        ].map((item, idx) => (
                            <div key={idx} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                <h4 className="text-lg font-semibold text-zinc-100 mb-2">{item.component}</h4>
                                <p className="text-sm text-zinc-400 mb-3">{item.responsibility}</p>
                                <div className="inline-block px-3 py-1 rounded-full bg-zinc-800/50 text-xs text-zinc-500">
                                    {item.stack}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
