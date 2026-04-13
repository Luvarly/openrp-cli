import { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { loadConfig, saveConfig, type Config } from "../lib/config.js";

interface Props {
  onComplete: () => void;
}

type Step = "apiUrl" | "apiKey";

export default function ConfigScreen({ onComplete }: Props) {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [step, setStep] = useState<Step>("apiUrl");

  const handleSubmit = () => {
    if (step === "apiUrl") {
      setStep("apiKey");
    } else {
      saveConfig(config);
      onComplete();
    }
  };

  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="magenta">
        ✦ OpenRP Configuration ✦
      </Text>
      <Text dimColor>{"─".repeat(50)}</Text>
      <Box marginBottom={1} />

      {step === "apiUrl" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>OpenAI-Compatible API URL:</Text>
          <Text dimColor>(Default: https://openrouter.ai/api/v1/chat/completions)</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={config.apiUrl}
              onChange={(val) => setConfig({ ...config, apiUrl: val })}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "apiKey" && (
        <Box flexDirection="column">
          <Text color="cyan" bold>API Key:</Text>
          <Text dimColor>(Leave blank if using a local model without auth)</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text color="yellow">▶ </Text>
            <TextInput
              value={config.apiKey}
              onChange={(val) => setConfig({ ...config, apiKey: val })}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>Enter to save and continue</Text>
      </Box>
    </Box>
  );
}
