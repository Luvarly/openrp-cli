import { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  type Session,
  listAllSessions,
  deleteSession,
} from "../lib/sessions.js";
import { getScenarios } from "../lib/scenarios.js";

interface Props {
  onLoad: (session: Session) => void;
  onBack: () => void;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function GlobalSessionSelector({ onLoad, onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>(listAllSessions);

  const [selected, setSelected] = useState(0);

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
      setSelected((s) => Math.min(sessions.length - 1, s + 1));
      return;
    }
    if (key.return) {
      const session = sessions[selected];
      if (session) onLoad(session);
      return;
    }
    if (_ === "d" || _ === "D") {
      const session = sessions[selected];
      if (session) {
        deleteSession(session.scenarioId, session.id);
        const next = sessions.filter((s) => s.id !== session.id);
        setSessions(next);
        if (selected >= next.length && next.length > 0) {
          setSelected(next.length - 1);
        }
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          <Text color="white" bold>All Saved Sessions</Text>
        </Text>
        <Text dimColor>
          ↑↓ navigate · Enter select · D delete session · Esc exit
        </Text>
      </Box>

      {sessions.length === 0 && (
        <Text dimColor italic>No saved sessions found.</Text>
      )}

      {sessions.map((session, i) => {
        const isActive = i === selected;
        const allScenarios = getScenarios();
        const scenario = allScenarios.find(s => s.id === session.scenarioId);
        const title = scenario ? `${scenario.icon} ${scenario.title}` : session.scenarioId;
        return (
          <Box key={session.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={isActive ? "magenta" : "gray"}>
                {isActive ? "▶ " : "  "}
              </Text>
              <Text bold={isActive} color={isActive ? "white" : "gray"}>
                {title} — {formatDate(session.savedAt)}
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
                  ID: {session.id} {" · "}
                  {session.entries.filter((e) => e.kind === "user").length} msgs
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
