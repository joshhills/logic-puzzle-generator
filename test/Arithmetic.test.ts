
import { LogicGrid } from '../src/engine/LogicGrid';
import { Solver } from '../src/engine/Solver';
import { ClueType, CategoryType, ValueLabel } from '../src/types';
import { ArithmeticClue } from '../src/engine/Clue';

describe('Arithmetic (Same Difference) Clue Logic', () => {
    // Setup grid
    const categories = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['A', 'B', 'C', 'D'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30, 40] },
    ];
    let grid: LogicGrid;
    let solver: Solver;

    beforeEach(() => {
        grid = new LogicGrid(categories);
        solver = new Solver();
    });

    test('validates simple difference', () => {
        // A=10, B=20. Diff = 10.
        // C=30, D=40. Diff = 10.
        // Clue: Diff(A, B) == Diff(C, D).
        // This should be consistent.

        grid.setPossibility('Name', 'A', 'Age', 10, true);
        grid.setPossibility('Name', 'B', 'Age', 20, true);
        grid.setPossibility('Name', 'C', 'Age', 30, true);
        grid.setPossibility('Name', 'D', 'Age', 40, true);

        const clue: ArithmeticClue = {
            type: ClueType.ARITHMETIC,
            item1Cat: 'Name', item1Val: 'A',
            item2Cat: 'Name', item2Val: 'B',
            item3Cat: 'Name', item3Val: 'C',
            item4Cat: 'Name', item4Val: 'D',
            ordinalCat: 'Age'
        };

        const result = solver.applyClue(grid, clue);
        expect(grid.isValid()).toBe(true);
    });

    test('prunes impossible values', () => {
        // A=10. B is unknown.
        // C=10, D=30 (Diff 20).
        // Clue: Diff(A, B) == Diff(C, D).
        // Implies |10 - B| = 20.
        // B could be 30 (Diff 20).
        // B cannot be 10, 20, 40 (Diffs 0, 10, 30).

        // Fix A=10, C=10, D=30 strictly
        // Manually eliminate others for A
        grid.setPossibility('Name', 'A', 'Age', 20, false);
        grid.setPossibility('Name', 'A', 'Age', 30, false);
        grid.setPossibility('Name', 'A', 'Age', 40, false);
        grid.setPossibility('Name', 'A', 'Age', 10, true);

        // Fix C=10
        grid.setPossibility('Name', 'C', 'Age', 20, false);
        grid.setPossibility('Name', 'C', 'Age', 30, false);
        grid.setPossibility('Name', 'C', 'Age', 40, false);
        grid.setPossibility('Name', 'C', 'Age', 10, true);

        // Fix D=30
        grid.setPossibility('Name', 'D', 'Age', 10, false);
        grid.setPossibility('Name', 'D', 'Age', 20, false);
        grid.setPossibility('Name', 'D', 'Age', 40, false);
        grid.setPossibility('Name', 'D', 'Age', 30, true);

        // Manually clear other options for A,C,D to make state clean? 
        // LogicGrid.setPossibility(true) usually auto-clears others in row/col if structured that way, 
        // but here we just rely on Solver pruning.

        const clue: ArithmeticClue = {
            type: ClueType.ARITHMETIC,
            item1Cat: 'Name', item1Val: 'A',
            item2Cat: 'Name', item2Val: 'B',
            item3Cat: 'Name', item3Val: 'C',
            item4Cat: 'Name', item4Val: 'D',
            ordinalCat: 'Age'
        };

        const deductions = solver.applyClue(grid, clue);

        expect(deductions.deductions).toBeGreaterThan(0);
        expect(grid.isPossible('Name', 'B', 'Age', 30)).toBe(true); // 30-10=20.
        expect(grid.isPossible('Name', 'B', 'Age', 20)).toBe(false); // 20-10=10 != 20
        expect(grid.isPossible('Name', 'B', 'Age', 40)).toBe(false); // 40-10=30 != 20
        expect(grid.isPossible('Name', 'B', 'Age', 10)).toBe(false); // 10-10=0 != 20
    });
});
