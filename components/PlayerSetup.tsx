import { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { type Scenario } from "../lib/scenarios.js";
import { type Player } from "../lib/sessions.js";

interface Props {
  scenario: Scenario;
  onComplete: (player: Player) => void;
  onBack: () => void;
}

type Step = "name" | "description";

export default function PlayerSetup({ scenario, onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useInput((_ch, key) => {
    if (key.escape) onBack();
  });

  const handleSubmit = () => {
    if (step === "name") {
      if (name.trim()) setStep("description");
    } else {
      if (description.trim()) {
        onComplete({ name: name.trim(), description: description.trim() });
      }
    }
  };

  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="magenta">
        {scenario.icon} {scenario.title} — Character Creation
      </Text>
      <Text dimColor>{"─".repeat(50)}</Text>
      <Box marginBottom={1} />

      {step === "name" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>What is your character's name?</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={name}
              onChange={setName}
              onSubmit={handleSubmit}
              placeholder="e.g. John Doe"
            />
          </Box>
        </Box>
      )}

      {step === "description" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>Describe your character (appearance, backstory, traits):</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={handleSubmit}
              placeholder="e.g. A weary traveler with a hidden past..."
            />
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>Enter to continue · Esc to go back</Text>
      </Box>
    </Box>
  );
}
