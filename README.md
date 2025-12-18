# Logic Puzzle Generator

![Version](https://img.shields.io/github/package-json/v/joshhills/logic-puzzle-generator)
![Tests](https://github.com/joshhills/logic-puzzle-generator/actions/workflows/test.yml/badge.svg?label=Tests)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)


A TypeScript library for generating, solving, and verifying "Zebra Puzzle" style logic grid puzzles.

Unlike standard generators, this library creates **goal-oriented puzzles**: you can specify a "Target Fact" (e.g., "What snack does David eat?") that will be the final deduction required to complete the puzzle. The generator ensures a step-by-step logical path exists to reach this conclusion when facts are presented in a specific order.

The intention is for this library to empower narrative designers to create mysteries that are both solvable and engaging.

## Features

- **Goal-Oriented Generation**: Targeted generation ensures the puzzle builds towards a specific revelation.
- **Goal-Oriented Generation**: Targeted generation ensures the puzzle builds towards a specific revelation.
- **Rich Clue Types**: 
    - **Binary**: IS / IS NOT
    - **Ordinal**: Older/Younger + Negative (Not Before/After)
    - **Cross-Ordinal**: Transitive relationships across different ordinal axes + Negated (Match/Not Match).
    - **Superlative**: Extremes (Oldest/Youngest) + Negative (Not Oldest).
    - **Unary**: Properties (Even/Odd).
- **Complexity Variance**: The generator intelligently varies clue complexity to create a balanced puzzle flow.
- **Clue Constraints**: Filter which clue types are allowed (e.g., disable Ordinal clues) for custom difficulty.
- **Proof Chain**: Generates a full step-by-step solution path ("Proof Chain").
- **Type-Safe**: Written in TypeScript with comprehensive type definitions.
- **Configurable**: Define your own categories, values, and constraints.

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
const targetFact = {
    category1Id: 'Name',
    value1: 'David',
    category2Id: 'Snack',
};

// 3. Generate the puzzle
const generator = new Generator(12345); // Seed ensures reproducibility
const puzzle: Puzzle = generator.generatePuzzle(categories, targetFact);

// 4. View the results
console.log('The Clues:');
puzzle.clues.forEach((clue, i) => console.log(`${i + 1}.`, clue));

console.log('\nThe Solution Path:');
puzzle.proofChain.forEach(step => {
    console.log(`- Applied clue type ${step.clue.type}, made ${step.deductions} deductions.`);
});
```

## Core Concepts

### Categories
- **Nominal**: Categories where order doesn't matter (e.g., Names, Colors, Snacks).
- **Ordinal**: Categories that have an inherent order (e.g., Age, Price, Floor Number). These unlock special clues like "The person eating Chips is older than Alice".

## Configuration

The `generatePuzzle` method takes an array of `CategoryConfig` objects.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the category (e.g., "Color"). |
| `type` | `CategoryType` | `NOMINAL` (unordered) or `ORDINAL` (ordered integers). |
| `values` | `(string\|number)[]` | Array of possible values. Must be unique. If `ORDINAL`, must be sorted numbers. |

### Error Handling

The library provides strict validation. Invalid configurations will throw a `ConfigurationError`.

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

1.  **Solution Seeding**: A valid, consistent solution grid is randomly generated first.
2.  **Clue Generation**: Every possible true clue (Binary, Ordinal, etc.) is generated based on this solution.
3.  **Heuristic Selection**: The solver iteratively selects the "best" clue to add to the puzzle. The "best" clue is determined by a scoring function that balances:
    *   **Synergy**: Does it lead to new deductions when combined with existing clues?
    *   **Completeness**: Does it help eliminate impossible options?
    *   **Complexity**: Is it an interesting clue type (e.g., `Superlative` > `Binary`)?
4.  **Penalties**: To ensure variety, the score is penalized if:
    *   The clue refers to entities already mentioned frequently.
    *   The clue type is repeated (preventing boring lists of "IS/IS NOT" clues).
    *   The clue is redundant (adds no new information).
5.  **Termination**: The process repeats until the `Target Fact` is logically deducible from the selected clues alone.

## Performance & Scalability

The library is optimized for performance and scales to handle complex puzzle grids using a heuristic sampling approach.

| Type | Dimensions | Complexity | Optimization | Avg Time | Success Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Standard** | 3 cats, 4 vals | Low | None | ~19ms | 100% |
| **Medium** | 4 cats, 5 vals | Medium | None | ~600ms | 100% |
| **Large** | 5 cats, 5 vals | High | None | ~3.1s | 100% |
| **Wide** | 6 cats, 4 vals | High | `maxCandidates: 200` | ~1.9s | 100% |
| **Tall** | 3 cats, 8 vals | Medium | None | ~616ms | 100% |
| **Stress** | 8 cats, 5 vals | Extreme | `maxCandidates: 50` | ~7.5s | 100% |

*Benchmarks run on a standard consumer laptop (M1 MacBook Air)*.

### Large Puzzles
For puzzles with 6+ categories or high complexity, use the `maxCandidates` option in `generatePuzzle` to trade a small amount of "perfect logical elegance" for massive performance gains. This limits the search space at each step while ensuring the puzzle remains fully solvable.

### Controlling Clue Count
By default, the generator produces the most efficient puzzle it can find. To target a specific difficulty or length, you can request an exact number of clues.

1.  **Estimate Feasibility**: First, check what is possible for your grid.
    ```typescript
    const bounds = await generator.getClueCountBounds(categories, target); 
    // -> { min: 4, max: 12 }
    ```
2.  **Generate**:
    ```typescript
    const puzzle = generator.generatePuzzle(categories, target, {
        targetClueCount: 8, // Must be within feasible range
        maxCandidates: 100
    });
    ```
    > **Note**: This uses a backtracking algorithm and is slower (~2x) than standard generation. It may throw an error if the target is impossible to hit within the timeout.

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
The main class.
- `constructor(seed: number)`: Initialize with a seed for reproducible results.
- `generatePuzzle(categories, target, options)`: Returns a `Puzzle` object.
- `getClueCountBounds(categories, target)`: Returns plausible Min/Max clue counts.

### `LogicGrid`
Manages the state of the puzzle grid (possibility matrix).
- `isPossible(cat1, val1, cat2, val2)`: Returns true if a connection is possible.
- `setPossibility(...)`: Manually set states (useful for custom solvers).

### `Solver`
The logical engine.
- `applyClue(grid, clue)`: Applies a clue and cascades deductions.

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
