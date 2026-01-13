
import { Generator } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, ClueType, OrdinalOperator } from '../src/types';
import { AdjacencyClue } from '../src/engine/Clue';

describe('Adjacency Clue Type', () => {

    const categories = [
        {
            id: 'person',
            type: CategoryType.NOMINAL,
            values: ['Alice', 'Bob', 'Charlie', 'Dave']
        },
        {
            id: 'house',
            type: CategoryType.ORDINAL,
            values: [10, 20, 30, 40] // Sorted numeric values
        }
    ];

    test('Solver applies Adjacency clue correctly (Inner Range)', () => {
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Clue: Alice is adjacent to Bob in House
        // Bob is 20. Adjacent could be 10 or 30.

        grid.setPossibility('person', 'Bob', 'house', 20, true);
        grid.setPossibility('person', 'Bob', 'house', 10, false);
        grid.setPossibility('person', 'Bob', 'house', 30, false);
        grid.setPossibility('person', 'Bob', 'house', 40, false);

        const clue: AdjacencyClue = {
            type: ClueType.ADJACENCY,
            item1Cat: 'person',
            item1Val: 'Alice',
            item2Cat: 'person',
            item2Val: 'Bob',
            ordinalCat: 'house'
        };

        const result = solver.applyClue(grid, clue);

        expect(grid.isPossible('person', 'Alice', 'house', 10)).toBe(true);
        expect(grid.isPossible('person', 'Alice', 'house', 30)).toBe(true);
        expect(grid.isPossible('person', 'Alice', 'house', 20)).toBe(false);
        expect(grid.isPossible('person', 'Alice', 'house', 40)).toBe(false);
        expect(result.deductions).toBeGreaterThan(0);
    });

    test('Solver applies Adjacency clue correctly (Edge Case)', () => {
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Set Bob = 10 (Min value)
        grid.setPossibility('person', 'Bob', 'house', 10, true);
        [20, 30, 40].forEach(v => grid.setPossibility('person', 'Bob', 'house', v, false));

        const clue: AdjacencyClue = {
            type: ClueType.ADJACENCY,
            item1Cat: 'person',
            item1Val: 'Alice',
            item2Cat: 'person',
            item2Val: 'Bob',
            ordinalCat: 'house'
        };

        solver.applyClue(grid, clue);

        // Adjacent to 10 is ONLY 20.
        expect(grid.isPossible('person', 'Alice', 'house', 20)).toBe(true);
        expect(grid.isPossible('person', 'Alice', 'house', 10)).toBe(false);
        expect(grid.isPossible('person', 'Alice', 'house', 30)).toBe(false);
        expect(grid.isPossible('person', 'Alice', 'house', 40)).toBe(false);
    });
});
