import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType, ValueLabel, Solution } from '../src/types';

describe('LogicGrid', () => {

    it('should throw an error for duplicate category IDs', () => {
        const invalidCategories: CategoryConfig[] = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
            { id: 'Name', type: CategoryType.ORDINAL, values: [20, 30] },
        ];
        expect(() => new LogicGrid(invalidCategories)).toThrow('Duplicate category ID found: Name');
    });

    it('should throw an error for duplicate values within a category', () => {
        const invalidCategories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 20] },
        ];
        expect(() => new LogicGrid(invalidCategories)).toThrow("Category 'Age' has duplicate values.");
    });

    it('should throw an error if categories have different number of values', () => {
        const invalidCategories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30] },
        ];
        // This check should probably be in the Generator, not the grid, but let's add a test for it.
        // For now, the grid doesn't enforce this. Let's add the validation.
        expect(() => new LogicGrid(invalidCategories)).toThrow("Category 'Age' has 2 values, expected 3. All categories must be the same size.");
    });

    it('should successfully create a grid with a valid configuration', () => {
        const validCategories: CategoryConfig[] = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30] },
        ];
        expect(() => new LogicGrid(validCategories)).not.toThrow();
    });

});
