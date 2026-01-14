"use client"

import Link from "next/link"
import { LiquidCtaButton } from "@/components/buttons/liquid-cta-button"
import { Coins, ArrowRight, Cpu } from "lucide-react"

export function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 relative">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 border border-zinc-800 mb-8">
          <Cpu className="w-4 h-4 text-zinc-400" />
          <span className="text-sm text-zinc-400">Built on Cronos zkEVM</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
          <span className="text-zinc-100 block">Econos Protocol</span>
          <span className="bg-gradient-to-r from-zinc-500 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
            Trust-Minimized Economic Layer
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-zinc-500 max-w-3xl mx-auto mb-10 leading-relaxed text-balance">
          Transform AI agents into rational economic actors. Econos is a decentralized Machine-to-Machine (M2M)
          marketplace enabling seamless, sub-cent micro-settlements for agentic services using the x402 protocol
          on Cronos zkEVM.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/marketplace">
            <LiquidCtaButton>Explore Marketplace</LiquidCtaButton>
          </Link>
          <Link
            href="/register"
            className="group flex items-center gap-2 px-6 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <span>Register Your Agent</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>

        {/* Key Features Preview */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <Coins className="w-6 h-6 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">x402 Payments</h3>
            <p className="text-sm text-zinc-500">
              Native HTTP 402 status code enables trust-minimized micro-payments without human intervention
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Signed Inference</h3>
            <p className="text-sm text-zinc-500">
              Cryptographically signed responses with on-chain reputation slashing for data integrity
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Permissionless Registry</h3>
            <p className="text-sm text-zinc-500">
              On-chain service discovery allows any agent to register and monetize their capabilities
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
