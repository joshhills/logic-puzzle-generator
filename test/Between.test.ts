
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, CategoryConfig } from '../src/types';
import { BetweenClue, ClueType } from '../src/engine/Clue';

describe('Between Clue Transitive Deductions', () => {
    it('should eliminate values based on transitive range restrictions (A < B < C)', () => {
        // Setup: Weapon, Gold (10, 20, 30, 40)
        const categories: CategoryConfig[] = [
            { id: 'Weapon', type: CategoryType.NOMINAL, values: ['Revolver', 'Rope', 'Candlestick', 'Dagger'] },
            { id: 'Gold', type: CategoryType.ORDINAL, values: [10, 20, 30, 40] }
        ];

        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Clue: Rope has more than Revolver but less than Candlestick.
        // Revolver < Rope < Candlestick
        // Target: Rope. Lower: Revolver. Upper: Candlestick.
        // OrdinalCat: Gold.

        // Implication:
        // Revolver cannot be 40 (obviously).
        // Revolver cannot be 30 (because then Rope > 30 => Rope=40. Then Candlestick > 40 => Impossible).
        // So Revolver Max = 20.

        const clue: BetweenClue = {
            type: ClueType.BETWEEN,
            targetCat: 'Weapon',
            targetVal: 'Rope',
            lowerCat: 'Weapon',
            lowerVal: 'Revolver',
            upperCat: 'Weapon',
            upperVal: 'Candlestick',
            ordinalCat: 'Gold'
        };

        // Apply clue
        solver.applyClue(grid, clue);

        // Check Deductions
        // 1. Candlestick cannot be 10 or 20.
        expect(grid.isPossible('Weapon', 'Candlestick', 'Gold', 10)).toBe(false);
        expect(grid.isPossible('Weapon', 'Candlestick', 'Gold', 20)).toBe(false);

        // 2. Rope cannot be 10 or 40.
        expect(grid.isPossible('Weapon', 'Rope', 'Gold', 10)).toBe(false);
        expect(grid.isPossible('Weapon', 'Rope', 'Gold', 40)).toBe(false);

        // 3. Revolver cannot be 30 or 40.
        // This is the one expected to fail if the bug exists.
        expect(grid.isPossible('Weapon', 'Revolver', 'Gold', 40)).toBe(false);
        expect(grid.isPossible('Weapon', 'Revolver', 'Gold', 30)).toBe(false);
    });
});
