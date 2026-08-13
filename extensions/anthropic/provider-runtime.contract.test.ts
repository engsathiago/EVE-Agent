// Anthropic tests cover provider runtime.contract plugin behavior.
import { describeAnthropicProviderRuntimeContract } from "eve-agent/plugin-sdk/provider-test-contracts";

describeAnthropicProviderRuntimeContract(() => import("./index.js"));
