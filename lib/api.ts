import { CHARACTER_TOOLS } from "./characters";

// ─── OpenAI-native message types (what OpenRouter actually speaks) ────────────

export interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallMessage {
  role: "assistant";
  content: null;
  tool_calls: OpenAIToolCall[];
}

export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export type Message = TextMessage | ToolCallMessage | ToolResultMessage;

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ─── Typed tool events ────────────────────────────────────────────────────────

export type ToolEvent =
  | { type: "create_character"; input: CreateCharacterInput }
  | { type: "speak_as"; input: SpeakAsInput }
  | { type: "narrator"; input: NarratorInput };

export interface CreateCharacterInput {
  id: string;
  name: string;
  icon: string;
  description: string;
  personality: string;
  voice: string;
  color: "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
  mood: string;
}

export interface SpeakAsInput {
  character_id: string;
  content: string;
  mood_after?: string;
}

export interface NarratorInput {
  content: string;
}

// ─── Callbacks ────────────────────────────────────────────────────────────────

export interface StreamCallbacks {
  /** Called once per fully-parsed tool call, in order, after stream ends */
  onTool: (event: ToolEvent, toolCallId: string) => void;
  /** Plain text chunk — emitted live during streaming for any stray text */
  onTextChunk: (chunk: string) => void;
  /**
   * Stream is fully done.
   * assistantMsg    — append to history
   * toolResultMsgs  — append after assistantMsg (one per tool call)
   */
  onDone: (assistantMsg: Message, toolResultMsgs: ToolResultMessage[]) => void;
  onError: (err: string) => void;
}

// ─── Tools in OpenAI format ───────────────────────────────────────────────────

const OPENAI_TOOLS = CHARACTER_TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

// ─── Main streaming function ──────────────────────────────────────────────────

export async function streamCompletion(
  messages: Message[],
  systemPrompt: string,
  model: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    callbacks.onError("OPENROUTER_API_KEY not found in environment.");
    return;
  }

  const body = {
    model,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools: OPENAI_TOOLS,
    // "required" forces the model to always use at least one tool —
    // this prevents it from replying with plain prose instead of speak_as/narrator.
    tool_choice: "required",
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/openrp",
        "X-Title": "OpenRP",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      callbacks.onError(`API error ${res.status}: ${err}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks.onError("No response body.");
      return;
    }

    const decoder = new TextDecoder();
    let streamBuffer = "";
    let accText = "";

    // Tool call accumulators keyed by their stream index
    const toolAccs: Record<number, { id: string; name: string; args: string }> =
      {};

    // ── Read the entire stream before doing anything with tools ──────────────
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      streamBuffer += decoder.decode(value, { stream: true });
      const lines = streamBuffer.split("\n");
      streamBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        let json: any;
        try {
          json = JSON.parse(trimmed.slice(6));
        } catch {
          continue;
        }

        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;

        // Accumulate plain text (and emit live so UI feels responsive)
        if (typeof delta.content === "string" && delta.content) {
          accText += delta.content;
          callbacks.onTextChunk(delta.content);
        }

        // Accumulate tool call argument fragments
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx: number = tc.index ?? 0;
            if (!toolAccs[idx]) toolAccs[idx] = { id: "", name: "", args: "" };
            const a = toolAccs[idx];
            if (tc.id) a.id = tc.id;
            if (tc.function?.name) a.name += tc.function.name;
            if (tc.function?.arguments) a.args += tc.function.arguments;
          }
        }
      }
    }

    // ── Stream done — now safely process tool calls ───────────────────────────

    const sortedIndices = Object.keys(toolAccs)
      .map(Number)
      .sort((a, b) => a - b);

    // Build OpenAI-format tool_calls array for the assistant message
    const toolCalls: OpenAIToolCall[] = sortedIndices
      .map((idx) => {
        const a = toolAccs[idx];
        if (!a.name) return null;
        return {
          id: a.id || `call_${idx}`,
          type: "function" as const,
          function: { name: a.name, arguments: a.args },
        };
      })
      .filter((x): x is OpenAIToolCall => x !== null);

    // The assistant message we'll store in history
    const assistantMsg: Message =
      toolCalls.length > 0
        ? { role: "assistant", content: null, tool_calls: toolCalls }
        : { role: "assistant", content: accText };

    // Fire tool events in order + build tool result messages
    const toolResultMsgs: ToolResultMessage[] = [];

    for (const idx of sortedIndices) {
      const a = toolAccs[idx];
      if (!a.name) continue;

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(a.args);
      } catch {
        parsed = {};
      }

      const toolCallId = a.id || `call_${idx}`;

      if (a.name === "create_character") {
        callbacks.onTool(
          { type: "create_character", input: parsed as CreateCharacterInput },
          toolCallId,
        );
      } else if (a.name === "speak_as") {
        callbacks.onTool(
          { type: "speak_as", input: parsed as SpeakAsInput },
          toolCallId,
        );
      } else if (a.name === "narrator") {
        callbacks.onTool(
          { type: "narrator", input: parsed as NarratorInput },
          toolCallId,
        );
      }

      toolResultMsgs.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: "ok",
      });
    }

    callbacks.onDone(assistantMsg, toolResultMsgs);
  } catch (e: any) {
    callbacks.onError(e.message ?? "Unknown error");
  }
}
