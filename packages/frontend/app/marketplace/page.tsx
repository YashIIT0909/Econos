"use client"

import { useState } from "react"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Search, TrendingUp, Shield, Zap, Database, Brain, Activity } from "lucide-react"

// Mock agent data
const mockAgents = [
    {
        id: 1,
        name: "Risk Scoring Oracle",
        category: "Risk Analysis",
        description: "Advanced DeFi risk assessment using real-time market volatility analysis",
        price: "0.05 CRO",
        reputation: 4.8,
        status: "online",
        capabilities: ["Market Analysis", "Risk Scoring", "Volatility Prediction"],
        endpoint: "https://api.econos.network/risk-oracle"
    },
    {
        id: 2,
        name: "Sentiment Analyzer",
        category: "Market Intelligence",
        description: "Analyzes social sentiment across Twitter, Discord, and Telegram for crypto assets",
        price: "0.03 CRO",
        reputation: 4.9,
        status: "online",
        capabilities: ["Social Analysis", "Sentiment Scoring", "Trend Detection"],
        endpoint: "https://api.econos.network/sentiment"
    },
    {
        id: 3,
        name: "Portfolio Optimizer",
        category: "DeFi Strategy",
        description: "AI-powered portfolio rebalancing and yield optimization for Cronos DeFi",
        price: "0.08 CRO",
        reputation: 4.7,
        status: "online",
        capabilities: ["Portfolio Analysis", "Yield Optimization", "Rebalancing"],
        endpoint: "https://api.econos.network/optimizer"
    },
    {
        id: 4,
        name: "Gas Price Predictor",
        category: "Infrastructure",
        description: "Predicts optimal transaction timing based on network congestion patterns",
        price: "0.02 CRO",
        reputation: 4.6,
        status: "online",
        capabilities: ["Gas Prediction", "Network Analysis", "Timing Optimization"],
        endpoint: "https://api.econos.network/gas-oracle"
    },
    {
        id: 5,
        name: "Smart Contract Auditor",
        category: "Security",
        description: "Automated vulnerability detection and security scoring for smart contracts",
        price: "0.12 CRO",
        reputation: 5.0,
        status: "online",
        capabilities: ["Vulnerability Scan", "Security Audit", "Code Analysis"],
        endpoint: "https://api.econos.network/auditor"
    },
    {
        id: 6,
        name: "Liquidity Router",
        category: "DeFi Strategy",
        description: "Finds optimal liquidity pools and routing paths across Cronos DEXs",
        price: "0.06 CRO",
        reputation: 4.8,
        status: "offline",
        capabilities: ["DEX Routing", "Liquidity Analysis", "Price Impact Calc"],
        endpoint: "https://api.econos.network/router"
    },
]

const categoryIcon: Record<string, any> = {
    "Risk Analysis": TrendingUp,
    "Market Intelligence": Brain,
    "DeFi Strategy": Zap,
    "Infrastructure": Database,
    "Security": Shield,
}

export default function MarketplacePage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("All")

    const categories = ["All", ...Array.from(new Set(mockAgents.map(a => a.category)))]

    const filteredAgents = mockAgents.filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === "All" || agent.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />

            {/* Header */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="font-display text-4xl md:text-6xl font-bold text-zinc-100 mb-4">
                        Agent Marketplace
                    </h1>
                    <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-8">
                        Discover and integrate AI worker agents for your autonomous M2M applications
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-2xl mx-auto mb-8">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search agents by name or capability..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-full text-sm transition-all ${selectedCategory === category
                                        ? "bg-zinc-100 text-zinc-900 font-medium"
                                        : "bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Agent Grid */}
            <section className="pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAgents.map((agent) => {
                            const Icon = categoryIcon[agent.category] || Activity
                            return (
                                <div
                                    key={agent.id}
                                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group cursor-pointer"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                                            <Icon className="w-6 h-6 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-zinc-600"}`} />
                                            <span className="text-xs text-zinc-500">{agent.status}</span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-lg font-semibold text-zinc-100 mb-2 group-hover:text-white transition-colors">
                                        {agent.name}
                                    </h3>
                                    <p className="text-xs text-zinc-500 mb-3">{agent.category}</p>
                                    <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{agent.description}</p>

                                    {/* Capabilities */}
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {agent.capabilities.slice(0, 2).map((cap, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 rounded-md bg-zinc-800/50 text-xs text-zinc-400"
                                            >
                                                {cap}
                                            </span>
                                        ))}
                                        {agent.capabilities.length > 2 && (
                                            <span className="px-2 py-1 rounded-md bg-zinc-800/50 text-xs text-zinc-500">
                                                +{agent.capabilities.length - 2}
                                            </span>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                                        <div>
                                            <p className="text-xs text-zinc-600 mb-1">Price per call</p>
                                            <p className="text-lg font-semibold text-zinc-100">{agent.price}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 mb-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <svg
                                                        key={i}
                                                        className={`w-3 h-3 ${i < Math.floor(agent.reputation) ? "text-yellow-500" : "text-zinc-700"}`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                            </div>
                                            <p className="text-xs text-zinc-500">{agent.reputation} rating</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {filteredAgents.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-zinc-500">No agents found matching your criteria</p>
                        </div>
                    )}
                </div>
            </section>

            <FooterSection />
        </main>
    )
}
