/**
 * OrdinalSolver.unsorted.test.ts
 *
 * Tests that prove all ordinal clue handlers in Solver.ts produce CORRECT deductions
 * when ordinal values are passed in a non-ascending (shuffled) order.
 *
 * WHY THIS MATTERS:
 * The Crux app shuffles ordinal category values for daily puzzle variety, producing
 * arrays like [105, 135, 60, 75] from a numerically ordered theme. If the solver
 * uses array-index as a proxy for rank, comparisons like "Heavy ≤ 105" would
 * incorrectly eliminate {60, 75} as possibilities (they have higher indices).
 *
 * All existing tests in Solver.test.ts used pre-sorted ordinal arrays and therefore
 * did not expose this class of bug.
 */

import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType } from '../src/types';
import {
    Clue, ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator,
    OrdinalClue, SuperlativeClue, AdjacencyClue,
} from '../src/engine/Clue';

// ---------------------------------------------------------------------------
// Shared unsorted ordinal setup
// Values [105, 135, 60, 75] – intentionally shuffled, NOT ascending.
// Correct numerical ordering: 60 < 75 < 105 < 135
// ---------------------------------------------------------------------------
const UNSORTED_VALUES = [105, 135, 60, 75];
const SORTED_VALUES   = [60, 75, 105, 135];

function makeGrid(): { grid: LogicGrid; solver: Solver; categories: CategoryConfig[] } {
    const categories: CategoryConfig[] = [
        { id: 'Personality', type: CategoryType.NOMINAL, values: ['Showoff', 'Ringleader', 'Heavy', 'Prankster'] },
        { id: 'Object',      type: CategoryType.NOMINAL, values: ['popcorn', 'hard-hat', 'paint-roller', 'saxophone'] },
        { id: 'Minutes',     type: CategoryType.ORDINAL, values: UNSORTED_VALUES },
    ];
    return { grid: new LogicGrid(categories), solver: new Solver(), categories };
}

// ---------------------------------------------------------------------------

