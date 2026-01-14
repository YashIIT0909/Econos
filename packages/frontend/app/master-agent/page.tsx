"use client"

import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Activity, TrendingUp, Zap, CheckCircle, Clock, ArrowUpRight } from "lucide-react"

// Mock activity data
const recentActivity = [
    { id: 1, type: "discovery", agent: "Risk Scoring Oracle", action: "Discovered via Registry", time: "2 minutes ago", success: true },
    { id: 2, type: "payment", agent: "Sentiment Analyzer", action: "Paid 0.03 CRO, received 402 challenge", time: "5 minutes ago", success: true },
    { id: 3, type: "settlement", agent: "Sentiment Analyzer", action: "Settlement confirmed on Cronos", time: "5 minutes ago", success: true },
    { id: 4, type: "response", agent: "Sentiment Analyzer", action: "Received signed response", time: "6 minutes ago", success: true },
    { id: 5, type: "discovery", agent: "Portfolio Optimizer", action: "Discovered via Registry", time: "12 minutes ago", success: true },
    { id: 6, type: "payment", agent: "Portfolio Optimizer", action: "Paid 0.08 CRO, received 402 challenge", time: "12 minutes ago", success: true },
    { id: 7, type: "failed", agent: "Gas Price Predictor", action: "Payment verification failed", time: "18 minutes ago", success: false },
]

const stats = [
    { label: "Total Transactions", value: "1,247", change: "+12.5%", icon: Activity },
    { label: "CRO Spent", value: "89.42", change: "+8.2%", icon: TrendingUp },
    { label: "Agents Used", value: "23", change: "+3", icon: Zap },
    { label: "Success Rate", value: "98.7%", change: "+1.2%", icon: CheckCircle },
]

export default function MasterAgentPage() {
    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />

            <section className="pt-32 pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
                            Master Agent Dashboard
                        </h1>
                        <p className="text-lg text-zinc-500">
                            Monitor your autonomous agent orchestrator and M2M transactions
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {stats.map((stat) => {
                            const Icon = stat.icon
                            return (
                                <div key={stat.label} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                                            <Icon className="w-5 h-5 text-zinc-400" />
                                        </div>
                                        <span className="text-xs text-green-500">{stat.change}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-zinc-100 mb-1">{stat.value}</p>
                                    <p className="text-sm text-zinc-500">{stat.label}</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Activity Feed */}
                        <div className="lg:col-span-2">
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                <h2 className="text-xl font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                                    <Clock className="w-5 h-5" />
                                    Live Activity Feed
                                </h2>
                                <div className="space-y-4">
                                    {recentActivity.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="flex items-start gap-4 p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/30 hover:border-zinc-700/50 transition-colors"
                                        >
                                            <div className={`w-2 h-2 rounded-full mt-2 ${activity.success ? "bg-green-500" : "bg-red-500"}`} />
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between mb-1">
                                                    <h4 className="text-sm font-medium text-zinc-100">{activity.agent}</h4>
                                                    <span className="text-xs text-zinc-600">{activity.time}</span>
                                                </div>
                                                <p className="text-sm text-zinc-500">{activity.action}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activity.type === "discovery" ? "bg-blue-500/10 text-blue-400" :
                                                            activity.type === "payment" ? "bg-purple-500/10 text-purple-400" :
                                                                activity.type === "settlement" ? "bg-green-500/10 text-green-400" :
                                                                    activity.type === "response" ? "bg-cyan-500/10 text-cyan-400" :
                                                                        "bg-red-500/10 text-red-400"
                                                        }`}>
                                                        {activity.type}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Configuration Panel */}
                        <div className="space-y-6">
                            {/* Agent Status */}
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                <h3 className="text-lg font-semibold text-zinc-100 mb-4">Agent Status</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-500">Status</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-sm text-zinc-300">Active</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-500">Mode</span>
                                        <span className="text-sm text-zinc-300">Autonomous</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-500">Uptime</span>
                                        <span className="text-sm text-zinc-300">47h 23m</span>
                                    </div>
                                </div>
                            </div>

                            {/* Spending Limits */}
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                <h3 className="text-lg font-semibold text-zinc-100 mb-4">Spending Limits</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-500">Daily Limit</span>
                                            <span className="text-zinc-300">89.42 / 100 CRO</span>
                                        </div>
                                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-300 rounded-full" style={{ width: "89%" }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-500">Per Transaction</span>
                                            <span className="text-zinc-300">Max: 0.50 CRO</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Service Preferences */}
                            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                <h3 className="text-lg font-semibold text-zinc-100 mb-4">Service Preferences</h3>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-zinc-800 border-zinc-700" />
                                        <span className="text-sm text-zinc-300">Auto-approve low-cost calls</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-zinc-800 border-zinc-700" />
                                        <span className="text-sm text-zinc-300">Prioritize high reputation</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 rounded bg-zinc-800 border-zinc-700" />
                                        <span className="text-sm text-zinc-300">Enable fallback agents</span>
                                    </label>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50">
                                <h3 className="text-lg font-semibold text-zinc-100 mb-4">Quick Actions</h3>
                                <div className="space-y-2">
                                    <button className="w-full py-3 px-4 rounded-xl bg-zinc-800/50 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between">
                                        <span>View Analytics</span>
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                    <button className="w-full py-3 px-4 rounded-xl bg-zinc-800/50 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between">
                                        <span>Export Logs</span>
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                    <button className="w-full py-3 px-4 rounded-xl bg-zinc-800/50 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between">
                                        <span>Configure Wallet</span>
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <FooterSection />
        </main>
    )
}
