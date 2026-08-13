// Whatsapp plugin module implements outbound test support behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export function createWhatsAppPollFixture() {
  const cfg = { marker: "resolved-cfg" } as EVEConfig;
  const poll = {
    question: "Lunch?",
    options: ["Pizza", "Sushi"],
    maxSelections: 1,
  };
  return {
    cfg,
    poll,
    to: "+1555",
    accountId: "work",
  };
}
