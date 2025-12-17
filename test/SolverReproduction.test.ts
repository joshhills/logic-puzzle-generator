import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, CategoryConfig } from '../src/types';
import { ClueType, BinaryOperator } from '../src/engine/Clue';

describe('Solver Deduction Logic', () => {
    let solver: Solver;
    let logicGrid: LogicGrid;
    let categories: CategoryConfig[];

    beforeEach(() => {
        solver = new Solver();
        categories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
            { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn'] }
        ];
        logicGrid = new LogicGrid(categories);
    });

    it('should eliminate peers when applying Binary IS clue', () => {
        // Initial state: All possible
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Popcorn')).toBe(true);
        expect(logicGrid.isPossible('Name', 'Bob', 'Snack', 'Chips')).toBe(true);

        // Apply "Alice IS Chips"
        solver.applyClue(logicGrid, {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name', val1: 'Alice',
            cat2: 'Snack', val2: 'Chips'
        });

        // Expectations:
        // Alice IS Chips -> True
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Chips')).toBe(true);

        // Alice IS NOT Popcorn -> False (Row elimination)
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Popcorn')).toBe(false);

        // Bob IS NOT Chips -> False (Column elimination)
        expect(logicGrid.isPossible('Name', 'Bob', 'Snack', 'Chips')).toBe(false);
    });
});
