import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
// Make sure these variables are in your master-agent .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the SERVICE_ROLE key for write access

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Supabase credentials missing. Database writes will fail.");
}

export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;

export async function createTask(taskData: any) {
    if (!supabase) return;

    const { error } = await supabase
        .from('tasks')
        .insert(taskData);

    if (error) {
        console.error(`❌ DB Error creating task:`, error.message);
        throw error;
    }
    console.log(`💾 DB: Task ${taskData.task_id} created (PENDING).`);
}
export async function saveTaskResult(taskId: string, resultData: any) {
    if (!supabase) return;

    // We assume the row was already created when the task started (e.g. by Frontend).
    // If not, we can upsert.
    
    const { error } = await supabase
        .from('tasks')
        .update({ 
            output: resultData, 
            status: 'COMPLETED',
            // Optional: You can save the hash if your worker provided it in the result object
            result_hash: resultData.proof?.resultHash, 
            updated_at: Date.now()
        })
        .eq('task_id', taskId);

    if (error) {
        console.error(`❌ DB Error saving task ${taskId}:`, error.message);
    } else {
        console.log(`💾 DB: Task ${taskId} result saved.`);
    }
}