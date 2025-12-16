import { Generator } from '../src/engine/Generator';
import { LogicGrid } from '../src/engine/LogicGrid';
import { ConfigurationError } from '../src/errors';
import { CategoryType, CategoryConfig } from '../src/types';

describe('Validation & Robustness', () => {

    const validCategories: CategoryConfig[] = [
        { id: 'C1', type: CategoryType.NOMINAL, values: ['A', 'B'] },
        { id: 'C2', type: CategoryType.NOMINAL, values: ['1', '2'] }
    ];

    describe('LogicGrid Validation', () => {
        it('should throw ConfigurationError for duplicate category IDs', () => {
            const invalidConfigs = [
                { id: 'C1', type: CategoryType.NOMINAL, values: ['A', 'B'] },
                { id: 'C1', type: CategoryType.NOMINAL, values: ['1', '2'] }
            ];
            expect(() => new LogicGrid(invalidConfigs)).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError for inconsistent value counts', () => {
            const invalidConfigs = [
                { id: 'C1', type: CategoryType.NOMINAL, values: ['A', 'B'] },
                { id: 'C2', type: CategoryType.NOMINAL, values: ['1', '2', '3'] } // Mismatch
            ];
            expect(() => new LogicGrid(invalidConfigs)).toThrow(ConfigurationError);
        });
    });

    describe('Generator Validation', () => {
        const generator = new Generator(12345);

        it('should throw ConfigurationError if fewer than 2 categories provided', () => {
            expect(() => generator.generatePuzzle([], { category1Id: 'A', value1: 'X', category2Id: 'B' }))
                .toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError if target refers to missing categories', () => {
            expect(() => generator.generatePuzzle(validCategories, { category1Id: 'MISSING', value1: 'A', category2Id: 'C2' }))
                .toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError if target value is invalid', () => {
            expect(() => generator.generatePuzzle(validCategories, { category1Id: 'C1', value1: 'INVALID_VAL', category2Id: 'C2' }))
                .toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError if ORDINAL category has non-numeric values', () => {
            const invalidOrdinal = [
                { id: 'C1', type: CategoryType.NOMINAL, values: ['A', 'B'] },
                { id: 'C2', type: CategoryType.ORDINAL, values: ['1', 'two'] } // 'two' is not a number
            ];
            const gen = new Generator(123);
            // Note: Target just needs to point to valid IDs, values don't matter as much as the Category check happens first or during generation
            // But internalGenerate checks values first.
            // Let's use valid target IDs.
            expect(() => gen.generatePuzzle(invalidOrdinal, { category1Id: 'C1', value1: 'A', category2Id: 'C2' }))
                .toThrow(ConfigurationError);
        });
    });
});
