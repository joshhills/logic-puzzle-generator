# Logic Puzzle Generator

![Version](https://img.shields.io/github/package-json/v/joshhills/logic-puzzle-generator)
![Tests](https://github.com/joshhills/logic-puzzle-generator/actions/workflows/test.yml/badge.svg?label=Tests)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

[View the interactive demo](https://project.joshhills.dev/logic-puzzle-generator/)

![Interactive Demo Screenshot](./demo.png)


A TypeScript library for generating, solving, and verifying "Zebra Puzzle" style logic grid puzzles.

Unlike standard generators, this library creates **goal-oriented puzzles**: you can specify a "Target Fact" (e.g., "What snack does David eat?") that will be the final deduction required to complete the puzzle. The generator ensures a step-by-step logical path exists to reach this conclusion when facts are presented in a specific order.

The intention is for this library to empower narrative designers to create mysteries that are both solvable and engaging.

## Features

- **Goal-Oriented Generation**: Targeted generation ensures the puzzle builds towards a specific revelation. (Note: A target is naturally selected if none is provided, ensuring every puzzle behaves as a coherent mystery.)
- **Rich Clue Types**: 
    - **Binary**: IS / IS NOT
    - **Ordinal**: Older/Younger + Negative (Not Before/After)
    - **Cross-Ordinal**: Transitive relationships across different ordinal axes + Negated (Match/Not Match).
    - **Superlative**: Extremes (Oldest/Youngest) + Negative (Not Oldest).
    - **Unary**: Properties (Even/Odd). Requires at least one ordinal category that contains a mix of both odd and even numeric values.
- **Complexity Variance**: The generator intelligently varies clue complexity to create a balanced puzzle flow.
- **Clue Constraints**: Filter which clue types are allowed (e.g., disable Ordinal clues) for custom difficulty.
- **Proof Chain**: Generates a full step-by-step solution path ("Proof Chain").
- **Type-Safe**: Written in TypeScript with comprehensive type definitions.
- **Configurable**: Define your own categories, values, and constraints.
- **Reproducible**: Seed-based RNG ensures deterministic results. The seed controls:
    - **Solution Generation**: The underlying logic grid truth.
    - **Target Selection**: Which fact serves as the mystery focus.
    - **Clue Template Variation**: Randomization of names, values, and sentence structures.
    - **Search & Scoring**: The order in which candidates are evaluated.

## Installation

```bash
npm install logic-puzzle-generator
```

## Quick Start

Here's how to generate a simple puzzle where you want to find out what "David" is eating.

```typescript
import { Generator, CategoryType, Puzzle } from 'logic-puzzle-generator';

// 1. Define your categories
const categories = [
    { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'David'] },
    { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy'] },
    { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40] }, // Ordinal allows for 'older/younger' clues
];

// 2. Define the target fact (The "Goal" of the puzzle)
// We want the solver to deduce that 'Name: David' is linked to a specific value in 'Snack'.
// Note: If you omit this, the generator will pick a random mystery for you.
const targetFact = {
    category1Id: 'Name',
    value1: 'David',
    category2Id: 'Snack',
};

// 3. Generate the puzzle
const generator = new Generator(12345); // Seed controls solution generation, target selection, and clue variation.
const puzzle: Puzzle = generator.generatePuzzle(categories, targetFact);

// 4. View the results
console.log('The Clues:');
puzzle.clues.forEach((clue, i) => console.log(`${i + 1}.`, clue));

// 5. Inspect the Logic
console.log('\nThe Solution Path:');
console.log(JSON.stringify(puzzle.proofChain[0], null, 2)); 
// Example Output:
// {
//   "clue": { "type": "binary", "cat1": "Name", "val1": "Alice", "cat2": "Snack", "val2": "Popcorn", "operator": "is" },
//   "deductions": 2
// }
```

## Core Concepts

### Categories
- **Nominal**: Categories where order doesn't matter (e.g., Names, Colors, Snacks).
- **Ordinal**: Categories that have an inherent order (e.g., Age, Price, Floor Number). These unlock special clues like "The person eating Chips is older than Alice".
  > **Note**: Ordinal values must be numbers. ConfigurationError will be thrown if strings are provided.

## Configuration

The `generatePuzzle` method takes an array of `CategoryConfig` objects.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the category (e.g., "Color"). |
| `type` | `CategoryType` | `NOMINAL` (unordered) or `ORDINAL` (ordered integers). |
| `values` | `(string\|number)[]` | Array of possible values. Must be unique. If `ORDINAL`, must be sorted numbers. |

### Error Handling

The library provides strict validation. A `ConfigurationError` is thrown in the following scenarios:
1.  **Invalid Ordinals**: Providing non-numeric values for a category marked as `ORDINAL`.
2.  **Duplicate Values**: Categories contain duplicate value entries.
3.  **Invalid Target**: The requested `Target Fact` refers to a category or value that does not exist.
4.  **Impossible Constraints**: A custom constraint or seed results in immediate contradiction.
5.  **Ambiguous Constraints**: Providing *only* "Weak" clue types (`UNARY`, `SUPERLATIVE`) results in an unsolvable puzzle. The configuration must include at least one "Strong" type (`BINARY`, `ORDINAL`, or `CROSS_ORDINAL`) to uniquely resolve identities.

```typescript
import { ConfigurationError } from 'logic-puzzle-generator';

try {
    const puzzle = generator.generatePuzzle(invalidConfig, target);
} catch (err) {
    if (err instanceof ConfigurationError) {
        console.error("Config Error:", err.message);
    }
}
```

## How It Works

### The Algorithm
The generator uses a **Forward-Chaining Heuristic Search** to build the puzzle:

1.  **Solution Seeding**: A valid, consistent solution grid is randomly generated based on the seed.
2.  **Clue Generation**: Every possible true clue (Binary, Ordinal, etc.) is generated based on this solution.
3.  **Heuristic Selection**: The solver iteratively selects the "best" clue to add to the puzzle. The "best" clue is determined by a scoring function that balances:
    *   **Synergy**: Does it lead to new deductions when combined with existing clues?
    *   **Completeness**: Does it help eliminate impossible options?
    *   **Complexity**: Is it an interesting clue type (e.g., `Superlative` > `Binary`)?
4.  **Penalties**: To ensure variety, the score is penalized if:
    *   The clue refers to **Solution Groups** (specific entity combinations) that are already mentioned frequently.
    *   The clue type is repeated (preventing boring lists of "IS/IS NOT" clues).
    *   The clue is redundant (adds no new information).
5.  **Termination**: The process repeats until the `Target Fact` is logically deducible from the selected clues alone.

## Performance & Scalability

The library is optimized for performance and uses heuristic sampling.

| Dimensions | Approx Time | Notes |
| :--- | :--- | :--- |
| **3 cats, 4 vals** | ~20ms | Instant generation. |
| **4 cats, 5 vals** | ~600ms | Standard logic puzzle size. |
| **5 cats, 5 vals** | ~3s | Large, complex grid. |
| **8 cats, 5 vals** | ~8s | Extreme. Use `maxCandidates: 50` for speed. |

### Large Puzzles
For puzzles with 6+ categories or high complexity, use the `maxCandidates` option in `generatePuzzle`. This limits the search space at each step (e.g. only check random 50 clues instead of 1000s) to keep generation fast while maintaining solvability.

### Controlling Clue Count
By default, the generator produces the most efficient puzzle it can find. To target a specific difficulty or length, you can request an exact number of clues.

1.  **Estimate Feasibility**:
    ```typescript
    const bounds = generator.getClueCountBounds(categories, target); 
    // -> { min: 4, max: 12 }
    ```
2.  **Generate**:
    ```typescript
    const puzzle = generator.generatePuzzle(categories, target, {
        targetClueCount: 8, // Must be within feasible range
        maxCandidates: 100,
        timeoutMs: 180000 // Recommended: Give it time (3 mins) to find exact matches
    });
    ```

    > **Note**: This uses a **Hybrid Iterative Correction** algorithm. If the generator detects it is falling behind or solving too fast, it switches strategies (Stall vs Speed) and commits to them ("Sticky Strategy") to navigate complex search spaces. This ensures effective pathfinding for hard targets (e.g., 26 clues on 4x4).

### Clues
The generator produces four types of clues:
1.  **Binary**: Direct relationships. "Alice eats Chips" or "Bob does NOT eat Popcorn".
2.  **Ordinal**: Comparisons. "The person eating Chips is younger than Bob" or "Alice is NOT older than Charlie".
3.  **Cross-Ordinal**: Complex relativity. "The item before Alice (Age) is the item after Bob (Cost)".
4.  **Superlative**: Extremes. "Alice is the oldest" or "Bob is NOT the youngest".
5.  **Unary**: Properties. "The person eating Chips is an even age".

### The Proof Chain
The generator solves the puzzle as it builds it. The `puzzle.proofChain` array contains the optimal order of clues to solve the grid. This is useful for building hint systems or verify difficulty.

## API Reference

### `Generator`
The main class. Use `new Generator(seed)` to initialize.

- `generatePuzzle(categories, target?, options?)`: Returns a `Puzzle` object.
    - `target` (Optional): The `TargetFact` to solve for. If omitted, a random target is selected.
    - `options.targetClueCount`: Attempt to find exact solution length. Avoids early termination.
    - `options.maxCandidates`: Performance tuning (default 50). Limits the heuristic search width.
    - `options.timeoutMs`: Abort generation if it exceeds this limit (default 10000ms).
    - `options.constraints`: Filter allowed clue types.
        - `allowedClueTypes`: `ClueType[]` (e.g. `[ClueType.BINARY, ClueType.ORDINAL]`).
    - `options.onTrace`: **(Debug)** Callback `(msg: string) => void`. Receives real-time logs about the generation process.
- `generatePuzzleAsync(...)`: **New in v1.1.0**. Non-blocking version of `generatePuzzle`. Returns `Promise<Puzzle>`.
- `getClueCountBounds(categories, target)`: Returns plausible Min/Max clue counts.
- `getClueCountBoundsAsync(...)`: **New in v1.1.0**. Non-blocking version. Returns `Promise<{ min, max }>`.
- `startSession(categories, target?)`: [Beta] Starts a `GenerativeSession` for step-by-step interactive generation.

#### Advanced / Internal API
- `calculateClueScore(grid, target, deductions, clue, ...)`: **(Extensible)** detailed heuristic scoring for clue selection.
- `isPuzzleSolved(grid, solution, ...)`: Checks if the grid matches the unique solution.
- `generateAllPossibleClues(...)`: Generates every valid clue for the current configuration (unfiltered).

### Extensibility
The `Generator` class is designed to be extensible. Key methods like `calculateClueScore` are `public`, allowing you to extend the class and inject custom heuristics.

### `LogicGrid`
Manages the state of the puzzle grid (possibility matrix).
- `constructor(categories: CategoryConfig[])`: Initializes a new grid.
- `isPossible(cat1, val1, cat2, val2)`: Returns true if a connection is possible.
- `setPossibility(cat1, val1, cat2, val2, state)`: Manually set connection state.
- `getPossibilitiesCount(cat1, val1, cat2)`: Returns the number of remaining possibilities for a value in a target category.
- `getGridStats()`: Returns `{ totalPossible, currentPossible, solutionPossible }` to track solving progress.
- `clone()`: Creates a deep copy of the grid.

### `Solver`
The logical engine responsible for applying clues and performing deductions.
- `applyClue(grid, clue)`: Applies a clue and cascades deductions. Returns `{ deductions: number }`.
- `runDeductionLoop(grid)`: repeatedly applies elimination logic until the grid stabilizes.

#### Internal Deduction Methods
- `applyBinaryClue(grid, clue)`
- `applyOrdinalClue(grid, clue)`
- `applyCrossOrdinalClue(grid, clue)`
- `applySuperlativeClue(grid, clue)`
- `applyUnaryClue(grid, clue)`

### `GenerativeSession`
Manages a stateful, step-by-step puzzle generation process.
- `getNextClue(constraints?)`: Returns `{ clue: Clue | null, remaining: number, solved: boolean }`.
    - Generates and selects the next best clue based on the current grid state.
    - `constraints`: Optional `ClueGenerationConstraints`.
- `getNextClueAsync(constraints?)`: **New in v1.1.1**. Non-blocking version. Returns `Promise<{ clue, remaining, solved }>`.
- `rollbackLastClue()`: Returns `{ success: boolean, clue: Clue | null }`. Undoes the last step.
- `getGrid()`: Returns the current `LogicGrid` state.
- `getSolution()`: Returns the target `Solution` map.
- `getProofChain()`: Returns the list of `Clue`s applied so far.
- `getValueMap()`: Returns the optimized internal value categorization map.

### Data Types

#### `CategoryConfig`
Configuration for a single category.
```typescript
interface CategoryConfig {
  id: string; // e.g. "Suspect"
  values: string[]; // e.g. ["Mustard", "Plum"...]
  type: CategoryType; // NOMINAL | ORDINAL
}
```

#### `TargetFact`
Defines the goal of the puzzle (e.g., "Who killed Mr. Boddy?").
```typescript
interface TargetFact {
  category1Id: string;
  value1: string;
  category2Id: string;
}
```

#### `ClueType`
Enum for available clue logic: `BINARY` (Direct), `ORDINAL` (Comparison), `CROSS_ORDINAL` (Relative), `SUPERLATIVE` (Min/Max), `UNARY` (Properties).

## Interactive Generation (Builder Mode)

For UIs where you want to watch the puzzle being built (or let the user manually pick the next clue type), use the `GenerativeSession`.

```typescript
const session = generator.startSession(categories, target);
let solved = false;

while (!solved) {
    // 1. Get the next best clue (optionally force a specific type)
    const result = session.getNextClue({ 
        allowedClueTypes: [ClueType.BINARY, ClueType.ORDINAL] 
    });

    if (result.clue) {
        console.log("Next Clue:", result.clue);
        solved = result.solved;
    } else {
        console.warn("No more clues available.");
        break;
    }
}
```

## Error Handling

The library uses specific error types to help you debug configuration issues.

| Method | Throws | Reason |
| :--- | :--- | :--- |
| Method | Throws | Reason |
| :--- | :--- | :--- |
| `new Generator()` | `Error` | If `seed` is invalid (NaN). |
| `generatePuzzle()` | `ConfigurationError` | **Configuration**: <br> - Less than 2 categories. <br> - `maxCandidates` < 1. <br> - `targetClueCount` < 1. <br> **Target Fact**: <br> Refers to non-existent category/value or uses same category twice. <br> **Constraints**: <br> - Ambiguous (Weak) types only. <br> - Requesting `ORDINAL` without Ordinal categories. <br> - Requesting `CROSS_ORDINAL` with < 2 Ordinal categories. <br> - Requesting `UNARY` (Even/Odd) without mixed numeric values. <br> **Data**: <br> - `ORDINAL` category contains non-numeric values. <br> **Runtime**: <br> - Could not find solution with exact `targetClueCount` within timeout. |
| `startSession()` | `ConfigurationError` | - Less than 2 categories. |
| `LogicGrid()` | `ConfigurationError` | - Duplicate Category IDs <br> - Duplicate Values within a category <br> - Mismatched value counts (all categories must be same size). |




## AI Disclosure & Liability Policy

### Transparency Statement
This project utilizes artificial intelligence (AI) tools to assist in the generation of code, logic algorithms, and documentation. While human oversight is rigorously applied, portions of the codebase are AI-generated.

### Copyright and Licensing
- **Human Contribution**: The project structure, architectural decisions, core logic verification, and test suites are human-authored and covered by the standard project license.
- **AI-Generated Content**: To the extent that AI-generated content is not eligible for copyright protection, it is dedicated to the public domain. Where copyrightable, it is licensed under the MIT license alongside human contributions.

### "AS IS" and Liability Waiver
This software is provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

### Accuracy Warning
While all code is reviewed and tested, complete accuracy cannot be guaranteed. Users are responsible for verifying that the puzzle generation logic meets the strict requirements of their specific use cases.

## License
MIT
