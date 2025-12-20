import { Generator } from '../src/engine/Generator';
import { CategoryConfig, CategoryType } from '../src/types';
import { LogicGrid } from '../src/engine/LogicGrid';


describe('Generator Termination', () => {
    it('should stop generating clues once the puzzle is solved', () => {
        const categories: CategoryConfig[] = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'Dave'] },
            { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green', 'Yellow'] },
            { id: 'Item', type: CategoryType.NOMINAL, values: ['Hammer', 'Wrench', 'Saw', 'Drill'] },
        ];
        // No fix target, let it randomly pick or default
        const generator = new Generator(12345);

        // Use standard generation (no targetClueCount)
        const puzzle = generator.generatePuzzle(categories, undefined, {
            targetClueCount: undefined,
            maxCandidates: 50
        });

        console.log(`Generated ${puzzle.clues.length} clues.`);

        // 100 is the hard limit in the loop. 
        // A simple 4x4x3 puzzle should rarely need more than 25-30 clues.
        expect(puzzle.clues.length).toBeLessThan(80);

        // Verify it is actually solved
        const grid = new LogicGrid(categories);
        const solver = generator['solver']; // access private solver

        for (const clue of puzzle.clues) {
            solver.applyClue(grid, clue);
        }

        const isSolved = generator.isPuzzleSolved(grid, puzzle.solution, generator['reverseSolution']);
        expect(isSolved).toBe(true);
    });
});
