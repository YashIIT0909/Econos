# Econos Protocol — Complete Implementation Guide  
**Cronos zkEVM Testnet · Crypto.com AI Agent SDK · x402 Payments**

---

## 🧭 Goal

**Econos** is a trust-minimized, agent-to-agent economic protocol built on the **Cronos zkEVM testnet**, enabling AI agents to offer **paid services** using **HTTP 402 (x402)** and **cryptographically signed inference** via the **Crypto.com AI Agent SDK**.

The system supports multiple paid worker services:

1. Image generation  
2. Summary generation  
3. Research agent  
4. Writer agent  
5. Market intelligence (using Crypto.com market data)

### Core Architecture Flow

> **Discover service → Request inference → HTTP 402 → On-chain payment → Verification → Signed response → Consumer verification**

---

## 1️⃣ Project Structure

```bash
packages/
├── contracts/           # On-chain logic (Cronos zkEVM)
├── worker-node/         # Paid AI service provider
├── master-agent/        # AI consumer/orchestrator
├── shared-sdk/          # Shared cryptographic & type logic
├── scripts/             # Deployment & testing
├── docker-compose.yml   # Local dev setup
└── README.md
```

This layout separates chain logic, paid AI services, orchestration, and shared type/crypto utilities into clean, independently testable packages.

---

## 2️⃣ Contracts (On-Chain Layer)

```bash
contracts/
├── src/
│   ├── ObolRegistry.sol  # Service discovery, pricing, metadata
│   └── Reputation.sol    # (Optional) staking & slashing
├── lib/                  # OpenZeppelin / zkStack deps
└── hardhat.config.ts
```

**Purpose**

- **ObolRegistry.sol** stores worker services and maps `serviceName → endpoint → price → worker address` for trust-minimized discovery.
- **Reputation.sol** can optionally implement staking and slashing for workers based on misbehavior or invalid signed responses.

Cronos zkEVM is an Ethereum-equivalent zk-rollup chain, so standard Solidity contracts and tooling (Hardhat, OpenZeppelin) are supported.

---

## 3️⃣ Worker Node (Service Provider)

The **worker node** is an HTTP server exposing multiple AI services that all share:

- A single on-chain identity and payout address on Cronos zkEVM.
- Monetization via the x402 pattern: missing or invalid payment yields HTTP 402 and payment instructions.
- Cryptographically signed inference responses (EIP-191) so that master agents can verify authenticity and bind output to a specific service and request.

The Crypto.com AI Agent SDK provides the intelligence layer for these services, while the worker node enforces payments, verification, and signing.

---

## 4️⃣ Worker Node Folder Structure

```bash
worker-node/
├── src/
│   ├── index.ts                   # Express server entry
│
│   ├── config/
│   │   ├── cronos.ts              # RPC, chainId, confirmations
│   │   └── services.ts            # Price & metadata per service
│
│   ├── middleware/
│   │   ├── x402.ts                # HTTP 402 logic
│   │   ├── verifyPayment.ts       # On-chain tx verification
│   │   └── requestContext.ts      # requestId, service binding
│
│   ├── services/
│   │   ├── image-generation/
│   │   │   ├── agent.ts
│   │   │   ├── prompt.txt
│   │   │   ├── tools.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── summary-generation/
│   │   │   ├── agent.ts
│   │   │   ├── prompt.txt
│   │   │   ├── tools.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── researcher/
│   │   │   ├── agent.ts
│   │   │   ├── prompt.txt
│   │   │   ├── tools.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── writer/
│   │   │   ├── agent.ts
│   │   │   ├── prompt.txt
│   │   │   ├── tools.ts
│   │   │   └── schema.ts
│   │   │
│   │   └── market-research/
│   │       ├── agent.ts
│   │       ├── prompt.txt
│   │       ├── tools.ts
│   │       ├── priceFeed.ts       # Crypto.com MCP / markets
│   │       └── schema.ts
│
│   ├── signer/
│   │   ├── sign.ts                # EIP-191 signing
│   │   └── verify.ts
│
│   ├── registry/
│   │   └── manifest.ts            # Service manifests
│
│   └── utils/
│       ├── hash.ts
│       └── logger.ts
│
├── .env.example
└── package.json
```