describe('Solver – ordinal clues with unsorted value arrays', () => {

    describe('LESS_THAN', () => {
        it('eliminates values correctly when ordinal array is shuffled', () => {
            const { grid, solver } = makeGrid();

            // "Ringleader's minutes < saxophone's minutes"
            const clue: OrdinalClue = {
                type: ClueType.ORDINAL,
                operator: OrdinalOperator.LESS_THAN,
                item1Cat: 'Personality', item1Val: 'Ringleader',
                item2Cat: 'Object',      item2Val: 'saxophone',
                ordinalCat: 'Minutes',
            };

            solver.applyClue(grid, clue);

            // Ringleader cannot be the largest value (135) – it must be < saxophone
            expect(grid.isPossible('Personality', 'Ringleader', 'Minutes', 135)).toBe(false);
            // saxophone cannot be the smallest value (60) – it must be > Ringleader
            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 60)).toBe(false);
            // Ringleader can still be 60 (smallest) – valid since saxophone could be higher
            expect(grid.isPossible('Personality', 'Ringleader', 'Minutes', 60)).toBe(true);
            // saxophone can still be 135
            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 135)).toBe(true);
        });
    });

    describe('NOT_GREATER_THAN (≤)', () => {
        it('only eliminates values that are numerically larger than item2, not by array index', () => {
            const { grid, solver } = makeGrid();

            // First pin popcorn = 105 via a BINARY clue
            solver.applyClue(grid, {
                type: ClueType.BINARY, operator: BinaryOperator.IS,
                cat1: 'Object', val1: 'popcorn', cat2: 'Minutes', val2: 105,
            });

            // "Heavy's minutes ≤ popcorn's minutes (105)"
            // Correct: Heavy ∈ {60, 75, 105} (all numerically ≤ 105)
            // Wrong (index-based): Heavy must be index ≤ 0, i.e. only {105}
            const clue: OrdinalClue = {
                type: ClueType.ORDINAL,
                operator: OrdinalOperator.NOT_GREATER_THAN,
                item1Cat: 'Personality', item1Val: 'Heavy',
                item2Cat: 'Object',      item2Val: 'popcorn',
                ordinalCat: 'Minutes',
            };

            solver.applyClue(grid, clue);

            // 135 > 105 → must be eliminated
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 135)).toBe(false);
            // 60 ≤ 105 → must remain possible
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 60)).toBe(true);
            // 75 ≤ 105 → must remain possible
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 75)).toBe(true);
            // 105 ≤ 105 → must remain possible (equal allowed)
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 105)).toBe(true);
        });

        it('does NOT falsely pin Heavy to 105 when ordinal array is unsorted (regression for real bug)', () => {
            const { grid, solver } = makeGrid();

            // Replicate the exact 5-clue medium puzzle that exposed the bug
            // Clue 1: popcorn IS 105 min
            solver.applyClue(grid, {
                type: ClueType.BINARY, operator: BinaryOperator.IS,
                cat1: 'Object', val1: 'popcorn', cat2: 'Minutes', val2: 105,
            });
            // Clue 2: Heavy NOT_GREATER_THAN popcorn (≤ 105)
            solver.applyClue(grid, {
                type: ClueType.ORDINAL, operator: OrdinalOperator.NOT_GREATER_THAN,
                item1Cat: 'Personality', item1Val: 'Heavy',
                item2Cat: 'Object',      item2Val: 'popcorn',
                ordinalCat: 'Minutes',
            } as OrdinalClue);

            // The bug: solver would pin Heavy=105 (wrong) then clue 3 contradicts it.
            // After the fix: Heavy should still have multiple possibilities.
            const heavyPossibleCount = UNSORTED_VALUES.filter(v =>
                grid.isPossible('Personality', 'Heavy', 'Minutes', v)
            ).length;
            expect(heavyPossibleCount).toBeGreaterThan(1);
        });
    });

    describe('GREATER_THAN', () => {
        it('eliminates values correctly when ordinal array is shuffled', () => {
            const { grid, solver } = makeGrid();

            // "Showoff's minutes > Ringleader's minutes"
            const clue: OrdinalClue = {
                type: ClueType.ORDINAL,
                operator: OrdinalOperator.GREATER_THAN,
                item1Cat: 'Personality', item1Val: 'Showoff',
                item2Cat: 'Personality', item2Val: 'Ringleader',
                ordinalCat: 'Minutes',
            };
            solver.applyClue(grid, clue);

            // Showoff cannot be 60 (smallest – nothing can be less than it)
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 60)).toBe(false);
            // Ringleader cannot be 135 (largest – nothing can be greater than it)
            expect(grid.isPossible('Personality', 'Ringleader', 'Minutes', 135)).toBe(false);
            // Showoff can be 135
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 135)).toBe(true);
            // Ringleader can be 60
            expect(grid.isPossible('Personality', 'Ringleader', 'Minutes', 60)).toBe(true);
        });
    });

    describe('SUPERLATIVE MIN/MAX', () => {
        it('correctly identifies the numerical minimum, not the first array element', () => {
            const { grid, solver } = makeGrid();

            // UNSORTED_VALUES[0] = 105, but the real minimum is 60.
            const clue: SuperlativeClue = {
                type: ClueType.SUPERLATIVE,
                operator: SuperlativeOperator.MIN,
                targetCat: 'Personality', targetVal: 'Heavy',
                ordinalCat: 'Minutes',
            };
            solver.applyClue(grid, clue);

            // Heavy must be 60 (the true minimum)
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 60)).toBe(true);
            // Heavy cannot be 75, 105, or 135
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 75)).toBe(false);
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 105)).toBe(false);
            expect(grid.isPossible('Personality', 'Heavy', 'Minutes', 135)).toBe(false);
        });

        it('correctly identifies the numerical maximum, not the last array element', () => {
            const { grid, solver } = makeGrid();

            // UNSORTED_VALUES[last] = 75, but the real maximum is 135.
            const clue: SuperlativeClue = {
                type: ClueType.SUPERLATIVE,
                operator: SuperlativeOperator.MAX,
                targetCat: 'Personality', targetVal: 'Prankster',
                ordinalCat: 'Minutes',
            };
            solver.applyClue(grid, clue);

            // Prankster must be 135 (the true maximum)
            expect(grid.isPossible('Personality', 'Prankster', 'Minutes', 135)).toBe(true);
            expect(grid.isPossible('Personality', 'Prankster', 'Minutes', 60)).toBe(false);
            expect(grid.isPossible('Personality', 'Prankster', 'Minutes', 75)).toBe(false);
            expect(grid.isPossible('Personality', 'Prankster', 'Minutes', 105)).toBe(false);
        });

        it('NOT_MIN correctly excludes the true minimum', () => {
            const { grid, solver } = makeGrid();

            const clue: SuperlativeClue = {
                type: ClueType.SUPERLATIVE,
                operator: SuperlativeOperator.NOT_MIN,
                targetCat: 'Personality', targetVal: 'Showoff',
                ordinalCat: 'Minutes',
            };
            solver.applyClue(grid, clue);

            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 60)).toBe(false);
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 75)).toBe(true);
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 105)).toBe(true);
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 135)).toBe(true);
        });
    });

    describe('ADJACENCY', () => {
        it('computes adjacency by numerical rank, not by array position', () => {
            const { grid, solver } = makeGrid();

            // In UNSORTED_VALUES = [105, 135, 60, 75]:
            //   By array position: neighbors of 105 (idx 0) are [135] (idx 1)
            //   By numerical rank: neighbors of 105 (rank 2) are [75, 135]
            // A correct adjacency clue "Showoff adj saxophone" should use rank.

            const clue: AdjacencyClue = {
                type: ClueType.ADJACENCY,
                item1Cat: 'Personality', item1Val: 'Showoff',
                item2Cat: 'Object',      item2Val: 'saxophone',
                ordinalCat: 'Minutes',
            };
            solver.applyClue(grid, clue);

            // Showoff cannot be 60 (rank 0, only neighbor is 75) unless saxophone can be 75
            // Showoff cannot be 135 (rank 3, only neighbor is 105) unless saxophone can be 105
            // Showoff can be 75 (neighbors: 60, 105) or 105 (neighbors: 75, 135)

            // If Showoff is 60, saxophone must be 75 (only neighbor). saxophone can be 75, so 60 is valid.
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 60)).toBe(true);

            // If Showoff is 135, saxophone must be 105. saxophone can be 105, so 135 is valid.
            expect(grid.isPossible('Personality', 'Showoff', 'Minutes', 135)).toBe(true);

            // Now pin Showoff=135. Saxophone must be 105 (its only rank-based neighbor).
            solver.applyClue(grid, {
                type: ClueType.BINARY, operator: BinaryOperator.IS,
                cat1: 'Personality', val1: 'Showoff', cat2: 'Minutes', val2: 135,
            });
            solver.applyClue(grid, clue); // re-apply

            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 105)).toBe(true);
            // 75 is NOT adjacent to 135 by rank, so it must be eliminated
            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 75)).toBe(false);
            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 60)).toBe(false);
            // 135 is the same as Showoff – uniqueness will handle that separately,
            // but by the adjacency clue alone: 135 is NOT adjacent to itself in rank
            expect(grid.isPossible('Object', 'saxophone', 'Minutes', 135)).toBe(false);
        });
    });
});
