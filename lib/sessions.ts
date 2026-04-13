import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { type Message } from "./api";
import { type CharacterMap } from "./characters";

// ─── ChatEntry (shared between ChatScreen and sessions) ───────────────────────

export type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "speech"; name: string; icon: string; color: string; text: string; thoughts?: string }
  | { kind: "narrator"; text: string }
  | { kind: "system"; text: string };

export interface Player {
  name: string;
  description: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;           // e.g. "2026-04-12T15-30-00-123Z"
  scenarioId: string;
  savedAt: number;      // Unix ms
  preview: string;      // first user message, truncated
  entries: ChatEntry[];
  history: Message[];
  characters: CharacterMap;
  scene?: string;       // current dynamic scene description
  player?: Player;      // player persona
  inventory?: string[]; // player items
  memories?: string[];  // long-term AI memory facts
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), ".openrp");

function sessionsDir(scenarioId: string): string {
  return path.join(DATA_DIR, "sessions", scenarioId);
}

function sessionFile(scenarioId: string, sessionId: string): string {
  return path.join(sessionsDir(scenarioId), `${sessionId}.json`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Operations ───────────────────────────────────────────────────────────────

export function generateSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function saveSession(session: Session): void {
  const dir = sessionsDir(session.scenarioId);
  ensureDir(dir);
  fs.writeFileSync(
    sessionFile(session.scenarioId, session.id),
    JSON.stringify(session, null, 2),
    "utf-8",
  );
}

export function loadSession(scenarioId: string, sessionId: string): Session | null {
  const file = sessionFile(scenarioId, sessionId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Session;
  } catch {
    return null;
  }
}

export function listSessions(scenarioId: string): Session[] {
  const dir = sessionsDir(scenarioId);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(
            fs.readFileSync(path.join(dir, f), "utf-8"),
          ) as Session;
        } catch {
          return null;
        }
      })
      .filter((s): s is Session => s !== null)
      .sort((a, b) => b.savedAt - a.savedAt); // most recent first
  } catch {
    return [];
  }
}

export function listAllSessions(): Session[] {
  const sessionsBase = path.join(DATA_DIR, "sessions");
  if (!fs.existsSync(sessionsBase)) return [];
  
  let all: Session[] = [];
  try {
    const scenarios = fs.readdirSync(sessionsBase);
    for (const sc of scenarios) {
      all = all.concat(listSessions(sc));
    }
  } catch {
    // ignore
  }
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export function findSessionById(sessionId: string): Session | null {
  const sessionsBase = path.join(DATA_DIR, "sessions");
  if (!fs.existsSync(sessionsBase)) return null;
  try {
    const scenarios = fs.readdirSync(sessionsBase);
    for (const sc of scenarios) {
      const s = loadSession(sc, sessionId);
      if (s) return s;
    }
  } catch {
    return null;
  }
  return null;
}

export function deleteSession(scenarioId: string, sessionId: string): void {
  const file = sessionFile(scenarioId, sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/** Build a short preview string from the entries array. */
export function buildPreview(entries: ChatEntry[]): string {
  const first = entries.find((e) => e.kind === "user");
  if (!first || first.kind !== "user") return "(empty session)";
  return first.text.length > 60 ? first.text.slice(0, 57) + "…" : first.text;
}
