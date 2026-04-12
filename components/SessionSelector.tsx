import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { type Scenario } from "../lib/scenarios.js";
import {
  type Session,
  listSessions,
  deleteSession,
} from "../lib/sessions.js";

interface Props {
  scenario: Scenario;
  onNew: () => void;
  onLoad: (session: Session) => void;
  onBack: () => void;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function SessionSelector({ scenario, onNew, onLoad, onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>(() =>
    listSessions(scenario.id),
  );

  // 0 = "New session", 1..n = saved sessions
  const [selected, setSelected] = useState(0);
  const total = sessions.length + 1; // +1 for "New"

  useInput((_, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => Math.min(total - 1, s + 1));
      return;
    }
    if (key.return) {
      if (selected === 0) {
        onNew();
      } else {
        const session = sessions[selected - 1];
        if (session) onLoad(session);
      }
      return;
    }
    if (_ === "d" || _ === "D") {
      if (selected > 0) {
        const session = sessions[selected - 1];
        if (session) {
          deleteSession(scenario.id, session.id);
          const next = sessions.filter((s) => s.id !== session.id);
          setSessions(next);
          // If we deleted the last item, move cursor up
          if (selected >= next.length + 1) {
            setSelected(Math.max(0, next.length));
          }
        }
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          {scenario.icon}{"  "}
          <Text color="white" bold>{scenario.title}</Text>
        </Text>
        <Text dimColor>
          ↑↓ navigate · Enter select · D delete session · Esc back
        </Text>
      </Box>

      {/* New session option */}
      <Box marginBottom={1}>
        <Text color={selected === 0 ? "magenta" : "gray"}>
          {selected === 0 ? "▶ " : "  "}
        </Text>
        <Text bold={selected === 0} color={selected === 0 ? "cyan" : "gray"}>
          + New session
        </Text>
      </Box>

      {sessions.length > 0 && (
        <>
          <Text dimColor>{"─".repeat(36)}</Text>
          <Text dimColor color="gray">Saved sessions</Text>
          <Box marginBottom={0} />
        </>
      )}

      {sessions.map((session, i) => {
        const idx = i + 1;
        const isActive = idx === selected;
        return (
          <Box key={session.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={isActive ? "magenta" : "gray"}>
                {isActive ? "▶ " : "  "}
              </Text>
              <Text bold={isActive} color={isActive ? "white" : "gray"}>
                {formatDate(session.savedAt)}
              </Text>
            </Box>
            <Box>
              <Text color="gray">{"    "}</Text>
              <Text
                dimColor={!isActive}
                color={isActive ? "yellow" : "gray"}
                italic
              >
                {session.preview}
              </Text>
            </Box>
            {isActive && (
              <Box>
                <Text color="gray">{"    "}</Text>
                <Text dimColor>
                  {session.entries.filter((e) => e.kind === "user").length} messages
                  {" · "}
                  {Object.keys(session.characters).length} characters
                  {" · "}
                  <Text color="red" dimColor>D to delete</Text>
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
