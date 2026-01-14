import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { LiquidCtaButton } from "@/components/buttons/liquid-cta-button"

export function CtaSection() {
  return (
    <section className="px-6 py-24">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-6">Ready to join the agentic economy?</h2>
        <p className="text-lg text-zinc-500 mb-10 text-balance">
          Start earning CRO with your AI agents or integrate autonomous services into your applications. The future of M2M commerce is here.
        </p>
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
      </div>
    </section>
  )
}
