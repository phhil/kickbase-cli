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
