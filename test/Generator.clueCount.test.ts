import { Generator } from '../src/engine/Generator';
import { CategoryType } from '../src/types';

describe('Generator - Clue Count Features', () => {
    const categories = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Green', 'Blue'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30] }
    ];

    const target = {
        category1Id: 'Name',
        value1: 'Alice',
        category2Id: 'Color'
    };

    test('getClueCountBounds returns reasonable range', async () => {
        const generator = new Generator(12345);
        const { min, max } = await generator.getClueCountBounds(categories, target);

        console.log(`Estimated Bounds: Min ${min}, Max ${max}`);
        expect(min).toBeGreaterThan(0);
        expect(max).toBeGreaterThanOrEqual(min);
    });

    test('generatePuzzle hits exact target count', () => {
        const generator = new Generator(12345);
        // Assuming min is around 2-4 and max around 8-10 for this small grid
        const TARGET = 5;

        const puzzle = generator.generatePuzzle(categories, target, {
            targetClueCount: TARGET,
            maxCandidates: 50 // enough space for variety
        });

        expect(puzzle.clues.length).toBe(TARGET);
    });

    test('generatePuzzle fails gracefully (throws config error) on impossible target', () => {
        const generator = new Generator(12345);
        // 1 clue is impossible for a 3x3x3 grid to be fully solved usually
        // Actually, for a target fact it might be solved, but puzzle solved? Unlikely.
        // Let's try ridiculous numbers

        const IMPOSSIBLE_TARGET = 50; // Too many redundant clues needed

        expect(() => {
            generator.generatePuzzle(categories, target, {
                targetClueCount: IMPOSSIBLE_TARGET
            });
        }).toThrow();
    });
});
