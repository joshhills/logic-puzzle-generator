
import { Generator } from '../src/engine/Generator';
import { CategoryType } from '../src/types';

describe('Optional Goal Generation', () => {

    test('Generates puzzle without specific target', () => {
        const seed = 12345;
        const gen = new Generator(seed);

        const categories = [
            { id: 'Cats', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] },
            { id: 'Vals', type: CategoryType.NOMINAL, values: ['1', '2', '3'] },
            { id: 'Extras', type: CategoryType.NOMINAL, values: ['X', 'Y', 'Z'] }
        ];

        // Call WITHOUT target
        const puzzle = gen.generatePuzzle(categories, undefined, { targetClueCount: 5, timeoutMs: 5000 });

        expect(puzzle).toBeDefined();
        expect(puzzle.clues.length).toBeGreaterThan(0);

        // Check if internal target was synthesized and assigned
        // @ts-ignore
        const assignedTarget = puzzle.targetFact || puzzle.target;
        expect(assignedTarget).toBeDefined();
        expect(assignedTarget.category1Id).toBeDefined();
        expect(assignedTarget.category2Id).toBeDefined();
        expect(assignedTarget.category1Id).not.toEqual(assignedTarget.category2Id);
    });

});
