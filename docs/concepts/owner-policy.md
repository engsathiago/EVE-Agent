---
summary: "EVE phase-one policy contract and the boundaries reserved for owner-authored policy"
read_when:
  - You need to know which policy EVE adds to model behavior
  - You want to design owner-controlled policy for a later phase
  - You are distinguishing behavioral policy from technical runtime controls
title: "Owner-controlled policy"
sidebarTitle: "Owner policy"
---

EVE does not add a project-owned behavioral policy in phase one. Its versioned
first-party policy contract contains zero rules and returns `allow` for every
action it evaluates. New workspaces also receive an empty runtime `SOUL.md`.

This leaves the future policy surface under the owner's control instead of
inheriting refusal rules, political guidance, content restrictions, or generic
external-action confirmations from another agent project.

## What is empty

EVE currently injects no project-owned:

- behavioral restriction or refusal rule;
- political or ideological instruction;
- content policy;
- generic requirement to ask before an external action;
- owner-authored safety policy;
- default personality policy in `SOUL.md`.

The runtime still provides technical instructions needed to call tools, route
messages, maintain sessions, and use configured capabilities. Those instructions
describe interfaces; they are not an owner behavioral policy.

## What remains external or technical

An empty EVE policy does not remove constraints that EVE does not own:

- a model provider can enforce its own model or account policy;
- an external API or communication service can reject a request;
- an operating system can deny filesystem, process, camera, or network access;
- Gateway authentication and sender pairing decide who can reach the agent;
- enabled tools and plugins determine which capabilities exist;
- path validation, protocol validation, timeouts, quotas, Docker limits, and
  data-integrity checks protect runtime correctness;
- an operator can explicitly configure sandbox, tool, channel, or approval
  controls for a particular installation.

These are capability, identity, resource, and integrity boundaries. They do not
add a hidden behavioral policy to the model.

## Prepare phase two

Design the owner policy as a separate, reviewable layer. A useful phase-two
process is:

1. list the decisions the owner wants EVE to make consistently;
2. separate behavioral rules from authentication and technical permissions;
3. define precedence and scope for global, agent, channel, and task rules;
4. add an explainable decision record and tests for each rule;
5. version the policy schema and provide migrations before changing defaults;
6. keep `SOUL.md` for voice and stance, and keep enforceable policy in a typed
   policy service.

Until that design is approved, leave the EVE policy contract empty.

## Verify the current contract

After onboarding, inspect the generated workspace files:

```bash
test ! -s ~/.eve/workspace/SOUL.md
eve doctor --non-interactive
```

`SOUL.md` can later contain owner-authored personality or policy text. Editing
it is explicit operator configuration and is not an EVE default.

## Related

- [EVE platform](/concepts/eve-platform)
- [Agent workspace](/concepts/agent-workspace)
- [System prompt](/concepts/system-prompt)
- [SOUL.md personality guide](/concepts/soul)
