/**
 * Generator.unsorted.ordinal.test.ts
 *
 * End-to-end regression tests verifying that the Generator produces sound,
 * non-contradictory, uniquely solvable puzzles even when ordinal categories contain
 * unsorted (shuffled) values.
 */

import { Generator } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType, ClueType } from '../src/types';
import { AdjacencyClue } from '../src/engine/Clue';

describe('Generator with Unsorted Ordinal Categories', () => {

    it('generates sound ADJACENCY clues when ordinal values are unsorted', async () => {
        // Values shuffled: [4, 12, 16, 10]. Numerical order: 4 < 10 < 12 < 16.
        // In the raw array [4, 12, 16, 10], 4 and 12 are adjacent by array index (idx 0 and 1),
        // but numerically 4 is adjacent ONLY to 10.
        const categories: CategoryConfig[] = [
            { id: 'Performer',  type: CategoryType.NOMINAL, values: ['FireSuit', 'Harness', 'CableRig', 'Mask'] },
            { id: 'Location',   type: CategoryType.NOMINAL, values: ['AlleySet', 'GreenRoom', 'DesertRoad', 'Docks'] },
            { id: 'Difficulty', type: CategoryType.ORDINAL, values: [4, 12, 16, 10] }
        ];

        for (let seed = 1; seed <= 20; seed++) {
            const generator = new Generator(seed);
            const puzzle = await generator.generatePuzzleAsync(categories, undefined, {
                constraints: {
                    allowedClueTypes: [ClueType.BINARY, ClueType.ORDINAL, ClueType.SUPERLATIVE, ClueType.ADJACENCY, ClueType.BETWEEN]
                }
            });

            // 1. Check generated ADJACENCY clues for truth against numerical rank
            const ordRankMap = new Map<number, number>([[4, 0], [10, 1], [12, 2], [16, 3]]);

            for (const clue of puzzle.clues) {
                if (clue.type === ClueType.ADJACENCY) {
                    const adj = clue as AdjacencyClue;
                    // Look up true ordinal values for item1 and item2 from solution
                    const base1 = puzzle.categories.find(c => c.id === adj.item1Cat);
                    const base2 = puzzle.categories.find(c => c.id === adj.item2Cat);

                    // Find entities in solution
                    let val1Ord: number | undefined;
                    let val2Ord: number | undefined;

                    for (const entityKey of Object.keys(puzzle.solution[adj.item1Cat])) {
                        if (puzzle.solution[adj.item1Cat][entityKey] === adj.item1Val) {
                            val1Ord = puzzle.solution[adj.ordinalCat][entityKey] as number;
                        }
                    }
                    for (const entityKey of Object.keys(puzzle.solution[adj.item2Cat])) {
                        if (puzzle.solution[adj.item2Cat][entityKey] === adj.item2Val) {
                            val2Ord = puzzle.solution[adj.ordinalCat][entityKey] as number;
                        }
                    }

                    if (val1Ord !== undefined && val2Ord !== undefined) {
                        const r1 = ordRankMap.get(val1Ord)!;
                        const r2 = ordRankMap.get(val2Ord)!;
                        // Adjacency MUST be numerical rank difference 1
                        expect(Math.abs(r1 - r2)).toBe(1);
                    }
                }
            }

            // 2. Applying all generated clues must yield a fully solved grid without contradiction
            const grid = new LogicGrid(categories);
            const solver = new Solver();

            for (const clue of puzzle.clues) {
                solver.applyClue(grid, clue);
            }

            const stats = grid.getGridStats();
            expect(stats.currentPossible).toBe(stats.solutionPossible);
        }
    });

    it('consistently produces uniquely solvable puzzles across all clue types with unsorted ordinals', async () => {
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
                    allowedClueTypes: [
                        ClueType.BINARY, ClueType.ORDINAL, ClueType.SUPERLATIVE,
                        ClueType.ADJACENCY, ClueType.BETWEEN
                    ]
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
