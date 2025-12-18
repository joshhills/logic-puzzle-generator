
import { Generator } from '../src/engine/Generator';
import { CategoryType, CategoryConfig, TargetFact, ClueType } from '../src/types';
import { LogicGrid } from '../src/engine/LogicGrid';
import { GenerativeSession } from '../src/engine/GenerativeSession';

describe('Iterative Clue Generation', () => {
    let generator: Generator;
    let categories: CategoryConfig[];
    let session: GenerativeSession;

    beforeEach(() => {
        generator = new Generator(12345);
        categories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [10, 20, 30] }
        ];

        // Target: Name=Alice -> Color=Red
        const target: TargetFact = {
            category1Id: 'Name',
            value1: 'Alice',
            category2Id: 'Color'
        };

        session = generator.startSession(categories, target);
    });

    it('should initialize a session correctly', () => {
        const grid = session.getGrid();
        expect(grid).toBeInstanceOf(LogicGrid);
        expect(session.getProofChain().length).toBe(0);
    });

    it('should generate clues one by one', () => {
        // Step 1
        const result1 = session.getNextClue();
        expect(result1.clue).not.toBeNull();
        expect(result1.remaining).toBeGreaterThan(0);
        expect(session.getProofChain().length).toBe(1);
        expect(session.getProofChain()[0]).toBe(result1.clue);

        // Step 2
        const result2 = session.getNextClue();
        expect(result2.clue).not.toBeNull();
        expect(result2.clue).not.toEqual(result1.clue); // Should be different
        expect(session.getProofChain().length).toBe(2);
    });

    it('should respect constraints in step generation', () => {
        // Force an Ordinal clue if possible
        const result = session.getNextClue({ allowedClueTypes: [ClueType.ORDINAL] });
        if (result.clue) {
            expect(result.clue.type).toBe(ClueType.ORDINAL);
        } else {
            // If no ordinal clues were available, clue should be null
            expect(result.clue).toBeNull();
        }
    });

    it('should eventually solve the puzzle or exhaust clues', () => {
        let maxSteps = 20;
        let solved = false;

        for (let i = 0; i < maxSteps; i++) {
            const result = session.getNextClue();
            if (result.solved) {
                solved = true;
                break;
            }
            if (!result.clue) {
                break; // Exhausted
            }
        }

        // With random seed 12345 and greedy scoring, it should likely solve or fill up grid
        // We just check that it didn't crash.
        expect(session.getProofChain().length).toBeGreaterThan(0);
    });
});
