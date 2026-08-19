# AI Coding Agent Guide

Welcome to the **Logic Puzzle Generator** repository! This document contains essential instructions and context for AI coding agents operating on this codebase.

---

## 1. Core Documentation & Terms of Use

- **Primary Source of Truth**: Always read [`README.md`](./README.md) before designing, modifying, or extending features. It documents the complete public API surface, core concepts (Nominal vs. Ordinal categories, clue types, proof chains, red herrings, difficulty estimation), and architectural guidelines.
- **AI Disclosure & Liability**: Refer to the *AI Disclosure & Liability Policy* in [`README.md`](./README.md). Any generated code, algorithms, or modifications must adhere to MIT license requirements and maintain strict solvability and determinism guarantees.

---

## 2. Codebase Architecture

The core engine is located under `src/`:

| File / Directory | Description |
| :--- | :--- |
| [`src/types.ts`](./src/types.ts) | Fundamental types: `CategoryConfig`, `CategoryType`, `ClueType`, `TargetFact`, `ProofStep`, `RedHerringOptions`, etc. |
| [`src/engine/Generator.ts`](./src/engine/Generator.ts) | Core puzzle generator, heuristic scoring, forward search, backtracking, and red herring synthesis. |
| [`src/engine/Solver.ts`](./src/engine/Solver.ts) | Forward-chaining deduction engine, clue applicators, and contradiction checker. |
| [`src/engine/LogicGrid.ts`](./src/engine/LogicGrid.ts) | Possibility matrix representation and elimination tracking. |
| [`src/engine/GenerativeSession.ts`](./src/engine/GenerativeSession.ts) | Stateful session manager for interactive, step-by-step puzzle creation and live proof-chain editing. |
| [`src/engine/Clue.ts`](./src/engine/Clue.ts) | Class hierarchy for all clue variants (Binary, Ordinal, Superlative, Unary, Between, Adjacency, Cross-Ordinal, Disjunction, Arithmetic). |
| [`src/engine/determinism.ts`](./src/engine/determinism.ts) | Seeded PRNG helpers, engine-agnostic stable sort, and Fisher-Yates shuffle. |
| [`src/index.ts`](./src/index.ts) | Public package export barrel. |

---

## 3. Engineering & Quality Standards

1. **Determinism**: The engine is strictly deterministic across platforms (Node, V8, React Native Hermes, browsers). Never use `Math.random()` or unseeded sorting. Always use the seeded PRNG (`mulberry32`) and helpers from `determinism.ts`.
2. **Backward Compatibility**: Any new feature (e.g., Red Herrings) must be opt-in and default to 0 / disabled, ensuring existing API consumers experience zero behavioral regressions.
3. **Comprehensive Testing**:
   - Tests live in `test/`.
   - Run `npm test` before submitting any change.
   - Every new feature, option, or bugfix must be covered with unit tests, boundary tests, and regression tests.
4. **Build & Type Checking**:
   - Run `npm run build` to verify TypeScript compilation (`tsc`) and definition emission.

---

## 4. Release & Deployment Workflows

Releases and site deployments are automated via GitHub Actions in `.github/workflows/`:

1. **NPM Package Release ([`.github/workflows/npm-publish.yml`](./.github/workflows/npm-publish.yml))**:
   - Triggered on push to the `main` branch.
   - Inspects `package.json`. If the `version` field has been incremented (e.g., `1.3.8` -> `1.4.0`), the workflow runs tests, builds the distribution, and automatically publishes the new package version to NPM.
   - **How to release**: Bump the `"version"` field in [`package.json`](./package.json), commit, and push to `main`.

2. **Interactive Demo Site Deployment ([`.github/workflows/deploy-site.yml`](./.github/workflows/deploy-site.yml))**:
   - Triggered on push to `main` when changes touch `src/**` or `site/**`.
   - Automatically builds the web application in `site/` and deploys the latest version to GitHub Pages (`gh-pages` branch).
