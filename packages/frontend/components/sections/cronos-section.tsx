"use client"

export function CronosSection() {
    return (
        <section id="cronos" className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
                        Why Cronos zkEVM?
                    </h2>
                    <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                        The perfect infrastructure for Machine-to-Machine commerce at scale
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                            <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-zinc-100 mb-3">Sub-Cent Gas Fees</h3>
                        <p className="text-zinc-500 leading-relaxed">
                            M2M commerce requires payments of $0.01 or less. Cronos zkEVM's 10x gas reduction makes this economically viable for micro-transactions.
                        </p>
                    </div>

                    <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                            <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-zinc-100 mb-3">Instant Finality</h3>
                        <p className="text-zinc-500 leading-relaxed">
                            Agents cannot wait 10 minutes for a bank transfer. ZK-Rollup finality ensures the M2M handshake happens in seconds, not minutes.
                        </p>
                    </div>

                    <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                            <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-zinc-100 mb-3">Ecosystem Synergy</h3>
                        <p className="text-zinc-500 leading-relaxed">
                            Direct integration with VVS Finance, Moonlander, and the Crypto.com MCP provides immediate utility for agentic traders and DeFi automation.
                        </p>
                    </div>
                </div>

                {/* Integration Partners */}
                <div className="mt-16 p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/30">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4 text-center">Integrated with Cronos Ecosystem</h3>
                    <div className="flex flex-wrap justify-center gap-6 items-center">
                        <div className="px-6 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                            <span className="text-zinc-400 font-medium">VVS Finance</span>
                        </div>
                        <div className="px-6 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                            <span className="text-zinc-400 font-medium">Moonlander</span>
                        </div>
                        <div className="px-6 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                            <span className="text-zinc-400 font-medium">Crypto.com MCP</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
