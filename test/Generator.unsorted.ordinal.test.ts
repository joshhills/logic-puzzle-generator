/**
 * Generator.unsorted.ordinal.test.ts
 *
 * End-to-end regression tests verifying that the Generator produces sound,
 * uniquely solvable puzzles even when ordinal categories contain unsorted (shuffled) values.
 */

import { Generator } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType, ClueType } from '../src/types';

describe('Generator with Unsorted Ordinal Categories', () => {

    it('generates a 100% uniquely solvable puzzle when ordinal values are unsorted', async () => {
        // Values are intentionally shuffled: [105, 135, 60, 75]
        const categories: CategoryConfig[] = [
            { id: 'Animal',      type: CategoryType.NOMINAL, values: ['flamingo', 'wombat', 'lemur', 'penguin'] },
            { id: 'Object',      type: CategoryType.NOMINAL, values: ['popcorn_bucket', 'hard_hat', 'paint_roller', 'saxophone'] },
            { id: 'MinutesFree', type: CategoryType.ORDINAL, values: [105, 135, 60, 75] }
        ];

        // Seed that exposed the original bug
        const generator = new Generator(1116168083);
        const puzzle = await generator.generatePuzzleAsync(categories, undefined, {
            constraints: {
                allowedClueTypes: [ClueType.BINARY, ClueType.ORDINAL, ClueType.SUPERLATIVE, ClueType.ADJACENCY]
            }
        });

        expect(puzzle.clues.length).toBeGreaterThan(0);

        // Verify that applying all generated clues to a fresh grid yields a fully resolved solution
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        for (const clue of puzzle.clues) {
            solver.applyClue(grid, clue);
        }

        const stats = grid.getGridStats();
        expect(stats.currentPossible).toBe(stats.solutionPossible);
    });

    it('consistently produces uniquely solvable puzzles across 10 random seeds with unsorted ordinals', async () => {
        const categories: CategoryConfig[] = [
            { id: 'CatA', type: CategoryType.NOMINAL, values: ['A1', 'A2', 'A3', 'A4'] },
            { id: 'CatB', type: CategoryType.NOMINAL, values: ['B1', 'B2', 'B3', 'B4'] },
            { id: 'CatC', type: CategoryType.ORDINAL, values: [40, 10, 30, 20] } // unsorted
        ];

        const seeds = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

        for (const seed of seeds) {
            const generator = new Generator(seed);
            const puzzle = await generator.generatePuzzleAsync(categories, undefined, {
                constraints: {
                    allowedClueTypes: [ClueType.BINARY, ClueType.ORDINAL, ClueType.SUPERLATIVE]
                }
            });

            const grid = new LogicGrid(categories);
            const solver = new Solver();

            for (const clue of puzzle.clues) {
                solver.applyClue(grid, clue);
            }

            const stats = grid.getGridStats();
            expect(stats.currentPossible).toBe(stats.solutionPossible);
        }
    });

});
