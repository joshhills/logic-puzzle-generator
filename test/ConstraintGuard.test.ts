
import { Generator } from '../src/engine/Generator';
import { CategoryType, ClueType } from '../src/types';
import { ConfigurationError } from '../src/errors';

describe('Generator Constraint Guards', () => {
    it('should throw ConfigurationError if only UNARY clues are allowed', () => {
        const categories = [
            { id: 'Cat1', type: CategoryType.ORDINAL, values: [1, 2, 3] },
            { id: 'Cat2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }
        ];
        const target = { category1Id: 'Cat1', value1: 1, category2Id: 'Cat2' };

        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: {
                    allowedClueTypes: [ClueType.UNARY]
                }
            });
        }).toThrow(/Invalid Constraints/);
    });

    it('should throw ConfigurationError if only SUPERLATIVE clues are allowed', () => {
        const categories = [{ id: 'C1', type: CategoryType.ORDINAL, values: [1, 2, 3] }, { id: 'C2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }];
        const target = { category1Id: 'C1', value1: 1, category2Id: 'C2' };
        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: { allowedClueTypes: [ClueType.SUPERLATIVE] }
            });
        }).toThrow(/Invalid Constraints/);
    });

    it('should throw ConfigurationError if only UNARY + SUPERLATIVE clues are allowed', () => {
        const categories = [{ id: 'C1', type: CategoryType.ORDINAL, values: [1, 2, 3] }, { id: 'C2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }];
        const target = { category1Id: 'C1', value1: 1, category2Id: 'C2' };
        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: { allowedClueTypes: [ClueType.UNARY, ClueType.SUPERLATIVE] }
            });
        }).toThrow(/Invalid Constraints/);
    });

    it('should NOT throw if UNARY is combined with BINARY', () => {
        const categories = [
            { id: 'Cat1', type: CategoryType.ORDINAL, values: [1, 2, 3] },
            { id: 'Cat2', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] }
        ];
        const target = { category1Id: 'Cat1', value1: 1, category2Id: 'Cat2' };

        const generator = new Generator(12345);

        expect(() => {
            generator.generatePuzzle(categories, target, {
                constraints: {
                    allowedClueTypes: [ClueType.UNARY, ClueType.BINARY]
                },
                maxCandidates: 1, // Rapid exit
                timeoutMs: 100
            });
        }).not.toThrow(ConfigurationError);
    });
});