- **config/cronos.ts** defines RPC URL, chainId, and confirmation depth for Cronos zkEVM testnet interactions.
- **config/services.ts** centralizes service pricing, IDs, and metadata bound on-chain registry entries.
- **middleware/** handles payment requirements, verification, and request context binding.
- **services/** contains independent AI service implementations, each with prompt, tools, and schema.
- **signer/** provides EIP-191 signing and verification utilities.

---

## 5️⃣ Unified Inference Endpoint

All services are exposed via a **single HTTP route** with a path parameter:

```http
POST /inference/:serviceName
```

**Examples**

```
/inference/image-generation
/inference/summary-generation
/inference/researcher
/inference/writer
/inference/market-research
```

**Benefits**

- Unified monetization system
- Single registry per worker
- Seamless multi-service support
- Independent pricing and prompts per service

---

## 6️⃣ AI Services with Crypto.com AI Agent SDK

Each service module is structured as:

| File         | Purpose                                                |
|--------------|--------------------------------------------------------|
| `agent.ts`   | Defines a single-purpose AI agent using the SDK       |
| `prompt.txt` | Describes deterministic behavior and style            |
| `tools.ts`   | Whitelisted tools and integrations per service        |
| `schema.ts`  | Output JSON schema for robust, machine-usable results |

The Crypto.com AI Agent SDK lets services query Cronos zkEVM, Cronos EVM, and Crypto.com exchange/DeFi APIs with natural-language or structured calls, while your worker wraps these capabilities in narrow, deterministic agents.

**SDK Design Principles**

- Each service has **exactly one** single-purpose agent for predictability.
- Agents receive structured requests, call only approved tools, and return strictly validated JSON.
- Agents never handle payment, transaction verification, or signing; those concerns remain in middleware and `signer/`.

> **SDK = Intelligence**  
> **Worker Node = Economy + Trust**

---

## 7️⃣ x402 Payment Implementation

### `middleware/x402.ts`

- Inspects each incoming `/inference/:serviceName` request for a valid payment header (e.g., `X-Payment`).
- If missing or invalid, returns an **HTTP 402 Payment Required** response with a JSON body describing:
  - Service price in CRO (or zkTCRO on testnet)
  - Worker payout address on Cronos zkEVM
  - ChainId and network details for payment

### `middleware/verifyPayment.ts`

On retried requests with `X-Payment: {txHash}`, the worker verifies:

1. Transaction exists on Cronos zkEVM via RPC or explorer API
2. Recipient equals the worker's configured address
3. Transferred amount is ≥ required service price
4. Sufficient block confirmations (finality) on zkEVM
5. **Single-use txHash** enforcement to avoid replay across requests

This pattern prevents **free inference** and **replay attacks**, ensuring trust-minimized, verifiable settlement.

---

## 8️⃣ Signed Inference (EIP-191)

### `signer/sign.ts`

After successful payment verification and agent execution, the worker signs:

- `serviceName`
- `requestId`
- `responseHash` (hash of the JSON payload)
- `timestamp`

Using EIP-191–compatible personal message signing so that consumers can verify signatures off-chain with the known worker address.

### `signer/verify.ts`

Provides helper utilities to verify signatures and recover the signer address from the message and EIP-191 signature.

**Why This Matters**

- Prevents inference spoofing by untrusted relays
- Enables reputation and slashing mechanisms tied to mis-signed outputs
- Makes historical inferences auditable and attributable to a specific on-chain identity

---

## 9️⃣ Runtime Flow (End-to-End)

1. **Registry discovery**
   - Master Agent queries `ObolRegistry` on Cronos zkEVM for `serviceName`, endpoint, price, and worker address

2. **Initial inference attempt**
   - Master Agent sends `POST /inference/{service}` without payment header

3. **HTTP 402 response**
   - Worker returns **402 Payment Required** with structured x402 payment requirements

4. **On-chain payment (x402 settlement)**
   - Master Agent pays the specified amount in CRO / zkTCRO on Cronos zkEVM
   - Obtains the transaction hash

5. **Retry with proof of payment**
   - Master Agent sends `POST /inference/{service}` again with `X-Payment: {txHash}` header

6. **On-chain payment verification**
   - Worker confirms tx is valid, final, and not previously used

7. **Agent execution**
   - Worker dispatches to appropriate `services/{serviceName}/agent.ts`
   - Uses Crypto.com AI Agent SDK and tools to produce structured output

8. **Signed inference**
   - Worker hashes the response
   - Binds it to `serviceName`, `requestId`, and `timestamp`
   - Signs via EIP-191 using the worker key

9. **HTTP 200 success response**

   ```json
   {
     "data": { /* structured JSON output */ },
     "signature": "0x...",
     "requestId": "uuid-or-hash",
     "worker": "0xWorkerAddress",
     "timestamp": 1736870400
   }
   ```

10. **Verification by Master Agent**
    - Verifies EIP-191 signature matches expected worker address
    - Checks freshness and non-reuse of `requestId`

11. **Downstream decision execution**
    - Trigger trades, alerts, storage, or further agent-to-agent workflows

---

## 🔁 Core Mental Model

> **Worker Node = AI Service Factory with an Economic Gate**  
> **Every response = Paid + Signed + Verifiable**

Econos composes Cronos zkEVM, x402-style HTTP 402 payment flows, and Crypto.com AI Agent SDK into a fully agentic, machine-to-machine economic protocol where agents discover, pay, verify, and execute services entirely on-chain and off-chain without human intermediation.

---

## ✅ Expected Outcome

- Each AI service is independently priced and monetized while sharing a single payment and signing stack
- Payments are trust-minimized through on-chain verification and replay protection on Cronos zkEVM
- Agents interact and settle value without human intervention, using verifiable signed inferences as the core primitive
- Econos showcases a concrete, production-style pattern for building x402-native, chain-verified AI services on Cronos zkEVM using the Crypto.com AI Agent SDK
- Ready for hackathon demo and multi-agent scaling

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18.x
- Hardhat for contract compilation
- Docker & Docker Compose (optional, for local Cronos zkEVM testnet)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd econos

# Install dependencies
npm install

# Install workspace packages
lerna bootstrap  # or npm workspaces install
```

