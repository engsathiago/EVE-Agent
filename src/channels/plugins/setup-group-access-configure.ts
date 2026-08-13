/**
 * Channel setup group access configurator.
 *
 * Applies prompted group policy and allowlist entries through channel-specific hooks.
 */
import type { EVEConfig } from "../../config/types.eve.js";
import type { WizardPrompter } from "../../wizard/prompts.js";
import { promptChannelAccessConfig, type ChannelAccessPolicy } from "./setup-group-access.js";

/**
 * Applies prompted group access config through channel-specific policy/allowlist hooks.
 */
export async function configureChannelAccessWithAllowlist<TResolved>(params: {
  cfg: EVEConfig;
  prompter: WizardPrompter;
  label: string;
  currentPolicy: ChannelAccessPolicy;
  currentEntries: string[];
  placeholder: string;
  updatePrompt: boolean;
  skipAllowlistEntries?: boolean;
  setPolicy: (cfg: EVEConfig, policy: ChannelAccessPolicy) => EVEConfig;
  resolveAllowlist?: (params: { cfg: EVEConfig; entries: string[] }) => Promise<TResolved>;
  applyAllowlist?: (params: { cfg: EVEConfig; resolved: TResolved }) => EVEConfig;
}): Promise<EVEConfig> {
  let next = params.cfg;
  const accessConfig = await promptChannelAccessConfig({
    prompter: params.prompter,
    label: params.label,
    currentPolicy: params.currentPolicy,
    currentEntries: params.currentEntries,
    placeholder: params.placeholder,
    updatePrompt: params.updatePrompt,
    skipAllowlistEntries: params.skipAllowlistEntries,
  });
  if (!accessConfig) {
    return next;
  }
  if (accessConfig.policy !== "allowlist") {
    // Non-allowlist policies intentionally bypass resolver hooks so stale
    // allowlist entries are not re-applied after choosing open/disabled.
    return params.setPolicy(next, accessConfig.policy);
  }
  if (params.skipAllowlistEntries || !params.resolveAllowlist || !params.applyAllowlist) {
    return params.setPolicy(next, "allowlist");
  }
  const resolved = await params.resolveAllowlist({
    cfg: next,
    entries: accessConfig.entries,
  });
  next = params.setPolicy(next, "allowlist");
  return params.applyAllowlist({
    cfg: next,
    resolved,
  });
}
