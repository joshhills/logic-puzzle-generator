import { Generator } from '../src/engine/Generator';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryType, CategoryConfig, TargetFact, ValueLabel } from '../src/types';
import { Clue, ClueType, BinaryOperator } from '../src/engine/Clue';

// Subclass to expose protected/private methods for testing
class TestableGenerator extends Generator {
    public initializeState(categories: CategoryConfig[]) {
        (this as any).createSolution(categories);
    }

    public publicCalculateScore(grid: LogicGrid, target: TargetFact, deductions: number, clue: Clue, prevClues: Clue[]): number {
        return (this as any).calculateScore(grid, target, deductions, clue, prevClues);
    }

    public getSolutionMap() {
        return (this as any).solution;
    }
}

describe('Generator Scoring Logic', () => {
    let generator: TestableGenerator;
    let categories: CategoryConfig[];
    let logicGrid: LogicGrid;

    beforeEach(() => {
        generator = new TestableGenerator(12345);
        categories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob'] },
            { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn'] },
            { id: 'Drink', type: CategoryType.NOMINAL, values: ['Water', 'Soda'] }
        ];
        logicGrid = new LogicGrid(categories);
        generator.initializeState(categories);
    });

    it('should penalize a clue that reveals the target prematurely (Non-Base to Non-Base)', () => {
        // Setup Solution:
        // We need to know what the generator picked.
        const sol = generator.getSolutionMap();
        // Assume Base=Name.
        // Let's find out what 'Alice' maps to in Snack and Drink.
        const aliceSnack = sol['Snack']['Alice'];
        const aliceDrink = sol['Drink']['Alice'];

        // Define Target: Snack -> Drink
        // e.g. "What does the person eating [Alice's Snack] drink?" -> [Alice's Drink]
        const target: TargetFact = {
            category1Id: 'Snack',
            value1: aliceSnack,
            category2Id: 'Drink'
        };

        // Current Grid State: Everything possible.

        // Construct a Clue that solves this EXACT target directly.
        // "The person eating [AliceSnack] drinks [AliceDrink]"
        const clue: Clue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Snack', val1: aliceSnack,
            cat2: 'Drink', val2: aliceDrink
        };

        // Apply clue to a temp grid
        const tempGrid = logicGrid.clone();
        // We assume logicGrid is fresh, so this clue is valid and has high deductions (resolves the link).
        // Actually, we need to apply it to see if it solves the target.
        // For Non-Base to Non-Base, one IS clue might not fully restrict it if rows/cols aren't cleared?
        // But we fixed/verified applyBinaryClue clears peers.
        // So this clue should lock Snack=AliceSnack <-> Drink=AliceDrink.
        // Possibilities count should be 1.

        // Manually apply for the test context
        const { deductions } = new (require('../src/engine/Solver').Solver)().applyClue(tempGrid, clue);

        // Check Score
        // Should be -1,000,000 because it solves the target but the puzzle (rest of grid) is NOT solved.
        const score = generator.publicCalculateScore(tempGrid, target, deductions, clue, []);

        expect(score).toBe(-Infinity);
    });
});
