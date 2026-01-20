import { ethers } from "ethers";
import axios from "axios";
// Ensure these imports point to your actual exports in src/index.ts or src/config
import { 
    getNativeEscrowContractWithSigner, 
    AuthorizationSigner 
} from "../index"; 
import { saveTaskResult, createTask } from "./db";

export interface WorkflowResult {
    taskId: string;
    txHash: string;
    output: any; 
}

export async function runAgentWorkflow(
    taskType: string, 
    params: any, 
    budgetEth: string, 
    workerEndpoint: string,
    workerAddress: string
): Promise<WorkflowResult> {
    console.log(`⚙️ Running Workflow: ${taskType}`);

    // 1. Setup
    const taskId = ethers.hexlify(ethers.randomBytes(32));
    const nonce = Math.floor(Date.now() / 1000);
    const expiresAt = nonce + 3600;

    await createTask({
        task_id: taskId,
        task_type: taskType,
        input_parameters: params,
        budget: budgetEth,
        status: 'PENDING',
        deadline: Date.now() + 3600000,
        created_at: Date.now(),
        updated_at: Date.now(),
        assigned_worker: workerAddress
    });

    // 2. Authorization
    console.log(`   🔐 Creating Authorization for ${workerAddress}...`);
    const authSigner = new AuthorizationSigner();
    const signedAuth = await authSigner.createAuthorization(
        taskId, workerAddress, expiresAt, nonce, 
        { serviceName: taskType, params }
    );

    // 3. Register Intent (Common Failure Point)
    console.log(`   📨 Registering intent with Worker at ${workerEndpoint}...`);
    try {
        await axios.post(`${workerEndpoint}/authorize/${taskId}`, {
            message: { taskId, worker: workerAddress, expiresAt, nonce },
            signature: signedAuth.signature,
            payload: { serviceName: taskType, params }
        });
    } catch (error: any) {
        // Detailed Axios Error Logging
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Worker Node is unreachable at ${workerEndpoint}. Is it running?`);
        }
        if (error.response) {
            console.error("Worker Response Error:", error.response.data);
            throw new Error(`Worker Rejected Authorization: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Worker Connection Failed: ${error.message}`);
    }

    // 4. Deposit
    console.log(`   💰 Depositing ${budgetEth} ETH...`);
    try {
        const escrow = getNativeEscrowContractWithSigner();
        const tx = await escrow.depositTask(
            taskId, workerAddress, 3600, 
            { value: ethers.parseEther(budgetEth) }
        );
        console.log(`   ⏳ Deposit Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`   ✅ Deposit Confirmed.`);
        
        // 5. Start Polling (Background)
        const finalOutput = await pollAndRelay(taskId, workerEndpoint, escrow);

        return { taskId, txHash: tx.hash, output: finalOutput };
        
    } catch (error: any) {
        console.error("Blockchain Deposit Error:", error);
        throw new Error(`Deposit Failed: ${error.message || error}`);
    }
}

async function pollAndRelay(taskId: string, workerUrl: string, escrow: any) {
    console.log(`   👂 Polling ${taskId}...`);
    const TIMEOUT = 60000;
    const start = Date.now();

    while (Date.now() - start < TIMEOUT) {
        try {
            const proofRes = await axios.get(`${workerUrl}/proof/${taskId}`);
            if (proofRes.data.success) {
                const proof = proofRes.data.proof;
                
                console.log(`   🚀 Relaying ${taskId}...`);
                const tx = await escrow.submitWorkRelayed(
                    taskId, proof.resultHash, proof.signature
                );
                await tx.wait();

                const resultRes = await axios.get(`${workerUrl}/result/${taskId}`);
                const finalData = resultRes.data.data;

                await saveTaskResult(taskId, finalData);
                
                // Return data so runAgentWorkflow can grab it
                return finalData;
            }
        } catch (e) { /* wait */ }
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for worker output`);
}