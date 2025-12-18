import { Generator } from '../src/engine/Generator';
import { CategoryConfig, CategoryType, TargetFact } from '../src/types';
import { Clue, ClueType } from '../src/engine/Clue';

describe('Generator Variance Check', () => {
    // Increase the timeout for this test suite as it runs the generator multiple times.
    jest.setTimeout(30000); // 30 seconds

    it('should produce puzzles with sufficient variety on average over multiple runs', () => {
        const categories: CategoryConfig[] = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Genre', type: CategoryType.NOMINAL, values: ['Horror', 'Sci-Fi', 'Comedy'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30] },
        ];

        const target: TargetFact = {
            category1Id: 'Name',
            value1: 'Alice',
            category2Id: 'Age',
        };

        const runCount = 20;
        let totalVarianceScore = 0;
        const allClueTypes = new Set<ClueType>();

        const allClueTypesStrings = new Set<string>();

        for (let i = 0; i < runCount; i++) {
            const seed = i; // Use a different seed for each run
            const generator = new Generator(seed);
            const { clues } = generator.generatePuzzle(categories, target, { timeoutMs: 10000 });

            // A simple variance score: the number of unique clue types used in the puzzle.
            // Distinguish between IS and IS_NOT for variance
            const uniqueClueTypes = new Set(clues.map(c => {
                let typeStr = c.type.toString();
                if (c.type === ClueType.BINARY) {
                    typeStr = `BINARY_${(c as any).operator === 0 ? 'IS' : 'IS_NOT'}`;
                } else {
                    typeStr = ClueType[c.type];
                }
                allClueTypesStrings.add(typeStr);
                return typeStr;
            }));

            const varianceScore = uniqueClueTypes.size;
            totalVarianceScore += varianceScore;
        }

        const averageVariance = totalVarianceScore / runCount;

        console.log(`--- Generator Variance Report ---`);
        console.log(`Total puzzles generated: ${runCount}`);
        console.log(`Average unique clue types per puzzle: ${averageVariance.toFixed(2)}`);
        console.log(`Total unique clue types seen across all runs: ${[...allClueTypesStrings].join(', ')}`);
        console.log(`---------------------------------`);

        // A good puzzle should have at least some variety.
        // Let's expect more than 2 types on average.
        // e.g., not just BINARY and ORDINAL, but also SUPERLATIVE.
        expect(averageVariance).toBeGreaterThan(2.5);
    });
});
