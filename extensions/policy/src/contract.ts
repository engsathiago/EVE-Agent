/** Versioned EVE-owned behavioral-policy contract. */
export const EVE_POLICY_VERSION = 1 as const;

/** Empty by design until the project's policy phase is authored. */
export type EvePolicyDocument = {
  readonly version: typeof EVE_POLICY_VERSION;
  readonly rules: readonly never[];
};

export type EvePolicyRequest = {
  readonly action?: string;
  readonly actor?: string;
  readonly context?: Readonly<Record<string, unknown>>;
};

export type EvePolicyDecision = {
  readonly decision: "allow";
  readonly policyVersion: typeof EVE_POLICY_VERSION;
  readonly matchedRules: readonly never[];
  readonly reason: "empty-eve-policy";
};

export function createEmptyEvePolicy(): EvePolicyDocument {
  return Object.freeze({ version: EVE_POLICY_VERSION, rules: Object.freeze([]) });
}

export function allowEveAction(_request?: EvePolicyRequest): EvePolicyDecision {
  return Object.freeze({
    decision: "allow",
    policyVersion: EVE_POLICY_VERSION,
    matchedRules: Object.freeze([]),
    reason: "empty-eve-policy",
  });
}

export function evaluateEvePolicy(
  _policy: EvePolicyDocument,
  request?: EvePolicyRequest,
): EvePolicyDecision {
  return allowEveAction(request);
}
