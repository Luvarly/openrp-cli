import { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import { type Scenario } from "../lib/scenarios";
import { type Message, type ToolEvent, streamCompletion } from "../lib/api";
import {
  type Character,
  type CharacterMap,
  loadCharacters,
  upsertCharacter,
  updateMood,
  buildSystemPrompt,
} from "../lib/characters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  scenario: Scenario;
  onBack: () => void;
}

type Status = "idle" | "streaming" | "error";

// Speech entries are self-contained — display info embedded at creation time.
type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "speech"; name: string; icon: string; color: string; text: string }
  | { kind: "narrator"; text: string }
  | { kind: "system"; text: string };

// ─── Layout constants ─────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 24; // includes border chars
const HEADER_LINES = 3; // icon+title row + divider
const FOOTER_LINES = 3; // divider + input row + bottom padding
const H_PADDING = 4; // paddingX={2} each side

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
        // hard-break words longer than maxWidth
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
// We pre-compute how many terminal lines each entry consumes so we can
// fill the pane from the bottom without relying on Ink's overflow clipping.

function entryLineCount(entry: ChatEntry, contentWidth: number): number {
  switch (entry.kind) {
    case "user":
      return 1 + wrapText(entry.text, contentWidth - 2).length + 1; // label + lines + margin
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
  const innerWidth = SIDEBAR_WIDTH - 4; // borders + padding
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
  const innerWidth = contentWidth - 2; // 2-char indent

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

export default function ChatScreen({ scenario, onBack }: Props) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 100;
  const termHeight = stdout?.rows ?? 30;

  // Exact pixel budget for the chat pane
  const chatPaneWidth = termWidth - SIDEBAR_WIDTH - H_PADDING;
  const contentWidth = Math.max(20, chatPaneWidth); // never go negative
  const chatPaneHeight = termHeight - HEADER_LINES - FOOTER_LINES;

  // ── State ──
  const [characters, setCharacters] = useState<CharacterMap>(() =>
    loadCharacters(scenario.id),
  );
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Ref always has latest characters — safe to read inside async callbacks.
  const charactersRef = useRef<CharacterMap>(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useInput((_ch, key) => {
    if (key.escape) onBack();
  });

  // ── Visible entries — fill from bottom up to chatPaneHeight ───────────────

  const visibleEntries = (() => {
    // reserve 1 line for the cursor blink when streaming
    const budget = chatPaneHeight - (status === "streaming" ? 1 : 0);
    let used = 0;
    const result: ChatEntry[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const lines = entryLineCount(entries[i], contentWidth);
      if (used + lines > budget) break;
      result.unshift(entries[i]);
      used += lines;
    }
    return result;
  })();

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || status === "streaming") return;

    setInput("");
    setStatus("streaming");

    const userMsg: Message = { role: "user", content: text };
    setEntries((prev) => [...prev, { kind: "user", text }]);
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);

    const sysPrompt = buildSystemPrompt(
      scenario.systemPrompt,
      charactersRef.current,
    );

    await streamCompletion(nextHistory.slice(-40), sysPrompt, scenario.model, {
      onTool(event: ToolEvent, _id: string) {
        if (event.type === "create_character") {
          const c: Character = { ...event.input, createdAt: Date.now() };
          // Update ref synchronously so speak_as calls in the same batch see it.
          const updated = upsertCharacter(
            scenario.id,
            c,
            charactersRef.current,
          );
          charactersRef.current = updated;
          setCharacters(updated);
          setEntries((prev) => [
            ...prev,
            {
              kind: "system",
              text: `${c.icon} ${c.name} has entered the scene.`,
            },
          ]);
        } else if (event.type === "speak_as") {
          const { character_id, content, mood_after } = event.input;
          // Read from ref — React state may not have flushed yet.
          const char = charactersRef.current[character_id];
          setEntries((prev) => [
            ...prev,
            {
              kind: "speech",
              name: char?.name ?? character_id,
              icon: char?.icon ?? "?",
              color: char?.color ?? "white",
              text: content,
            },
          ]);
          if (mood_after && char) {
            const updated = updateMood(
              scenario.id,
              character_id,
              mood_after,
              charactersRef.current,
            );
            charactersRef.current = updated;
            setCharacters(updated);
          }
        } else if (event.type === "narrator") {
          setEntries((prev) => [
            ...prev,
            { kind: "narrator", text: event.input.content },
          ]);
        }
      },

      onTextChunk(_chunk: string) {
        // tool_choice:"required" means no plain text; nothing to do.
      },

      onDone(assistantMsg, toolResultMsgs) {
        setHistory([...nextHistory, assistantMsg, ...toolResultMsgs]);
        setStatus("idle");
      },

      onError(err: string) {
        setErrorMsg(err);
        setStatus("error");
      },
    });
  }, [input, history, status, scenario]);

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
        </Text>
      </Box>
      <Box paddingX={2}>
        <Text dimColor>{"─".repeat(Math.min(termWidth - 4, 80))}</Text>
      </Box>

      {/* ── Body ── */}
      <Box flexDirection="row" height={chatPaneHeight}>
        {/* Chat pane — fixed height, never overflows */}
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

        {/* Sidebar — fixed width, never shrinks */}
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
