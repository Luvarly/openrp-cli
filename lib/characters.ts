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
  isActive?: boolean; // whether the character is currently in the scene
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

export function updatePresence(
  scenarioId: string,
  characterId: string,
  isActive: boolean,
  current: CharacterMap,
): CharacterMap {
  const char = current[characterId];
  if (!char) return current;
  return upsertCharacter(scenarioId, { ...char, isActive }, current);
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
        thoughts: {
          type: "string",
          description:
            "The character's internal reasoning and motivations for what they are about to say or do. Not spoken aloud.",
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
  {
    name: "set_presence",
    description:
      "Update whether a character is currently present in the scene. Use this when a character leaves or enters the current location.",
    input_schema: {
      type: "object",
      properties: {
        character_id: {
          type: "string",
          description: "The id of the character",
        },
        active: {
          type: "boolean",
          description: "True if they are present in the current scene, false if they have left.",
        },
      },
      required: ["character_id", "active"],
    },
  },
  {
    name: "update_scene",
    description:
      "Update the current scene description. Use this when the characters move to a new location or the environment significantly changes.",
    input_schema: {
      type: "object",
      properties: {
        new_scene: {
          type: "string",
          description: "The complete new scene description.",
        },
      },
      required: ["new_scene"],
    },
  },
  {
    name: "update_inventory",
    description:
      "Add or remove an item from the player's inventory.",
    input_schema: {
      type: "object",
      properties: {
        item: {
          type: "string",
          description: "The item name.",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
        },
      },
      required: ["item", "action"],
    },
  },
  {
    name: "update_memory",
    description:
      "Record a permanent memory or fact about the player, the world, or past events. This ensures you never forget it across a long session.",
    input_schema: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: "A concise bullet point fact to remember permanently.",
        },
      },
      required: ["fact"],
    },
  },
] as const;

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildSystemPrompt(
  basePrompt: string,
  characters: CharacterMap,
  sceneOverride?: string,
  player?: { name: string; description: string },
  inventory?: string[],
  memories?: string[],
): string {
  const charList = Object.values(characters);
  const present = charList.filter((c) => c.isActive !== false);
  const elsewhere = charList.filter((c) => c.isActive === false);

  const presentSection =
    present.length === 0
      ? "  (none yet — create characters as needed using create_character)"
      : present
          .map(
            (c) => `  ${c.icon} **${c.name}** (id: "${c.id}")
     Description: ${c.description}
     Personality: ${c.personality}
     Voice: ${c.voice}
     Current mood: ${c.mood}`,
          )
          .join("\n\n");

  const elsewhereSection =
    elsewhere.length === 0
      ? ""
      : "\n\n<ELSEWHERE>\n" +
        elsewhere
          .map(
            (c) => `  ${c.icon} **${c.name}** (id: "${c.id}") - Currently NOT in the scene.`,
          )
          .join("\n") +
        "\n</ELSEWHERE>";

  let prompt = basePrompt;

  if (sceneOverride) {
    // Replace the <SCENE> block if it exists, or append it
    if (/<SCENE>[\s\S]*?<\/SCENE>/.test(prompt)) {
      prompt = prompt.replace(/<SCENE>[\s\S]*?<\/SCENE>/, `<SCENE>\n${sceneOverride}\n</SCENE>`);
    } else {
      prompt += `\n<SCENE>\n${sceneOverride}\n</SCENE>\n`;
    }
  }

  const playerSection = player
    ? `\n<PLAYER>\nName: ${player.name}\nDescription: ${player.description}\n</PLAYER>\n`
    : "";

  const inventorySection = inventory && inventory.length > 0
    ? `\n<INVENTORY>\n${inventory.map(i => `- ${i}`).join("\n")}\n</INVENTORY>\n`
    : "";

  const memorySection = memories && memories.length > 0
    ? `\n<MEMORIES>\n${memories.map(m => `- ${m}`).join("\n")}\n</MEMORIES>\n`
    : "";

  return `${prompt}${playerSection}${inventorySection}${memorySection}

<ENGINE>
You are a collaborative storyteller running an interactive roleplay. You control ALL non-player characters (NPCs). The player writes as themselves. Your job is to make the world feel alive, reactive, and immersive.

TOOL RULES — follow these exactly:
1. REGISTERED CHARACTERS: All characters listed in <CAST> below are already registered. Use speak_as for them directly. Do NOT call create_character for them.
2. NEW CHARACTERS: If a brand-new NPC enters the scene who is NOT in <CAST>, call create_character first, then speak_as.
3. speak_as: Use for ALL NPC dialogue and actions. Never write NPC speech as plain text outside a tool call.
4. narrator: Use for scene-setting, atmosphere, transitions, and actions not belonging to any character. Use it to open scenes and mark significant beats.
5. CHAINING: You may and should chain multiple tool calls in one response — e.g. narrator → speak_as → speak_as → narrator. This is how you make scenes feel multi-threaded.
6. MOOD: Update mood_after in speak_as whenever a character's emotional state visibly shifts.
7. PRESENCE: Use set_presence to mark active: true when characters enter the scene, or active: false when they leave.
8. SCENE: Use update_scene if the environment changes significantly or characters move to a new location.
9. MEMORY: Use update_memory to record permanent facts that you must not forget.
10. INVENTORY: Use update_inventory to give or take away items from the player.

STORYTELLING RULES:
- React to the player's input with specificity — echo their words back into the scene.
- Let characters have opinions about each other, not just the player.
- Use silence and subtext: what a character doesn't say is as important as what they do.
- Advance the scene — don't just respond, move things forward.
- Keep each character's voice sharply distinct from the others.
</ENGINE>

<CAST>
${presentSection}
</CAST>${elsewhereSection}`;
}
