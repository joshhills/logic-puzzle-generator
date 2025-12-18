
import { Generator } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, ClueType, CrossOrdinalOperator, CategoryConfig } from '../src/types';
import { CrossOrdinalClue } from '../src/engine/Clue';

const categories: CategoryConfig[] = [
    { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
    { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20] },
    { id: 'Height', type: CategoryType.ORDINAL, values: [100, 200] }
];

describe('CrossOrdinalClue Negation', () => {
    it('should eliminate a possibility when a negated link is provided', () => {
        // Setup: 
        // Alice is 10.
        // Puzzle: Link Age to Height.
        // Clue: "The person who is 10 (Age) is NOT the person who is 100 (Height)."

        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // 1. Establish Alice is 10.
        // (Just manually setting grid to simplify test)
        // Actually, CrossOrdinal works on categories.
        // Let's say: Item1Cat=Age, Item1Val=10. Item2Cat=Height, Item2Val=100.
        // Clue: "Identify Person A by Age=10. Identify Person B by Height=100. Person A IS NOT Person B."

        // This means the cell (Age=10, Height=100) must be false.

        const clue: CrossOrdinalClue = {
            type: ClueType.CROSS_ORDINAL,
            operator: CrossOrdinalOperator.NOT_MATCH,
            // Dummy anchor, doesn't matter if offset is 0 relative to ordinal value?
            // Wait, CrossOrdinal structure is:
            // "The item at [Offset1] relative to [Item1Val] in [Ordinal1] ... "
            // If we want to refer to exactly Age=10:
            // Item1Cat=Age, Item1Val=10, Ordinal1=Age, Offset1=0.

            item1Cat: 'Age',
            item1Val: 10,
            ordinal1: 'Age',
            offset1: 0,

            item2Cat: 'Height',
            item2Val: 100,
            ordinal2: 'Height',
            offset2: 0,
        };

        // Before clue, (Age:10, Height:100) should be possible.
        expect(grid.isPossible('Age', 10, 'Height', 100)).toBe(true);

        solver.applyClue(grid, clue);

        // After clue, it should be false.
        expect(grid.isPossible('Age', 10, 'Height', 100)).toBe(false);
    });

    it('should verify complex deduction', () => {
        // Scenario:
        // Alice is 10.
        // Bob is 20.
        // There is someone with Height 100 and someone with Height 200.
        // Clue: "The person who is Age 10 is NOT the person who is Height 100."
        // Deduction: Alice (Age 10) must correspond to Height 200.

        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Pre-fill valid structure (Rows) just to be safe? 
        // LogicGrid allows all connections initially.

        const clue: CrossOrdinalClue = {
            type: ClueType.CROSS_ORDINAL,
            operator: CrossOrdinalOperator.NOT_MATCH,
            item1Cat: 'Age',
            item1Val: 10,
            ordinal1: 'Age',
            offset1: 0,
            item2Cat: 'Height',
            item2Val: 100,
            ordinal2: 'Height',
            offset2: 0,
        };

        solver.applyClue(grid, clue);

        // (Age:10, Height:100) is eliminated.
        expect(grid.isPossible('Age', 10, 'Height', 100)).toBe(false);

        // Since Age:10 must map to *some* Height, and 100 is impossible, it implies 200.
        // (Assuming standard Logic Grid behavior: Row uniqueness).
        // Solver checks uniqueness in runDeductionLoop.

        // Let's force uniqueness check.
        // (applyClue calls runDeductionLoop automatically)

        // With 2x2 grid, if (10, 100) is false, then (10, 200) MUST be true (if 10 must have a height).
        // Does LogicGrid enforce "Every item must map to something"? 
        // Yes, structurally, but the Solver needs to deduce it.
        // The Solver's uniqueness check: "If val1 is uniquely associated with val2..."
        // Here, available values for Age:10 in Height are [200]. Length=1.
        // So (Age:10, Height:200) should be set to TRUE.

        expect(grid.isPossible('Age', 10, 'Height', 200)).toBe(true);
        // Is it DEFINITE? (true linkage)
        // LogicGrid stores linkage as boolean, but getPossibilitiesCount returns count.
        // If (10, 100) is false, count should be 1.
        expect(grid.getPossibilitiesCount('Age', 10, 'Height')).toBe(1);
    });
});
