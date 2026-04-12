import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Character {
  id: string; // slug, e.g. "tavern-keeper"
  name: string; // display name
  icon: string; // single emoji
  description: string; // short flavour text shown in sidebar
  personality: string; // used in system prompt
  voice: string; // speaking style, e.g. "gruff, uses nautical slang"
  color: "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
  mood: string; // current emotional state, mutated by the model
  createdAt: number;
}

export type CharacterMap = Record<string, Character>;

export interface CharacterStore {
  scenarioId: string;
  characters: CharacterMap;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), ".openrp");

function storeFile(scenarioId: string): string {
  return path.join(DATA_DIR, `${scenarioId}-characters.json`);
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadCharacters(scenarioId: string): CharacterMap {
  ensureDir();
  const file = storeFile(scenarioId);
  if (!fs.existsSync(file)) return {};
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const store: CharacterStore = JSON.parse(raw);
    return store.characters ?? {};
  } catch {
    return {};
  }
}

export function saveCharacters(
  scenarioId: string,
  characters: CharacterMap,
): void {
  ensureDir();
  const store: CharacterStore = { scenarioId, characters };
  fs.writeFileSync(
    storeFile(scenarioId),
    JSON.stringify(store, null, 2),
    "utf-8",
  );
}

export function upsertCharacter(
  scenarioId: string,
  character: Character,
  current: CharacterMap,
): CharacterMap {
  const updated = { ...current, [character.id]: character };
  saveCharacters(scenarioId, updated);
  return updated;
}

export function updateMood(
  scenarioId: string,
  characterId: string,
  mood: string,
  current: CharacterMap,
): CharacterMap {
  const char = current[characterId];
  if (!char) return current;
  return upsertCharacter(scenarioId, { ...char, mood }, current);
}

// ─── Tool definitions for the model ──────────────────────────────────────────

export const CHARACTER_TOOLS = [
  {
    name: "create_character",
    description:
      "Introduce a new NPC into the scene. Call this when a new character naturally enters the narrative. The character will be remembered across the entire session.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "Unique slug, lowercase-hyphenated, e.g. 'tavern-keeper'",
        },
        name: {
          type: "string",
          description: "Display name, e.g. 'Mira the Tavern Keeper'",
        },
        icon: { type: "string", description: "A single representative emoji" },
        description: {
          type: "string",
          description: "One sentence flavour text for the sidebar",
        },
        personality: {
          type: "string",
          description: "Paragraph describing personality traits and background",
        },
        voice: {
          type: "string",
          description:
            "How this character speaks, e.g. 'terse, uses archaic words, never swears'",
        },
        color: {
          type: "string",
          enum: ["red", "green", "yellow", "blue", "magenta", "cyan", "white"],
          description: "Terminal color for this character's name label",
        },
        mood: {
          type: "string",
          description: "Starting emotional state, e.g. 'suspicious'",
        },
      },
      required: [
        "id",
        "name",
        "icon",
        "description",
        "personality",
        "voice",
        "color",
        "mood",
      ],
    },
  },
  {
    name: "speak_as",
    description:
      "Have a specific character speak. Use this for any NPC dialogue. You may call speak_as multiple times in one turn to have several characters respond in sequence.",
    input_schema: {
      type: "object",
      properties: {
        character_id: {
          type: "string",
          description: "The id of the character who is speaking",
        },
        content: {
          type: "string",
          description:
            "What the character says and/or does (actions in *asterisks*)",
        },
        mood_after: {
          type: "string",
          description:
            "Updated mood for this character after they speak, if it changed",
        },
      },
      required: ["character_id", "content"],
    },
  },
  {
    name: "narrator",
    description:
      "Describe scene changes, atmosphere, time passing, or any action not belonging to a specific character. Use sparingly to advance the scene.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The narration text" },
      },
      required: ["content"],
    },
  },
] as const;

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildSystemPrompt(
  basePrompt: string,
  characters: CharacterMap,
): string {
  const charList = Object.values(characters);
  const charSection =
    charList.length === 0
      ? "No characters have been introduced yet — create them as needed."
      : charList
          .map(
            (c) =>
              `• ${c.icon} ${c.name} (id: "${c.id}") — ${c.description} Current mood: ${c.mood}.`,
          )
          .join("\n");

  return `${basePrompt}

═══ MULTI-CHARACTER ENGINE ═══

You are a collaborative storyteller running an interactive roleplay. You control all non-player characters (NPCs). The player writes as themselves.

TOOLS YOU MUST USE:
- Use \`create_character\` the FIRST time a new NPC enters the scene. Never invent characters without registering them.
- Use \`speak_as\` for ALL NPC dialogue and actions. Never write NPC speech as plain text.
- Use \`narrator\` for scene setting, atmosphere, and transitions.
- You may chain multiple tool calls in one response (e.g. narrator → speak_as → speak_as).
- After all tool calls, you may add a brief plain-text narrative note if needed, but prefer tools.

CURRENT CAST:
${charSection}

STYLE RULES:
- Stay in character at all times. React to the player's input naturally.
- Characters should have distinct voices that match their \`voice\` description.
- Update \`mood_after\` in \`speak_as\` when a character's emotional state visibly changes.
- Keep scenes dynamic — let characters react to each other, not just the player.
`;
}
