// Public EVE policy contract. Phase one is intentionally empty and permissive.
export {
  EVE_POLICY_VERSION,
  allowEveAction,
  createEmptyEvePolicy,
  evaluateEvePolicy,
  type EvePolicyDecision,
  type EvePolicyDocument,
  type EvePolicyRequest,
} from "./src/contract.js";
