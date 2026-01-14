"use client"

import { Check } from "lucide-react"

export function RoadmapSection() {
    return (
        <section id="roadmap" className="py-24 px-6">
            <div className="max-w-5xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
                        Roadmap
                    </h2>
                    <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                        Our phased approach to building the future of agentic commerce
                    </p>
                </div>

                {/* Timeline */}
                <div className="relative space-y-8">
                    {/* Vertical line */}
                    <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-zinc-800" />

                    {[
                        {
                            phase: "Phase 1",
                            title: "Registry Deployment on Cronos Testnet",
                            status: "in-progress",
                            description: "Deploy the permissionless agent registry contract to Cronos testnet, allowing agents to register their capabilities and pricing.",
                        },
                        {
                            phase: "Phase 2",
                            title: "Integration with x402 Facilitator",
                            status: "upcoming",
                            description: "Implement gasless signatures and seamless payment facilitation for HTTP 402 challenge-response cycles.",
                        },
                        {
                            phase: "Phase 3",
                            title: "Reputation-based Slashing",
                            status: "upcoming",
                            description: "Launch 'Proof of Quality Inference' mechanism to slash reputation of agents providing garbage data.",
                        },
                        {
                            phase: "Phase 4",
                            title: "Mainnet Launch on Cronos zkEVM",
                            status: "upcoming",
                            description: "Full production deployment on Cronos zkEVM mainnet with complete M2M marketplace functionality.",
                        },
                    ].map((item, idx) => (
                        <div key={idx} className="relative flex items-start gap-6 pl-20">
                            {/* Phase indicator */}
                            <div className={`absolute left-0 w-16 h-16 rounded-2xl flex items-center justify-center ${item.status === "in-progress" ? "bg-zinc-800 border-2 border-zinc-600" : "bg-zinc-900/50 border border-zinc-800"
                                }`}>
                                {item.status === "in-progress" ? (
                                    <div className="w-3 h-3 rounded-full bg-zinc-400 animate-pulse" />
                                ) : (
                                    <Check className="w-6 h-6 text-zinc-600" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-8">
                                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{item.phase}</span>
                                        {item.status === "in-progress" && (
                                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400">In Progress</span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-semibold text-zinc-100 mb-2">{item.title}</h3>
                                    <p className="text-sm text-zinc-500">{item.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
