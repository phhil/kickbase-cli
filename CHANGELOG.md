# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Command discovery with `kb search` / `kb find`
- Global runtime flags support (`--json`, `--verbose`, `--base-url`)
- Improved human-readable outputs across leagues, competitions, matches, live, base, chat, and challenges commands
- Better typo handling and command suggestions

### Fixed
- Multiple payload field mismatches discovered via live API exploration
- TypeScript build issues in command modules

## [1.0.0] - 2026-02-26

### Added
- Initial CLI wrapper for Kickbase API
