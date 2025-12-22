
import { Generator } from '../src/engine/Generator';
import { CategoryType, CategoryConfig } from '../src/types';

describe('Generator Async API', () => {
    const categories: CategoryConfig[] = [
        { id: 'Cat1', values: ['A', 'B', 'C'], type: CategoryType.NOMINAL },
        { id: 'Cat2', values: ['1', '2', '3'], type: CategoryType.NOMINAL }
    ];

    const generator = new Generator(12345);

    describe('generatePuzzleAsync', () => {
        test('should resolve with a valid puzzle', async () => {
            const puzzle = await generator.generatePuzzleAsync(categories);
            expect(puzzle).toBeDefined();
            expect(puzzle.clues.length).toBeGreaterThan(0);
            expect(puzzle.solution).toBeDefined();
        });

        test('should reject on invalid configuration', async () => {
            const invalidCategories = [{ id: 'Cat1', values: ['A'], type: CategoryType.NOMINAL }];
            await expect(generator.generatePuzzleAsync(invalidCategories)).rejects.toThrow();
        });

        test('should respect timeout options', async () => {
            // A very short timeout might not trigger in async wrap unless internal logic checks it
            // but we can pass it through.
            const puzzle = await generator.generatePuzzleAsync(categories, undefined, { timeoutMs: 5000 });
            expect(puzzle).toBeDefined();
        });
    });

    describe('getClueCountBoundsAsync', () => {
        test('should resolve with min and max bounds', async () => {
            const target = { category1Id: 'Cat1', value1: 'A', category2Id: 'Cat2' };
            const bounds = await generator.getClueCountBoundsAsync(categories, target);
            expect(bounds.min).toBeGreaterThan(0);
            expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);
        });
    });
});
