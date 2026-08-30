---
summary: "Exposes EVE's empty phase-one behavioral policy contract."
read_when:
  - You are installing, configuring, or auditing the policy plugin
title: "Policy plugin"
---

# Policy plugin

Exposes EVE's empty phase-one behavioral policy contract.

## Distribution

- Package: `@eve/policy`
- Install route: included in EVE

## Surface

plugin

<!-- eve-plugin-reference:manual-start -->

## Behavior

The plugin registers the optional `eve policy` CLI command. Its version 1
contract has no rules and always returns `allow`. It does not add runtime hooks,
doctor checks, prompt instructions, policy files, or behavioral restrictions.

Enable the plugin only when you want to inspect that explicit empty contract:

```bash
eve plugins enable policy
eve policy --json
```

Technical authentication, capability, validation, resource, and
operator-configured controls remain separate from this EVE-owned behavioral
policy surface.

<!-- eve-plugin-reference:manual-end -->

## Related docs

- [Policy CLI](/cli/policy)
- [Owner-controlled policy](/concepts/owner-policy)
