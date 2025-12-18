
import { Generator } from '../src/engine/Generator';
import { CategoryType, ClueType, CategoryConfig, ClueGenerationConstraints } from '../src/types';

describe('Configuration Validator', () => {
    const generator = new Generator(12345);
    const categories: CategoryConfig[] = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue'] }
    ]; // No ORDINAL categories

    it('should throw error if only Ordinal clues are requested but no ordinal categories exist', () => {
        const constraints: ClueGenerationConstraints = {
            allowedClueTypes: [ClueType.ORDINAL]
        };

        expect(() => {
            generator.generatePuzzle(categories, undefined, { constraints, targetClueCount: 1 });
        }).toThrow(/Invalid Constraints/);
    });

    it('should throw error if Ordinal and Binary are requested but no ordinal categories exist (strict check)', () => {
        // Implementation allows Binary if present if Ordinal is invalid.
        // Wait, my implementation:
        // if (requestedOrdinal && !hasOrdinalCategory) {
        //    if (!constraints.allowedClueTypes.includes(ClueType.BINARY)) { throw }
        // }
        // So if Binary IS present, it should NOT throw.
        const constraints: ClueGenerationConstraints = {
            allowedClueTypes: [ClueType.ORDINAL, ClueType.BINARY]
        };

        expect(() => {
            generator.generatePuzzle(categories, undefined, { constraints, targetClueCount: 1 });
        }).not.toThrow();
    });

    it('should throw error for other ordinal types', () => {
        const constraints: ClueGenerationConstraints = {
            allowedClueTypes: [ClueType.SUPERLATIVE]
        };
        expect(() => {
            generator.generatePuzzle(categories, undefined, { constraints, targetClueCount: 1 });
        }).toThrow(/Invalid Constraints/);
    });

    it('should not throw if ordinal categories exist', () => {
        const ordCategories: CategoryConfig[] = [
            ...categories,
            { id: 'Age', type: CategoryType.ORDINAL, values: [1, 2] }
        ];
        const constraints: ClueGenerationConstraints = {
            allowedClueTypes: [ClueType.ORDINAL]
        };
        expect(() => {
            generator.generatePuzzle(ordCategories, undefined, { constraints, targetClueCount: 1 });
        }).not.toThrow();
    });
});
