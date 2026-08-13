// Whatsapp plugin module implements doctor contract behavior.
import type { ChannelDoctorConfigMutation } from "eve-agent/plugin-sdk/channel-contract";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: EVEConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
