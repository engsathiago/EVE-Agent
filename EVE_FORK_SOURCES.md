# EVE source provenance

EVE is an independent derivative project assembled from permissively licensed
software and original EVE integrations.

## OpenClaw base

- Repository: https://github.com/openclaw/openclaw.git
- Commit: 66f84a9bf1082de26f92b2b3741cc2f34aba34fa
- Version at import: 2026.6.8
- License: MIT
- Imported as the complete initial runtime tree.

## Athena feature reference

- Repository: https://github.com/engsathiago/athena-agent.git
- Commit: b5679bc2b659c581bd91b2b108a294297fd4330a
- Version at review: 0.4.0
- License: MIT
- Athena contains substantial modified portions of Hermes Agent and retains
  the corresponding Nous Research notices.

Athena features are ported onto EVE's OpenClaw-derived TypeScript contracts.
The Python Athena/Hermes runtime is not installed as a second agent core.

## Required notices

The original copyright notices and license terms remain in LICENSE and
THIRD_PARTY_NOTICES.md. Rebranding does not remove historical attribution,
third-party package names, protocol compatibility notes, or source provenance.
