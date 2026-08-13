// Qqbot plugin module implements qqbot test support behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export function makeQqbotSecretRefConfig(): EVEConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as EVEConfig;
}

export function makeQqbotDefaultAccountConfig(): EVEConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as EVEConfig;
}
