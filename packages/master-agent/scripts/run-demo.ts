import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";
import {
  WorkerSelector,
  AuthorizationSigner,
  getNativeEscrowContractWithSigner,
  getNativeEscrowContract,
  contractAddresses,
} from "../src"; 
import { getMasterWallet } from "../src/config/cronos";

// Configuration
const TARGET_TASK_TYPE = "summary-generation";
const DUMMY_PARAMS = {
  text: "Blockchain is a distributed ledger technology that enables secure, transparent transactions.",
  maxLength: 100,
};
const TASK_DURATION = 3600; // 1 hour
// Payment includes a small buffer for gas reimbursement logic in the contract
const PAYMENT_AMOUNT = ethers.parseEther("0.02"); 

async function main() {
  console.log(`\n🤖 ECONOS MASTER AGENT - DEMO CLI (Relayer Mode)`);
  console.log(`==================================================`);

  const masterWallet = getMasterWallet();
  console.log(`🔑 Master Wallet: ${masterWallet.address}`);
  console.log(`📜 Escrow Contract: ${contractAddresses.nativeEscrow}`);

  // ---------------------------------------------------------
  // STEP 1: WORKER DISCOVERY
  // ---------------------------------------------------------
  console.log(`\n[Step 1] 📡 Scanning for Workers...`);

  const workerSelector = new WorkerSelector({
    knownWorkerAddresses: [
      "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0", // Hardcoded for speed
    ],
    workerEndpoints: {
      "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0": "http://localhost:3001",
    },
  });

  const workers = await workerSelector.getAvailableWorkers();
  console.log(`   ✅ Discovered ${workers.length} Active Workers:`);
  workers.forEach((w) => {
    console.log(`   ------------------------------------------------`);
    console.log(`   👷 Address:  ${w.address}`);
    console.log(`   🌐 Endpoint: ${w.endpoint}`);
  });

  if (workers.length === 0) {
    console.error(`\n❌ ERROR: No workers found.`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 2: SELECTION
  // ---------------------------------------------------------
  console.log(`\n[Step 2] 🧠 Selecting Best Worker...`);
  const selectedWorker = workers[0]; // Simple selection for demo
  console.log(`   ✅ SELECTED WORKER: ${selectedWorker.address}`);

  // ---------------------------------------------------------
  // STEP 3: AUTHORIZATION
  // ---------------------------------------------------------
  console.log(`\n[Step 3] 🔐 Generating Authorization...`);

  const taskId = ethers.hexlify(ethers.randomBytes(32));
  const nonce = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  console.log(`   🆔 Generated Task ID: ${taskId}`);

  const authSigner = new AuthorizationSigner();
  const signedAuth = await authSigner.createAuthorization(
    taskId,
    selectedWorker.address,
    expiresAt,
    nonce,
    { serviceName: TARGET_TASK_TYPE, params: DUMMY_PARAMS }
  );
  console.log(`   ✍️  Signed EIP-712 Authorization.`);

  // ---------------------------------------------------------
  // STEP 4: REGISTER INTENT
  // ---------------------------------------------------------
  console.log(`\n[Step 4] 📨 Sending Intent to Worker API...`);

  try {
    const authUrl = `${selectedWorker.endpoint}/authorize/${taskId}`;
    await axios.post(authUrl, {
      message: { taskId, worker: selectedWorker.address, expiresAt, nonce },
      signature: signedAuth.signature,
      payload: { serviceName: TARGET_TASK_TYPE, params: DUMMY_PARAMS },
    });
    console.log(`   ✅ Worker Registered Authorization.`);
  } catch (error: any) {
    console.error(`❌ Failed to contact worker: ${error.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 5: DEPOSIT (CREATE TASK)
  // ---------------------------------------------------------
  console.log(`\n[Step 5] 💰 Depositing Funds (Creating Task)...`);
  const escrow = getNativeEscrowContractWithSigner();
  try {
    const tx = await escrow.depositTask(
      taskId,
      selectedWorker.address,
      TASK_DURATION,
      { value: PAYMENT_AMOUNT }
    );
    console.log(`   ⏳ Tx Sent: ${tx.hash}`);
    await tx.wait();
    console.log(`   ✅ Deposit Confirmed.`);
  } catch (error: any) {
    console.error(`❌ Deposit Failed: ${error.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 6: POLLING FOR PROOF (Not Blockchain!)
  // ---------------------------------------------------------
  console.log(`\n[Step 6] 👂 Waiting for Worker Proof (Signature)...`);

  const startTime = Date.now();
  const TIMEOUT_MS = 60000;
  let proof = null;

  while (Date.now() - startTime < TIMEOUT_MS) {
    try {
      const fetchUrl = `${selectedWorker.endpoint}/proof/${taskId}`;
      const response = await axios.get(fetchUrl);
      
      if (response.data.success) {
        proof = response.data.proof;
        console.log(`   ✅ Proof Acquired from Worker API!`);
        console.log(`      Signature: ${proof.signature.slice(0, 20)}...`);
        break;
      }
    } catch (e) {
      process.stdout.write("."); // Waiting...
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!proof) {
    console.error(`\n❌ Timeout: Worker did not provide proof in time.`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 7: MASTER RELAYS THE TRANSACTION
  // ---------------------------------------------------------
  console.log(`\n[Step 7] 🚀 Master Acting as Relayer (Submitting to Chain)...`);
  
  try {
    // Master pays the gas here!
    const txRelay = await escrow.submitWorkRelayed(
      taskId,
      proof.resultHash,
      proof.signature
    );
    
    console.log(`   ⏳ Settlement Tx Sent: ${txRelay.hash}`);
    await txRelay.wait();
    console.log(`   ✅ Settlement Confirmed! Worker has been paid.`);
  } catch (error: any) {
    console.error(`❌ Relay Failed: ${error.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 8: FETCH FINAL DATA
  // ---------------------------------------------------------
  console.log(`\n[Step 8] 📦 Fetching Readable Result...`);
  try {
    const res = await axios.get(`${selectedWorker.endpoint}/result/${taskId}`);
    if (res.data.success) {
      console.log(`\n📦 FINAL OUTPUT:`);
      console.log(`==================================================`);
      const data = res.data.data.data; // .data (axios) .data (api wrapper) .data (content)
      if (typeof data === "object") console.log(JSON.stringify(data, null, 2));
      else console.log(data);
      console.log(`==================================================`);
    }
  } catch (e) {
    console.log(`   (Could not fetch readable result, but task is done)`);
  }

  console.log(`\n🎉 DEMO COMPLETE: Full Lifecycle Successful!`);
}

main().catch(console.error);