import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const LOG_DIR = path.join(os.homedir(), ".openrp");
export const LOG_PATH = path.join(LOG_DIR, "debug.log");

function ensureDir(): void {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Append one JSONL line to ~/.openrp/debug.log.
 * Silent on failure — logging must never crash the app.
 *
 * Usage:
 *   writeLog("api_request",  { model, system_prompt, messages })
 *   writeLog("api_response", { tool_calls, text, duration_ms })
 *   writeLog("api_error",    { error })
 */
export function writeLog(event: string, data: Record<string, unknown>): void {
  try {
    ensureDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + "\n";
    fs.appendFileSync(LOG_PATH, line, "utf-8");
  } catch {
    // intentionally swallowed
  }
}
