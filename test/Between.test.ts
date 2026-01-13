
import { Generator } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, ClueType } from '../src/types';
import { BetweenClue } from '../src/engine/Clue';

describe('Between Clue Type', () => {

    const categories = [
        {
            id: 'suspect',
            type: CategoryType.NOMINAL,
            values: ['Mustard', 'Plum', 'Green', 'Peacock', 'Scarlet']
        },
        {
            id: 'age',
            type: CategoryType.ORDINAL,
            values: [20, 30, 40, 50, 60]
        }
    ];

    test('Solver applies Between clue correctly (Simple Range)', () => {
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Clue: Green (Target) is between Mustard (Lower) and Plum (Upper) in Age.
        // Setup: Mustard is 20, Plum is 50.
        // Green must be > 20 and < 50. i.e. 30 or 40.

        // Helper to fix a value
        const setFixed = (itemCat: string, itemVal: string, ordCat: string, ordVal: number) => {
            grid.setPossibility(itemCat, itemVal, ordCat, ordVal, true);
            // Manually eliminate others
            [20, 30, 40, 50, 60].forEach(v => {
                if (v !== ordVal) grid.setPossibility(itemCat, itemVal, ordCat, v, false);
            });
        };

        setFixed('suspect', 'Mustard', 'age', 20);
        setFixed('suspect', 'Plum', 'age', 50);

        const clue: BetweenClue = {
            type: ClueType.BETWEEN,
            targetCat: 'suspect',
            targetVal: 'Green',
            lowerCat: 'suspect',
            lowerVal: 'Mustard',
            upperCat: 'suspect',
            upperVal: 'Plum',
            ordinalCat: 'age'
        };

        const result = solver.applyClue(grid, clue);

        expect(grid.isPossible('suspect', 'Green', 'age', 20)).toBe(false); // Not >, == Lower
        expect(grid.isPossible('suspect', 'Green', 'age', 30)).toBe(true);
        expect(grid.isPossible('suspect', 'Green', 'age', 40)).toBe(true);
        expect(grid.isPossible('suspect', 'Green', 'age', 50)).toBe(false); // Not <, == Upper
        expect(grid.isPossible('suspect', 'Green', 'age', 60)).toBe(false); // Out of bounds upper

        expect(result.deductions).toBeGreaterThan(0);
    });

    test('Solver applies Between clue logic recursively (Double Side)', () => {
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Clue: Green is between Mustard and Plum.
        // If Green is 60. Could it be?
        // No, because it must be < Plum (Max 60?). 
        // Actually if Plum is 60, Green < 60.
        // If Green is 20. No, must be > Mustard (Min 20).

        // Apply clue with known Green = 20 (Should fail or eliminate?)
        // Wait, Solver eliminates Candidates.

        const clue: BetweenClue = {
            type: ClueType.BETWEEN,
            targetCat: 'suspect',
            targetVal: 'Green',
            lowerCat: 'suspect',
            lowerVal: 'Mustard',
            upperCat: 'suspect',
            upperVal: 'Plum',
            ordinalCat: 'age'
        };

        solver.applyClue(grid, clue);

        // Mustard cannot be MAX (60) or MAX-1 (50)?
        // If Mustard=60, Green > 60 (Impossible).
        expect(grid.isPossible('suspect', 'Mustard', 'age', 60)).toBe(false);
        // If Mustard=50, Green > 50 (60). Plum > Green (Impossible, max 60).
        // Actually if Green=60, Plum > 60 (Impossible).
        // So Green cannot be 60.
        expect(grid.isPossible('suspect', 'Green', 'age', 60)).toBe(false);

        // Plum cannot be MIN (20).
        expect(grid.isPossible('suspect', 'Plum', 'age', 20)).toBe(false);
    });
});
