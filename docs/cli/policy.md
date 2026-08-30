---
summary: "CLI reference for the empty phase-one EVE policy contract"
read_when:
  - You want to inspect the EVE-owned behavioral policy contract
  - You need to distinguish behavioral rules from technical runtime controls
  - You are preparing owner-authored policy for a later phase
title: "Policy"
---

# `eve policy`

`eve policy` is provided by the bundled Policy plugin. In phase one, its only
purpose is to expose a versioned, inspectable contract for policy that EVE owns.
The contract contains zero rules and every evaluation returns `allow`.

EVE does not load `policy.jsonc`, register policy health checks, inject policy
text into the model prompt, or enforce project-authored refusal rules in this
phase.

## Enable and inspect the contract

The plugin is optional. Enable it when you want the CLI inspection surface:

```bash
eve plugins enable policy
eve policy
eve policy --json
```

Human output reports:

```text
EVE policy: empty (allow-all)
contract version: 1
rules: 0
Future EVE-owned policy rules will be added in phase two.
```

JSON output has this shape:

```json
{
  "ok": true,
  "mode": "empty-allow-all",
  "version": 1,
  "policy": { "version": 1, "rules": [] },
  "decision": {
    "decision": "allow",
    "policyVersion": 1,
    "matchedRules": [],
    "reason": "empty-eve-policy"
  },
  "note": "No EVE behavioral restrictions are defined in phase one."
}
```

There are no `check`, `compare`, `watch`, attestation, doctor-conformance, or
policy-file subcommands in the phase-one contract.

## What “empty policy” means

EVE currently adds no owner-independent behavioral restriction, political or
ideological instruction, content rule, generic external-action confirmation,
or project-authored refusal rule. The default runtime `SOUL.md` is also empty.

An empty EVE policy does not change rules owned by a model provider or external
service. It also does not remove technical boundaries such as authentication,
configured tool availability, operating-system permissions, protocol and data
validation, timeouts, quotas, or an operator's explicit sandbox and approval
configuration. Those boundaries define who can access a capability and whether
the software can execute it correctly; they are not hidden EVE behavioral
policy.

## Phase two

Future rules must be authored, versioned, documented, and approved as EVE-owned
policy. Until that work is explicitly implemented, the contract remains empty
and permissive.

## Related

- [Owner-controlled policy](/concepts/owner-policy)
- [EVE platform](/concepts/eve-platform)
- [System prompt](/concepts/system-prompt)
