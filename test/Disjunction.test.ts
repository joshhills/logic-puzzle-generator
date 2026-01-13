
import { LogicGrid } from '../src/engine/LogicGrid';
import { Solver } from '../src/engine/Solver';
import { ClueType, BinaryOperator, CategoryType } from '../src/types';
import { DisjunctionClue, BinaryClue } from '../src/engine/Clue';

describe('Disjunction (OR) Clue Logic', () => {
    // Setup grid
    const categories = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30] },
    ];
    let grid: LogicGrid;
    let solver: Solver;

    beforeEach(() => {
        grid = new LogicGrid(categories);
        solver = new Solver();
    });

    test('deduces B when A is impossible', () => {
        // Setup: A=10 is IMPOSSIBLE. (Manually eliminate it)
        // Clue: A=10 OR B=20.
        // Expect: B=20 enforced.

        // Eliminate A=10 (Name:A, Age:10)
        grid.setPossibility('Name', 'A', 'Age', 10, false);

        const clue: DisjunctionClue = {
            type: ClueType.OR,
            clue1: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'A',
                cat2: 'Age', val2: 10,
                operator: BinaryOperator.IS
            },
            clue2: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'B',
                cat2: 'Age', val2: 20,
                operator: BinaryOperator.IS
            }
        };

        const result = solver.applyClue(grid, clue);

        // Should have deductions (B=20 implies B!=10, B!=30, A!=20, C!=20 etc)
        expect(result.deductions).toBeGreaterThan(0);

        // Verify B=20 is true
        // Specifically, B cannot be 30
        expect(grid.isPossible('Name', 'B', 'Age', 30)).toBe(false);
    });

    test('deduces A when B is impossible', () => {
        // Setup: B=20 is IMPOSSIBLE.
        // Clue: A=10 OR B=20.
        // Expect: A=10 enforced.

        grid.setPossibility('Name', 'B', 'Age', 20, false);

        const clue: DisjunctionClue = {
            type: ClueType.OR,
            clue1: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'A',
                cat2: 'Age', val2: 10,
                operator: BinaryOperator.IS
            },
            clue2: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'B',
                cat2: 'Age', val2: 20,
                operator: BinaryOperator.IS
            }
        };

        const result = solver.applyClue(grid, clue);
        expect(result.deductions).toBeGreaterThan(0);
        expect(grid.isPossible('Name', 'A', 'Age', 30)).toBe(false); // A must be 10
    });

    test('does nothing when both are possible', () => {
        // Clue: A=10 OR B=20.
        // Both are possible initially.
        // Expect: 0 deductions.

        const clue: DisjunctionClue = {
            type: ClueType.OR,
            clue1: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'A',
                cat2: 'Age', val2: 10,
                operator: BinaryOperator.IS
            },
            clue2: {
                type: ClueType.BINARY,
                cat1: 'Name', val1: 'B',
                cat2: 'Age', val2: 20,
                operator: BinaryOperator.IS
            }
        };

        const result = solver.applyClue(grid, clue);
        expect(result.deductions).toBe(0);
        expect(grid.isPossible('Name', 'A', 'Age', 10)).toBe(true);
        expect(grid.isPossible('Name', 'B', 'Age', 20)).toBe(true);
    });
});
