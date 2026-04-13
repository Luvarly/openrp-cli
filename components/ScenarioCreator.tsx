import { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { type Scenario, saveScenario } from "../lib/scenarios.js";

interface Props {
  onComplete: (scenario: Scenario) => void;
  onBack: () => void;
}

type Step = "title" | "description" | "icon" | "systemPrompt";

export default function ScenarioCreator({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>("title");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("✨");
  const [systemPrompt, setSystemPrompt] = useState("");

  useInput((_ch, key) => {
    if (key.escape) onBack();
  });

  const handleSubmit = () => {
    if (step === "title") {
      if (title.trim()) setStep("description");
    } else if (step === "description") {
      if (description.trim()) setStep("icon");
    } else if (step === "icon") {
      if (icon.trim()) setStep("systemPrompt");
    } else if (step === "systemPrompt") {
      if (systemPrompt.trim()) {
        const id = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const scenario: Scenario = {
          id,
          title: title.trim(),
          description: description.trim(),
          icon: icon.trim(),
          systemPrompt: systemPrompt.trim(),
          model: "deepseek/deepseek-v3.2",
          isCustom: true,
          starterCharacters: []
        };
        saveScenario(scenario);
        onComplete(scenario);
      }
    }
  };

  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="magenta">
        ✦ Scenario Creator ✦
      </Text>
      <Text dimColor>{"─".repeat(50)}</Text>
      <Box marginBottom={1} />

      {step === "title" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>Scenario Title:</Text>
          <Text dimColor>e.g. Cyberpunk Heist</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={title}
              onChange={setTitle}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "description" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>Short Description:</Text>
          <Text dimColor>e.g. A high-stakes infiltration in Neo-Tokyo</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "icon" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>Icon (emoji):</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={icon}
              onChange={setIcon}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "systemPrompt" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>System Prompt (World & Tone):</Text>
          <Text dimColor>
            Use {"<WORLD>"} and {"<TONE>"} tags to define the setting and behavior rules.
          </Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={systemPrompt}
              onChange={setSystemPrompt}
              onSubmit={handleSubmit}
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
