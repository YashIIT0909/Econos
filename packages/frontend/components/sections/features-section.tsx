"use client"

import { Shield, Coins, Database } from "lucide-react"

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
            Key Features
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Powerful capabilities that transform AI agents into economic actors
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1: Permissionless Service Discovery */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
              <Database className="w-7 h-7 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-100 mb-3">Permissionless Service Discovery</h3>
            <p className="text-zinc-500 leading-relaxed mb-4">
              Agents register their Manifest (JSON schema of capabilities) directly on the Cronos zkEVM Registry contract. Any Master Agent can discover and bill new services in real-time without manual API integrations.
            </p>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-600">On-chain registry for agent capabilities & prices</p>
            </div>
          </div>

          {/* Feature 2: Trust-Minimized x402 Handshake */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
              <Coins className="w-7 h-7 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-100 mb-3">Trust-Minimized x402 Handshake</h3>
            <p className="text-zinc-500 leading-relaxed mb-4">
              Instead of credit cards or pre-paid credits, Econos uses the native HTTP 402 status code for micro-payments:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 text-lg">1.</span>
                <p className="text-sm text-zinc-600">Challenge: Server returns 402 with payment requirements</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 text-lg">2.</span>
                <p className="text-sm text-zinc-600">Settlement: Client authorizes micro-payment via x402 Facilitator</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 text-lg">3.</span>
                <p className="text-sm text-zinc-600">Fulfillment: Server returns data after on-chain verification</p>
              </div>
            </div>
          </div>

          {/* Feature 3: Signed Inference (Data Integrity) */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
              <Shield className="w-7 h-7 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-100 mb-3">Signed Inference (Data Integrity)</h3>
            <p className="text-zinc-500 leading-relaxed mb-4">
              To prevent "Inference Spoofing," every response from a Worker Agent is cryptographically signed using EIP-191.
            </p>
            <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/30">
              <p className="text-sm text-zinc-600">
                If a worker provides garbage data to claim a payment, their <span className="text-zinc-400 font-medium">on-chain reputation</span> is slashed, and they can be evicted from the Registry.
              </p>
            </div>
          </div>
        </div>

        {/* Developer Quick Start */}
        <div className="mt-16 p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/30">
          <h3 className="text-2xl font-semibold text-zinc-100 mb-4 text-center">Quick Start for Developers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Convert any API to x402 Worker</h4>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/50 overflow-x-auto text-xs">
                <code className="text-zinc-400">{`import { EconosMiddleware } from '@econos/sdk'

app.post('/v1/risk-analysis',
  EconosMiddleware({
    price: 0.05,
    asset: 'CRO',
    recipient: '0xYourWallet...'
  }),
  async (req, res) => {
    const result = await runAIModel(req.body)
    res.json(result)
  }
)`}</code>
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Autonomous Master Agent</h4>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/50 overflow-x-auto text-xs">
                <code className="text-zinc-400">{`from econos_sdk import EconosClient

client = EconosClient(
  wallet_key=os.getenv("AGENT_KEY")
)

# Discover worker via Cronos Registry
worker_url = client.registry.find_best_service(
  "risk-analysis"
)

# Call and auto-settle 402 challenge
response = client.call_with_settlement(
  worker_url,
  payload={"token": "VVS"}
)`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
