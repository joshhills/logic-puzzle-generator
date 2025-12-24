
import { Generator } from '../src/engine/Generator';
import { GenerativeSession } from '../src/engine/GenerativeSession';
import { CategoryConfig, CategoryType, BinaryOperator, ClueType } from '../src/types';
import { BinaryClue } from '../src/engine/Clue';

describe('GenerativeSession Validation', () => {
    let generator: Generator;
    let session: GenerativeSession;

    const categories: CategoryConfig[] = [
        { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
        { id: 'Role', type: CategoryType.NOMINAL, values: ['Healer', 'Tank'] },
    ];

    beforeEach(() => {
        generator = new Generator(12345);
        session = generator.startSession(categories);
    });

    test('useClue throws Error if clue contradicts solution', () => {
        // Find a false clue
        // We can inspect the solution indirectly or just try a few opposite binary clues.
        // For a 2x2 grid, "Alice is Healer" and "Alice is Tank" are mutually exclusive.
        // One MUST be false.

        const clue1: BinaryClue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name', val1: 'Alice',
            cat2: 'Role', val2: 'Healer'
        };

        const clue2: BinaryClue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name', val1: 'Alice',
            cat2: 'Role', val2: 'Tank'
        };

        // One of these should work, the other should throw.

        let workedCount = 0;
        let threwCount = 0;

        try {
            session.useClue(clue1);
            workedCount++;
        } catch (e) {
            threwCount++;
        }

        try {
            session.useClue(clue2);
            workedCount++;
        } catch (e) {
            threwCount++;
        }

        expect(workedCount).toBe(1);
        expect(threwCount).toBe(1);
    });

    test('useClue accepts valid clues', () => {
        // Create a valid clue by asking the generator for one?
        // Or just use the one that worked above.
        // Let's rely on getMatchingClues returning valid ones.

        const validClues = session.getMatchingClues({}, 1);
        expect(validClues.length).toBeGreaterThan(0);

        const clue = validClues[0];
        expect(() => session.useClue(clue)).not.toThrow();
    });
});
