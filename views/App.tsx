import { useState } from "react";
import { useInput, useApp } from "ink";
import { type Scenario } from "../lib/scenarios.js";
import { type Session, listSessions } from "../lib/sessions.js";
import ScenarioSelector from "../components/ScenarioSelector.js";
import SessionSelector from "../components/SessionSelector.js";
import ChatScreen from "../components/ChatScreen.js";

type Screen = "select" | "session" | "chat";

export default function App() {
  const [screen, setScreen] = useState<Screen>("select");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [initialSession, setInitialSession] = useState<Session | undefined>(undefined);
  const { exit } = useApp();

  useInput((ch) => {
    if (ch === "q" && screen === "select") exit();
  });

  if (screen === "chat" && scenario) {
    return (
      <ChatScreen
        scenario={scenario}
        initialSession={initialSession}
        onBack={() => {
          setScreen("select");
          setScenario(null);
          setInitialSession(undefined);
        }}
      />
    );
  }

  if (screen === "session" && scenario) {
    return (
      <SessionSelector
        scenario={scenario}
        onNew={() => {
          setInitialSession(undefined);
          setScreen("chat");
        }}
        onLoad={(session) => {
          setInitialSession(session);
          setScreen("chat");
        }}
        onBack={() => {
          setScreen("select");
          setScenario(null);
        }}
      />
    );
  }

  return (
    <ScenarioSelector
      onSelect={(s) => {
        setScenario(s);
        // Skip session screen if no saves exist for this scenario
        const saved = listSessions(s.id);
        setScreen(saved.length > 0 ? "session" : "chat");
      }}
    />
  );
}
