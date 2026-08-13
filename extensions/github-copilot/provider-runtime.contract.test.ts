// Github Copilot tests cover provider runtime.contract plugin behavior.
import { describeGithubCopilotProviderRuntimeContract } from "eve-agent/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderRuntimeContract(() => import("./index.js"));
