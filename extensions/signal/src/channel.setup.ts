// Signal plugin module implements channel.setup behavior.
import type { ChannelPlugin } from "eve-agent/plugin-sdk/core";
import type { ResolvedSignalAccount } from "./accounts.js";
import { signalSetupAdapter } from "./setup-core.js";
import { createSignalPluginBase, signalSetupWizard } from "./shared.js";

export const signalSetupPlugin: ChannelPlugin<ResolvedSignalAccount> = {
  ...createSignalPluginBase({
    setupWizard: signalSetupWizard,
    setup: signalSetupAdapter,
  }),
};
