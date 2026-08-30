# Contributing to EVE

EVE is maintained as an independent agent platform at
[`engsathiago/eve-agent`](https://github.com/engsathiago/eve-agent).

## Before you start

- Use Node.js 22.19 or newer; Node.js 24 is recommended.
- Use pnpm for source checkouts.
- Read [AGENTS.md](AGENTS.md) and the nearest scoped `AGENTS.md` before editing.
- Keep the core plugin-agnostic. Optional channels, providers, tools, and
  integrations belong in plugins when the existing SDK supports them.
- Do not edit `CHANGELOG.md` for normal changes; release automation owns it.

## Set up the repository

```bash
git clone https://github.com/engsathiago/eve-agent.git
cd eve-agent
corepack enable
pnpm install
pnpm build
```

Run EVE from the checkout with `pnpm eve <command>`.

## Propose a change

1. Open an issue for product behavior, architecture, or a large feature.
2. Keep each pull request focused on one problem.
3. Explain the problem, implementation choice, user impact, and evidence.
4. Include tests for changed behavior and screenshots for visible UI changes.
5. Keep branches editable by maintainers when GitHub offers that option.

Use these pull-request sections:

- `What Problem This Solves`
- `Why This Change Was Made`
- `User Impact`
- `Evidence`

Mark AI-assisted contributions and include a redacted transcript when useful.

## Validate the change

Start with the narrowest test that covers the edited surface:

```bash
node scripts/run-vitest.mjs path/to/file.test.ts
```

For production TypeScript changes, run the relevant strict lane:

```bash
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
```

Run `pnpm build` for packaging, plugin boundaries, dynamic imports, or public
runtime changes. Documentation changes should pass the checks listed in
[docs/AGENTS.md](docs/AGENTS.md).

Before commit, follow the repository's mandatory fresh autoreview process.
Commit through `scripts/committer` and stage only intended files.

## Security reports

Do not open public issues containing credentials, private state, or an
unpatched exploitable vulnerability. Use the private reporting channel exposed
by the GitHub repository's Security tab. Include affected versions,
reproduction steps, demonstrated impact, and a proposed remediation when
possible.

## License and attribution

By contributing, you agree that your contribution is distributed under the
repository's MIT license. Preserve notices in `LICENSE`,
`THIRD_PARTY_NOTICES.md`, and `EVE_FORK_SOURCES.md` when modifying derived or
third-party code.
