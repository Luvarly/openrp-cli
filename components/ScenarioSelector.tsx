import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { SCENARIOS, type Scenario } from "../lib/scenarios.js";

interface Props {
  onSelect: (scenario: Scenario) => void;
}

export default function ScenarioSelector({ onSelect }: Props) {
  const [selected, setSelected] = useState(0);

  useInput((_, key) => {
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow)
      setSelected((s) => Math.min(SCENARIOS.length - 1, s + 1));
    if (key.return) onSelect(SCENARIOS[selected]!);
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

      {SCENARIOS.map((scenario, i) => {
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
              </Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>q · quit</Text>
      </Box>
    </Box>
  );
}
