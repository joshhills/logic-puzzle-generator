```
# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.1] - 2026-01-12
### Fixed
- **Semantics**: Critical fix for negative ordinal clues (e.g., "NOT AFTER" was incorrectly rendering as "has more"). Now correctly renders as "does not have more" or "is not after".

## [1.3.0] - 2026-01-12
### Added
- **Feature**: Explainable Deductions (XAI). Users can now see "Explain Logic" for every deduction step.
- **Feature**: Puzzle Play Timer. Track your solve time with Pause/Resume/Reset relative to the session.
- **UI**: Added Custom Modals for Timer Reset to replace native browser alerts.

### Fixed
- **Polish**: Fix pluralization of "updates" count (e.g., "1 update" vs "2 updates").

## [1.2.3] - 2025-12-23
### Changed
- **UI**: Refined search button layout to separate row ("Search - Generate - Undo").
- **UI**: Fixed "Generate" button layout shift by enforcing fixed width on "Search" button.
- **UI**: Removed redundant "Find Specific Clues" header.

## [1.2.2] - 2025-12-23
### Fixed
- **UI**: Fixed search results not refreshing when puzzle state changes (e.g. adding or undoing a clue).
- **Engine**: Added regression test for dynamic score updates.

## [1.2.1] - 2025-12-23
### Fixed
- **Engine**: Fixed `minDeductions` filter in search results (deductions were not being filtered correctly).
- **UI**: Renamed "Whitelist/Blacklist" to "Include/Exclude Subjects (Allowlist/Disallowlist)" for clarity.

## [1.2.0] - 2025-12-23
### Added
- **Engine**: Scored Search API (`getScoredMatchingClues`) returning heuristic scores and deduction counts.
- **Engine**: Direct Answer detection (`isDirectAnswer`) to identify clues that reveal the target fact.
- **Engine**: Public methods for clue counting (`getTotalClueCount`, `getMatchingClueCount`) and manual application (`useClue`).
- **UI**: Interactive Search Panel with live reactivity and spoiler protection.
- **UI**: Visual indicators for key clues.

## [1.1.9] - 2024-05-24

### Features
* **Engine:** Added `includeSubjects`, `excludeSubjects`, and `minDeductions` constraints to `GenerativeSession`.
* **Game Support:** Enabled advanced mechanics (questioning specific suspects, filler clues).

### Fixes
* **Release:** Updated CI to use Node.js 24 to ensure npm >= 11.5.1 for trusted publishing compatibility.

## [1.1.8] (2025-12-23)

### Fixes
* **Release:** strict config alignment with Trusted Publishing docs (trailing slash, auto-provenance).

## [1.1.7] (2025-12-23)

### Fixes
* **Release:** Simplified `repository` field to GitHub shorthand to ensure provenance matching.

## [1.1.6] (2025-12-23)

### Fixes
* **Release:** Restored `registry-url` and canonicalized `repository` URL (removed `.git`) to satisfy strict OIDC matching.

## [1.1.5] (2025-12-23)

### Fixes
* **Release:** Removed `registry-url` from workflow to fix Trusted Publishing authentication.

## [1.1.4] (2025-12-23)

### Fixes
* **Release:** Standardized `repository` URL format in `package.json`.

## [1.1.3] (2025-12-22)

### Fixes
* **Release:** Added missing `repository` field to `package.json` to support provenance.

## [1.1.2] (2025-12-22)

### Fixes
* **Release:** Fixed npm publish workflow configuration for Trusted Publishing.

## [1.1.1] (2025-12-22)

### Features
* **GenerativeSession:** Added `getNextClueAsync` for non-blocking interactive generation.

## [1.1.0] (2025-12-22)

### Features
* **Generator:** Added `generatePuzzleAsync` and `getClueCountBoundsAsync` for non-blocking generation.

## [1.0.0] (2025-12-22)

### Features
* **Release:** Initial stable release.

### [0.2.2](https://github.com/joshhills/logic-puzzle-generator/compare/v0.2.1...v0.2.2) (2025-12-16)

### [0.2.1](https://github.com/joshhills/logic-puzzle-generator/compare/v0.2.0...v0.2.1) (2025-12-16)

## [0.2.0](https://github.com/joshhills/logic-puzzle-generator/compare/v0.1.0...v0.2.0) (2025-12-16)

## 0.1.0 (2025-12-16)


### Features

* initial implementation of logic-puzzle-generator ([91bf2fb](https://github.com/joshhills/logic-puzzle-generator/commit/91bf2fb164517dfe32a22d95c487a21a9c0d183b))
