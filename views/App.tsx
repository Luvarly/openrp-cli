import { useState } from "react";
import { useInput, useApp } from "ink";
import { type Scenario } from "../lib/scenarios.js";
import ScenarioSelector from "../components/ScenarioSelector.js";
import ChatScreen from "../components/ChatScreen.js";

type Screen = "select" | "chat";

export default function App() {
  const [screen, setScreen] = useState<Screen>("select");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const { exit } = useApp();

  useInput((ch) => {
    if (ch === "q" && screen === "select") exit();
  });

  if (screen === "chat" && scenario) {
    return (
      <ChatScreen
        scenario={scenario}
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
        setScreen("chat");
      }}
    />
  );
}
