import { Generator } from '../src/engine/Generator';
import { CategoryConfig, CategoryType, TargetFact } from '../src/types';

describe('Generator', () => {
    it('should be deterministic based on seed', () => {
        const categories: CategoryConfig[] = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40] },
            { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy'] },
        ];
        const target: TargetFact = {
            category1Id: 'Name',
            value1: 'Alice',
            category2Id: 'Snack',
        };
        const seed = 1234;

        const generator1 = new Generator(seed);
        const puzzle1 = generator1.generatePuzzle(categories, target);

        const generator2 = new Generator(seed);
        const puzzle2 = generator2.generatePuzzle(categories, target);

        expect(puzzle1.solution).toEqual(puzzle2.solution);
        expect(puzzle1.clues).toEqual(puzzle2.clues);
    });
});
