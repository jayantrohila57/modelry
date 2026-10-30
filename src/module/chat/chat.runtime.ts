export const CHAT_TEMPERATURE_PRESETS = ["low", "medium", "high"] as const;

export type ChatTemperaturePreset = (typeof CHAT_TEMPERATURE_PRESETS)[number];
export const CHAT_REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ChatReasoningEffort = (typeof CHAT_REASONING_EFFORTS)[number];

export function getTemperatureFromPreset(level: ChatTemperaturePreset) {
  switch (level) {
    case "low":
      return 0.2;
    case "high":
      return 0.8;
    default:
      return 0.5;
  }
}

export function formatTemperaturePresetLabel(level: ChatTemperaturePreset) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} · ${getTemperatureFromPreset(level)}`;
}

export function formatReasoningEffortLabel(effort: ChatReasoningEffort) {
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

export function deriveAutoThreadTitleFromText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Untitled chat";
  }

  return normalized.slice(0, 80);
}
