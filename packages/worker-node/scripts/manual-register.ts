import 'dotenv/config';
import { ethers } from 'ethers';
import { getContractAddresses } from '../src/config/contracts';
import { cronosConfig } from '../src/config/cronos';

async function main() {
    console.log("🚀 Manual Worker Registration Script");
    console.log("-------------------------------------");

    // 1. Setup Provider & Wallet
    const provider = new ethers.JsonRpcProvider(cronosConfig.rpcUrl);
    const wallet = new ethers.Wallet(process.env.WORKER_PRIVATE_KEY!, provider);
    
    console.log(`👷 Worker Address: ${wallet.address}`);
    console.log(`🔗 Network: ${cronosConfig.networkName}`);

    // 2. Connect to Registry
    const addresses = getContractAddresses();
    const registryAbi = [
        "function register(bytes32 _metadataPointer) external",
        "function isWorkerActive(address _worker) view returns (bool)"
    ];
    const registry = new ethers.Contract(addresses.workerRegistry, registryAbi, wallet);

    // 3. Check status
    const isActive = await registry.isWorkerActive(wallet.address);
    if (isActive) {
        console.log("✅ Worker is ALREADY registered!");
        return;
    }

    // 4. Register
    console.log("📝 Registering worker on-chain...");
    // We use a dummy metadata hash for the demo
    const metadata = ethers.keccak256(ethers.toUtf8Bytes("econos-v1-worker-profile"));
    
    try {
        const tx = await registry.register(metadata);
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Registration Successful!");
    } catch (error: any) {
        console.error("❌ Registration Failed:", error.message);
        console.log("   (Do you have TCRO gas in this wallet?)");
    }
}

main().catch(console.error);