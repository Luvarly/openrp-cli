import { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import { type Scenario, type StarterCharacter } from "../lib/scenarios.js";
import { type Message, type ToolEvent, streamCompletion } from "../lib/api.js";
import {
  type Character,
  type CharacterMap,
  loadCharacters,
  upsertCharacter,
  updateMood,
  buildSystemPrompt,
} from "../lib/characters.js";
import {
  type ChatEntry,
  type Session,
  generateSessionId,
  saveSession,
  buildPreview,
} from "../lib/sessions.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  scenario: Scenario;
  initialSession?: Session;
  onBack: () => void;
}

type Status = "idle" | "streaming" | "error";

// ─── Layout constants ─────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 24;
const HEADER_LINES = 3;
const FOOTER_LINES = 3;
const H_PADDING = 4;

// ─── Word-wrap ────────────────────────────────────────────────────────────────

function wrapText(text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) {
      out.push("");
      continue;
    }
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (candidate.length > maxWidth) {
        if (line) out.push(line);
        line = word.length > maxWidth ? word.slice(0, maxWidth) : word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// ─── Line counting ────────────────────────────────────────────────────────────

function entryLineCount(entry: ChatEntry, contentWidth: number): number {
  switch (entry.kind) {
    case "user":
      return 1 + wrapText(entry.text, contentWidth - 2).length + 1;
    case "speech":
      return 1 + wrapText(entry.text, contentWidth - 2).length + 1;
    case "narrator":
      return wrapText(entry.text, contentWidth - 2).length + 1;
    case "system":
      return 1 + 1;
    default:
      return 1;
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function CharacterSidebar({ characters }: { characters: CharacterMap }) {
  const chars = Object.values(characters);
  const innerWidth = SIDEBAR_WIDTH - 4;
  return (
    <Box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      flexShrink={0}
    >
      <Text bold color="white">
        Cast
      </Text>
      <Text dimColor>{"─".repeat(innerWidth)}</Text>
      {chars.length === 0 && (
        <Text dimColor italic>
          No NPCs yet…
        </Text>
      )}
      {chars.map((c) => (
        <Box key={c.id} flexDirection="column" marginBottom={1}>
          <Text bold color={c.color as any}>
            {c.icon}{" "}
            {c.name.length > innerWidth - 3
              ? c.name.slice(0, innerWidth - 3) + "…"
              : c.name}
          </Text>
          <Text dimColor>
            {c.description.length > innerWidth
              ? c.description.slice(0, innerWidth - 1) + "…"
              : c.description}
          </Text>
          <Text color="yellow" dimColor>
            {c.mood}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Entry renderer ───────────────────────────────────────────────────────────

function EntryView({
  entry,
  contentWidth,
}: {
  entry: ChatEntry;
  contentWidth: number;
}) {
  const innerWidth = contentWidth - 2;

  if (entry.kind === "user") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          YOU
        </Text>
        {wrapText(entry.text, innerWidth).map((l, i) => (
          <Text key={i} color="white">
            {"  "}
            {l}
          </Text>
        ))}
      </Box>
    );
  }

  if (entry.kind === "speech") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={entry.color as any}>
          {entry.icon} {entry.name.toUpperCase()}
        </Text>
        {wrapText(entry.text, innerWidth).map((l, i) => (
          <Text key={i} color="yellow">
            {"  "}
            {l}
          </Text>
        ))}
      </Box>
    );
  }

  if (entry.kind === "narrator") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {wrapText(entry.text, innerWidth).map((l, i) => (
          <Text key={i} dimColor italic>
            {"✦ "}
            {l}
          </Text>
        ))}
      </Box>
    );
  }

  if (entry.kind === "system") {
    return (
      <Box marginBottom={1}>
        <Text color="green" dimColor>
          {"⊕ "}
          {entry.text}
        </Text>
      </Box>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatScreen({ scenario, initialSession, onBack }: Props) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 100;
  const termHeight = stdout?.rows ?? 30;

  const chatPaneWidth = termWidth - SIDEBAR_WIDTH - H_PADDING;
  const contentWidth = Math.max(20, chatPaneWidth);
  const chatPaneHeight = termHeight - HEADER_LINES - FOOTER_LINES;

  // ── State ──────────────────────────────────────────────────────────────────

  const [characters, setCharacters] = useState<CharacterMap>(() => {
    if (initialSession) return initialSession.characters;
    // Fresh session: load saved characters, then seed starters for any missing.
    const saved = loadCharacters(scenario.id);
    const seeded = { ...saved };
    for (const sc of scenario.starterCharacters ?? []) {
      if (!seeded[sc.id]) seeded[sc.id] = { ...sc, createdAt: 0 };
    }
    return seeded;
  });

  const [entries, setEntries] = useState<ChatEntry[]>(
    () => initialSession?.entries ?? [],
  );

  const [history, setHistory] = useState<Message[]>(
    () => initialSession?.history ?? [],
  );

  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Refs ───────────────────────────────────────────────────────────────────

  // Mirror refs so async callbacks always read the latest values.
  const charactersRef = useRef<CharacterMap>(characters);
  const entriesRef = useRef<ChatEntry[]>(entries);
  const historyRef = useRef<Message[]>(history);

  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { historyRef.current = history; }, [history]);
  // entriesRef is kept in sync inline during setEntries calls below.

  // Session ID — created on first message send, reused for auto-saves.
  const sessionIdRef = useRef<string>(initialSession?.id ?? "");

  useInput((_ch, key) => {
    if (key.escape) onBack();
  });

  // ── Visible entries ────────────────────────────────────────────────────────

  const visibleEntries = (() => {
    const budget = chatPaneHeight - (status === "streaming" ? 1 : 0);
    let used = 0;
    const result: ChatEntry[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const lines = entryLineCount(entries[i]!, contentWidth);
      if (used + lines > budget) break;
      result.unshift(entries[i]!);
      used += lines;
    }
    return result;
  })();

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || status === "streaming") return;

    // Assign session ID on first message.
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
    }

    setInput("");
    setStatus("streaming");

    const userEntry: ChatEntry = { kind: "user", text };
    const userMsg: Message = { role: "user", content: text };

    setEntries((prev) => {
      const next = [...prev, userEntry];
      entriesRef.current = next;
      return next;
    });

    const nextHistory = [...historyRef.current, userMsg];
    setHistory(nextHistory);
    historyRef.current = nextHistory;

    const sysPrompt = buildSystemPrompt(scenario.systemPrompt, charactersRef.current);

    await streamCompletion(nextHistory.slice(-40), sysPrompt, scenario.model, {
      onTool(event: ToolEvent, _id: string) {
        if (event.type === "create_character") {
          const c: Character = { ...event.input, createdAt: Date.now() };
          const updated = upsertCharacter(scenario.id, c, charactersRef.current);
          charactersRef.current = updated;
          setCharacters(updated);
          const sysEntry: ChatEntry = { kind: "system", text: `${c.icon} ${c.name} has entered the scene.` };
          setEntries((prev) => {
            const next = [...prev, sysEntry];
            entriesRef.current = next;
            return next;
          });
        } else if (event.type === "speak_as") {
          const { character_id, content, mood_after } = event.input;
          const char = charactersRef.current[character_id];
          const speechEntry: ChatEntry = {
            kind: "speech",
            name: char?.name ?? character_id,
            icon: char?.icon ?? "?",
            color: char?.color ?? "white",
            text: content,
          };
          setEntries((prev) => {
            const next = [...prev, speechEntry];
            entriesRef.current = next;
            return next;
          });
          if (mood_after && char) {
            const updated = updateMood(scenario.id, character_id, mood_after, charactersRef.current);
            charactersRef.current = updated;
            setCharacters(updated);
          }
        } else if (event.type === "narrator") {
          const narrEntry: ChatEntry = { kind: "narrator", text: event.input.content };
          setEntries((prev) => {
            const next = [...prev, narrEntry];
            entriesRef.current = next;
            return next;
          });
        }
      },

      onTextChunk(_chunk: string) {
        // tool_choice:"required" — no plain text expected.
      },

      onDone(assistantMsg, toolResultMsgs) {
        const finalHistory = [...nextHistory, assistantMsg, ...toolResultMsgs];
        setHistory(finalHistory);
        historyRef.current = finalHistory;

        // Auto-save after every successful response.
        saveSession({
          id: sessionIdRef.current,
          scenarioId: scenario.id,
          savedAt: Date.now(),
          preview: buildPreview(entriesRef.current),
          entries: entriesRef.current,
          history: finalHistory,
          characters: charactersRef.current,
        });

        setStatus("idle");
      },

      onError(err: string) {
        setErrorMsg(err);
        setStatus("error");
      },
    });
  }, [input, status, scenario]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" height={termHeight}>
      {/* ── Header ── */}
      <Box paddingX={2} paddingTop={1}>
        <Text bold color="magenta">
          {scenario.icon}
          {"  "}
          <Text color="white">{scenario.title}</Text>
          {"  "}
          <Text dimColor>· Esc to go back</Text>
          {sessionIdRef.current && (
            <Text dimColor>{"  · auto-saving"}</Text>
          )}
        </Text>
      </Box>
      <Box paddingX={2}>
        <Text dimColor>{"─".repeat(Math.min(termWidth - 4, 80))}</Text>
      </Box>

      {/* ── Body ── */}
      <Box flexDirection="row" height={chatPaneHeight}>
        <Box
          flexDirection="column"
          flexGrow={1}
          height={chatPaneHeight}
          paddingX={2}
        >
          {entries.length === 0 && status === "idle" && (
            <Text dimColor italic>
              {scenario.description}. Type your first message to begin…
            </Text>
          )}
          {visibleEntries.map((entry, i) => (
            <EntryView key={i} entry={entry} contentWidth={contentWidth} />
          ))}
          {status === "streaming" && <Text dimColor>{"  ▌"}</Text>}
          {status === "error" && <Text color="red">⚠ {errorMsg}</Text>}
        </Box>

        <CharacterSidebar characters={characters} />
      </Box>

      {/* ── Footer ── */}
      <Box paddingX={2}>
        <Text dimColor>{"─".repeat(Math.min(termWidth - 4, 80))}</Text>
      </Box>
      <Box paddingX={2} paddingBottom={1}>
        <Text color="cyan" bold>
          {status === "streaming" ? "⟳ " : "▶ "}
        </Text>
        {status !== "streaming" ? (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={sendMessage}
            placeholder="Say something…"
          />
        ) : (
          <Text dimColor>Characters are responding…</Text>
        )}
      </Box>
    </Box>
  );
}
