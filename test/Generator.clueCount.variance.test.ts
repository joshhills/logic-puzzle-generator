import { Generator } from '../src/engine/Generator';
import { CategoryType } from '../src/types';

describe('Generator - Backtracking Variance', () => {
    const categories = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'David'] },
        { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy', 'Nuts'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30, 40] }
    ];

    const target = {
        category1Id: 'Name',
        value1: 'Alice',
        category2Id: 'Snack'
    };

    test('Exact Count mode produces varied clues across seeds', () => {
        const generatedClues = new Set<string>();
        const clueTypes = new Set<string>();
        const TARGET_COUNT = 6;
        const ITERATIONS = 10;

        for (let i = 0; i < ITERATIONS; i++) {
            const generator = new Generator(100 + i);
            // We give it a generous maxCandidates so it HAS choices to make based on quality logic
            const puzzle = generator.generatePuzzle(categories, target, {
                targetClueCount: TARGET_COUNT,
                maxCandidates: 50
            });

            expect(puzzle.clues.length).toBe(TARGET_COUNT);

            puzzle.clues.forEach(clue => {
                generatedClues.add(JSON.stringify(clue));
                clueTypes.add(String(clue.type));
            });
        }

        console.log(`Unique clues generated across ${ITERATIONS} puzzles: ${generatedClues.size}`);
        console.log(`Unique clue types: ${Array.from(clueTypes).join(', ')}`);

        // If logic was deterministic/greedy-only, we might see very few unique clues (reusing same 'best' ones).
        // With randomness + quality scoring, we expect some variety.
        expect(generatedClues.size).toBeGreaterThan(TARGET_COUNT + 5);
        expect(clueTypes.size).toBeGreaterThan(1); // Should have mixed types (Binary, Ordinal, etc.)
    });
});
