import { pluginRegistrationContractCases } from "eve-agent/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "eve-agent/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract(pluginRegistrationContractCases.parallel);
