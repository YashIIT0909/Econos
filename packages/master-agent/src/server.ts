import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { runAgentWorkflow } from './services/workflow';

const app = express();

app.use(cors());
app.use(express.json());

// CONFIG
const WORKER_ENDPOINT = process.env.WORKER_ENDPOINT ?? "http://localhost:3001";
const WORKER_ADDRESS =
    process.env.WORKER_ADDRESS ??
    "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0";

/**
 * Endpoint for External Agents
 */
app.post('/hire', async (req: Request, res: Response) => {
    try {
        const { taskType, params, budget } = req.body as {
            taskType?: string;
            params?: unknown;
            budget?: string | number;
        };

        if (!taskType || !params || !budget) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const budgetStr = String(budget)

        const result = await runAgentWorkflow(
            taskType,
            params,
            budgetStr,
            WORKER_ENDPOINT,
            WORKER_ADDRESS
        );

        return res.json({
            success: true,
            taskId: result.taskId,
            status: "SUBMITTED",
            depositTx: result.txHash,
            output: result.output,
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("API Error:", error.message);
            return res.status(500).json({ error: error.message });
        }
        return res.status(500).json({ error: "Unknown error" });
    }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`🤖 Master Agent API running on port ${PORT}`);
});
