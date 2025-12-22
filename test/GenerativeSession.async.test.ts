
import { Generator } from '../src/engine/Generator';
import { CategoryType, CategoryConfig, TargetFact, ClueType } from '../src/types';

describe('GenerativeSession Async API', () => {
    let generator: Generator;
    let categories: CategoryConfig[];

    beforeEach(() => {
        generator = new Generator(12345);
        categories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
            { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue'] }
        ];
    });

    it('should resolve getNextClueAsync iteratively', async () => {
        const session = generator.startSession(categories);

        // Step 1
        const result1 = await session.getNextClueAsync();
        expect(result1.clue).toBeDefined();
        expect(session.getProofChain().length).toBe(1);

        // Step 2
        const result2 = await session.getNextClueAsync();
        expect(result2.clue).toBeDefined();
        expect(session.getProofChain().length).toBe(2);
    });

    it('should respect constraints async', async () => {
        // Add ordinal category for ordinal clues
        categories.push({ id: 'Age', type: CategoryType.ORDINAL, values: [1, 2] });
        const session = generator.startSession(categories);

        const result = await session.getNextClueAsync({ allowedClueTypes: [ClueType.ORDINAL] });
        if (result.clue) {
            expect(result.clue.type).toBe(ClueType.ORDINAL);
        }
    });
});
