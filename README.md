# kickbase-cli

CLI wrapper for the Kickbase fantasy football API.

This project is designed for personal automation, scripting, and analytics workflows on top of Kickbase data.

## Status

- Works as a developer-friendly CLI and JSON data collector (`--json`)
- Supports many read-only endpoints across leagues, competitions, matches, live events, chat, and challenges
- Suitable as a foundation for a separate analytics app

## Important Disclaimer

- This CLI uses an unofficial/private API surface.
- API payloads and endpoints can change without notice.
- Use responsibly and review Kickbase terms of service before broader/public/commercial use.
- Be careful with credentials, tokens, and session files.

## Installation

```bash
npm install
```

## Usage

Run directly in dev mode:

```bash
npm run kickbase -- --help
```

Examples:

```bash
npm run kickbase -- user login --email you@example.com --password '...'
npm run kickbase -- leagues list
npm run kickbase -- --json leagues market 7202758
npm run kickbase -- competitions matchdays 1
```

## JSON Mode (For Automation)

Use `--json` to get stable machine-readable envelopes:

```bash
npm run kickbase -- --json leagues list
```

This is the recommended mode when building collectors or analytics pipelines.

## Agent Mode (Tool JSON v2)

Use `--agent` for strict machine output:

```bash
npm run kickbase -- --agent tools list
npm run kickbase -- --agent tools describe leagues.market
npm run kickbase -- --agent run leagues.ranking --args '{"argv":["7202758"],"options":{}}'
```

Agent envelope v2 fields:
- `ok`, `tool`, `schema_version`, `result`, `error`, `warnings`, `next_actions`, `meta`

## Write Safety (Policy + Approval + Idempotency)

Write operations are guarded:
1. path must match write allowlist
2. policy scope must allow league/tool
3. active approval session required
4. `--idempotency-key` required

Commands:

```bash
npm run kickbase -- --agent policy show
npm run kickbase -- --agent policy validate
npm run kickbase -- --agent policy set --data '{"allowed_leagues":["7202758"]}'
npm run kickbase -- --agent approval open --ttl-minutes 15 --league 7202758
npm run kickbase -- --agent --idempotency-key op-123 leagues market-sell 7202758 123
```

## Build

```bash
npm run build
```

## Versioning & Releases

This repo uses semantic versioning.

- Patch release: `npm run release:patch`
- Minor release: `npm run release:minor`
- Major release: `npm run release:major`

Suggested release flow:

1. Update `CHANGELOG.md`
2. Run a version script (`release:patch|minor|major`)
3. Push commits and tags
4. Create a GitHub Release from the tag

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

## License

MIT (see [`LICENSE`](./LICENSE))
