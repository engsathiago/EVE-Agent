// Qwen tests cover provider discovery.contract plugin behavior.
import { describeModelStudioProviderDiscoveryContract } from "eve-agent/plugin-sdk/provider-test-contracts";

describeModelStudioProviderDiscoveryContract(() => import("./index.js"));
