// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "eve-agent/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "eve-agent/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "eve-agent/plugin-sdk/plugin-test-runtime";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
