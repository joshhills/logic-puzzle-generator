import { Generator } from '../src/engine/Generator';
import { CategoryType } from '../src/types';
import { ConfigurationError } from '../src/errors';

describe('Generator Target Clue Count', () => {
    // 1. Setup
    const categories = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
        { id: 'Snack', type: CategoryType.NOMINAL, values: ['Apple', 'Banana', 'Cookie'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green'] }
    ];

    const target = {
        category1Id: 'Name',
        value1: 'Alice',
        category2Id: 'Snack',
        value2: 'Apple'
    };

    it('should generate a puzzle with exactly 4 clues (feasible)', () => {
        const generator = new Generator(12345);
        const targetClueCount = 4; // Very feasible for 3x3

        const puzzle = generator.generatePuzzle(categories, target, {
            targetClueCount: targetClueCount,
            maxCandidates: 50,
            timeoutMs: 5000
        });

        expect(puzzle).toBeDefined();
        expect(puzzle.clues.length).toBe(targetClueCount);
    });

    it('should throw ConfigurationError if target is impossible (e.g. 100)', () => {
        const generator = new Generator(67890);
        const targetClueCount = 100;

        // We expect it to throw ConfigurationError because it cannot reach 100 clues.
        expect(() => {
            generator.generatePuzzle(categories, target, {
                targetClueCount: targetClueCount,
                timeoutMs: 1000
            });
        }).toThrow(ConfigurationError);
    });
});