### Configuration

Copy `.env.example` to `.env` in each package and fill in your values:

```bash
# packages/worker-node/.env
CRONOS_RPC_URL=<testnet-rpc>
WORKER_PRIVATE_KEY=<0x...>
WORKER_ADDRESS=<0x...>
AI_AGENT_API_KEY=<crypto.com-api-key>
```

### Deploy Contracts

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network cronos-testnet
```

### Start Worker Node

```bash
cd packages/worker-node
npm run dev
```

Worker node listens on `http://localhost:3001` by default.

### Run Master Agent

```bash
cd packages/master-agent
npm start
```

Master agent discovers services, sends requests, handles payments, and verifies signatures.

---

## 📚 Documentation

- **[Cronos zkEVM Docs](https://docs-zkevm.cronos.org)** — Network setup, RPC, testnet faucets
- **[Crypto.com AI Agent SDK](https://ai-agent-sdk-docs.crypto.com)** — SDK reference and examples
- **[x402 Specification](https://www.x402.org)** — HTTP 402 Payment Required standard
- **[EIP-191](https://eips.ethereum.org/EIPS/eip-191)** — Signed Message Signing Standard

---

## 🤝 Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License. See `LICENSE` file for details.

---

## ⚠️ Disclaimer

Econos is a prototype and is under active development. Use at your own risk. Do not deploy sensitive systems to mainnet without thorough auditing and testing.

---

## 📞 Support

For questions or issues:

- Open an issue on GitHub
- Reach out via [your contact method]
- Check documentation and example code in `packages/scripts/`

---

**Built with ❤️ for agent-to-agent economies on Cronos zkEVM**
