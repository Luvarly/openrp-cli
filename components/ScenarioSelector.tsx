import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getScenarios, deleteScenario, type Scenario } from "../lib/scenarios.js";

interface Props {
  onSelect: (scenario: Scenario) => void;
  onCreate: () => void;
}

export default function ScenarioSelector({ onSelect, onCreate }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setScenarios(getScenarios());
  }, []);

  const total = scenarios.length + 1; // +1 for "Create New"

  useInput((_, key) => {
    if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => Math.min(total - 1, s + 1));
      return;
    }
    if (key.return) {
      if (selected === scenarios.length) {
        onCreate();
      } else {
        const scenario = scenarios[selected];
        if (scenario) onSelect(scenario);
      }
      return;
    }
    if (_ === "d" || _ === "D") {
      if (selected < scenarios.length) {
        const scenario = scenarios[selected];
        if (scenario && scenario.isCustom) {
          deleteScenario(scenario.id);
          setScenarios(getScenarios());
          setSelected(Math.max(0, selected - 1));
        }
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          ╔══════════════════════════════════════╗
        </Text>
        <Text bold color="magenta">
          {"║       "}
          <Text color="white" bold>
            ✦ ROLEPLAY TERMINAL ✦
          </Text>
          {"       ║"}
        </Text>
        <Text bold color="magenta">
          ╚══════════════════════════════════════╝
        </Text>
      </Box>

      <Text dimColor>Choose your scenario ↑↓ navigate · Enter select</Text>
      <Box marginBottom={1} />

      {scenarios.map((scenario, i) => {
        const isActive = i === selected;
        return (
          <Box key={scenario.id} flexDirection="column" marginBottom={0}>
            <Box>
              <Text color={isActive ? "magenta" : "gray"}>
                {isActive ? "▶ " : "  "}
              </Text>
              <Text bold={isActive} color={isActive ? "white" : "gray"}>
                {scenario.icon}
                {"  "}
                <Text color={isActive ? "cyan" : "gray"} bold={isActive}>
                  {scenario.title}
                </Text>
                {"  "}
                <Text dimColor={!isActive} color={isActive ? "white" : "gray"}>
                  — {scenario.description}
                </Text>
                {scenario.isCustom && <Text color="yellow" dimColor> (Custom)</Text>}
              </Text>
            </Box>
            {isActive && scenario.isCustom && (
              <Box>
                <Text color="gray">{"    "}</Text>
                <Text color="red" dimColor>D to delete custom scenario</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Create New Option */}
      <Box marginBottom={1} marginTop={1}>
        <Text color={selected === scenarios.length ? "magenta" : "gray"}>
          {selected === scenarios.length ? "▶ " : "  "}
        </Text>
        <Text bold={selected === scenarios.length} color={selected === scenarios.length ? "cyan" : "gray"}>
          + Create Custom Scenario
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>q · quit</Text>
      </Box>
    </Box>
  );
}
