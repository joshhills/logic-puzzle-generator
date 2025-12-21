
import { Generator } from '../src/engine/Generator';
import { CategoryType, ClueType } from '../src/types';
import { ConfigurationError } from '../src/errors';

describe('Safety Audit: Insufficient Constraints', () => {
    // 1. Superlative Only (N=3) -> Should fail to solve (timeout or stuck)
    // We expect the Generator to eventually give up or loop until timeout if we don't guard.
    // Ideally, we want to prove it's unsolvable.
    // For this test, we just want to see if it throws our new Error (once we add it).
    // Currently, it should try to run and likely timeout.  

    // We will simulate the "Guard Check" we plan to write. 
    // Wait, I should write the test to EXPECT the error I am about to add.

    it('should throw ConfigurationError if only SUPERLATIVE clues are allowed (Ambiguous Middle)', () => {
        const categories = [
            { id: 'Cat1', type: CategoryType.ORDINAL, values: [1, 2, 3] },
            { id: 'Cat2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }
        ];
        const target = { category1Id: 'Cat1', value1: 1, category2Id: 'Cat2' };
        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: {
                    allowedClueTypes: [ClueType.SUPERLATIVE]
                }
            });
        }).toThrow(/Invalid Constraints/);
    });

    it('should throw ConfigurationError if only UNARY + SUPERLATIVE clues are allowed (Ambiguous)', () => {
        const categories = [
            { id: 'Cat1', type: CategoryType.ORDINAL, values: [1, 2, 3, 4] },
            { id: 'Cat2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C', 'D'] }
        ];
        const target = { category1Id: 'Cat1', value1: 1, category2Id: 'Cat2' };
        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: {
                    allowedClueTypes: [ClueType.UNARY, ClueType.SUPERLATIVE]
                }
            });
        }).toThrow(/Invalid Constraints/);
    });

    it('should throw ConfigurationError if only CROSS_ORDINAL clues are allowed (Requires 2+ Ordinals)', () => {
        const categories = [
            { id: 'Cat1', type: CategoryType.ORDINAL, values: [1, 2, 3] },
            { id: 'Cat2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }
        ];
        const target = { category1Id: 'Cat1', value1: 1, category2Id: 'Cat2' };
        const generator = new Generator(12345);

        // only 1 ordinal category exists, but we ask for CROSS_ORDINAL
        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: {
                    allowedClueTypes: [ClueType.CROSS_ORDINAL]
                }
            });
        }).toThrow(/Invalid Constraints/);
    });
});
