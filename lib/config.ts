import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DATA_DIR = path.join(os.homedir(), ".openrp");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export interface Config {
  apiKey: string;
  apiUrl: string;
}

export const DEFAULT_CONFIG: Config = {
  apiKey: "",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
};

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
