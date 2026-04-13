import { useState, useEffect } from "react";
import { useInput, useApp } from "ink";
import { SCENARIOS, type Scenario } from "../lib/scenarios.js";
import { type Session, type Player, listSessions, findSessionById } from "../lib/sessions.js";
import { loadConfig } from "../lib/config.js";
import ScenarioSelector from "../components/ScenarioSelector.js";
import SessionSelector from "../components/SessionSelector.js";
import GlobalSessionSelector from "../components/GlobalSessionSelector.js";
import PlayerSetup from "../components/PlayerSetup.js";
import ChatScreen from "../components/ChatScreen.js";
import ConfigScreen from "../components/ConfigScreen.js";

type Screen = "config" | "select" | "global_session" | "session" | "setup" | "chat";

interface Props {
  initialCommand?: string;
  initialArg?: string;
}

export default function App({ initialCommand, initialArg }: Props) {
  const [screen, setScreen] = useState<Screen>("select");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [initialSession, setInitialSession] = useState<Session | undefined>(undefined);
  const [player, setPlayer] = useState<Player | undefined>(undefined);
  const { exit } = useApp();

  // On mount, check config and initial arguments
  useEffect(() => {
    const cfg = loadConfig();
    if (!cfg.apiKey && cfg.apiUrl === "https://openrouter.ai/api/v1/chat/completions") {
      // Prompt for config on first run if they haven't set an API key but are using openrouter
      setScreen("config");
      return;
    }

    if (initialCommand === "resume") {
      if (initialArg) {
        const s = findSessionById(initialArg);
        if (s) {
          const sc = SCENARIOS.find((x) => x.id === s.scenarioId);
          if (sc) {
            setScenario(sc);
            setInitialSession(s);
            setPlayer(s.player);
            setScreen("chat");
            return;
          }
        }
      }
      setScreen("global_session");
    }
  }, [initialCommand, initialArg]);

  useInput((ch) => {
    if (ch === "q" && screen === "select") exit();
  });

  if (screen === "config") {
    return (
      <ConfigScreen
        onComplete={() => {
          if (initialCommand === "resume") {
            setScreen("global_session");
          } else {
            setScreen("select");
          }
        }}
      />
    );
  }

  if (screen === "global_session") {
    return (
      <GlobalSessionSelector
        onLoad={(session) => {
          const sc = SCENARIOS.find((x) => x.id === session.scenarioId);
          if (sc) {
            setScenario(sc);
            setInitialSession(session);
            setPlayer(session.player);
            setScreen("chat");
          }
        }}
        onBack={() => {
          if (initialCommand === "resume") exit();
          else setScreen("select");
        }}
      />
    );
  }

  if (screen === "setup" && scenario) {
    return (
      <PlayerSetup
        scenario={scenario}
        onComplete={(p) => {
          setPlayer(p);
          setScreen("chat");
        }}
        onBack={() => {
          const saved = listSessions(scenario.id);
          setScreen(saved.length > 0 ? "session" : "select");
          if (saved.length === 0) setScenario(null);
        }}
      />
    );
  }

  if (screen === "chat" && scenario) {
    return (
      <ChatScreen
        scenario={scenario}
        initialSession={initialSession}
        player={player}
        onBack={() => {
          if (initialCommand === "resume") exit();
          setScreen("select");
          setScenario(null);
          setInitialSession(undefined);
          setPlayer(undefined);
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
          setPlayer(undefined);
          setScreen("setup");
        }}
        onLoad={(session) => {
          setInitialSession(session);
          setPlayer(session.player);
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
        const saved = listSessions(s.id);
        setScreen(saved.length > 0 ? "session" : "setup");
      }}
    />
  );
}
