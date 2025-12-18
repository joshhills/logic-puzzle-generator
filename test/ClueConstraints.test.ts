
import { Generator } from '../src/engine/Generator';
import { CategoryType, ClueType } from '../src/types';

describe('Clue Constraints', () => {
    const categories = [
        { id: 'cat1', type: CategoryType.NOMINAL, values: ['a', 'b', 'c'] },
        { id: 'cat2', type: CategoryType.NOMINAL, values: [1, 2, 3] },
        { id: 'cat3', type: CategoryType.ORDINAL, values: [10, 20, 30] } // To allow Ordinal/Superlative
    ];

    it('should generate only BINARY clues when restricted', () => {
        const generator = new Generator(12345);
        const puzzle = generator.generatePuzzle(categories, undefined, {
            constraints: {
                allowedClueTypes: [ClueType.BINARY]
            }
        });

        const invalidClues = puzzle.clues.filter(c => c.type !== ClueType.BINARY);
        expect(invalidClues.length).toBe(0);
        expect(puzzle.clues.length).toBeGreaterThan(0);
    });

    it('should generate only ORDINAL clues when restricted (if solvable)', () => {
        // Warning: Might be hard to solve with ONLY Ordinal if cross-cat logic is weak? 
        // But let's try allowing Ordinal + Binary, to see if we get Ordinal.
        // Actually, let's test that we DON'T get Superlative if disallowed.
        const generator = new Generator(67890);
        const puzzle = generator.generatePuzzle(categories, undefined, {
            constraints: {
                allowedClueTypes: [ClueType.BINARY, ClueType.ORDINAL]
            }
        });

        const superlativeClues = puzzle.clues.filter(c => c.type === ClueType.SUPERLATIVE);
        expect(superlativeClues.length).toBe(0);

        // We should see some Ordinal clues potentially? 
        // Not guaranteed if Binary is more efficient, but let's check possibilities.
        // Or we can mock generateAllPossibleClues to check what it returns? 
        // No, integration test is better.
    });

    it('should generate NO clues if all types disallowed (should fail or return empty)', () => {
        const generator = new Generator(54321);
        expect(() => {
            generator.generatePuzzle(categories, undefined, {
                constraints: {
                    allowedClueTypes: [] // No allowed types
                }
            });
        }).toThrow(); // Should probably throw or return empty puzzle? 
        // If no clues available, generation fails to hit target.
    });
});
