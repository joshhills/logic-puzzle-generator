import { Generator } from '../src/engine/Generator';
import { CategoryType } from '../src/types';
import { ClueType, BinaryClue, BinaryOperator } from '../src/engine/Clue';

describe('Puzzle Quality Control', () => {

    test('Bans Direct Target Clues', () => {
        // Run 50 generations to be sure
        for (let i = 0; i < 50; i++) {
            const seed = Date.now() + i;
            const gen = new Generator(seed);

            const categories = [
                { id: 'Cats', type: CategoryType.NOMINAL, values: ['A', 'B', 'C'] },
                { id: 'Vals', type: CategoryType.NOMINAL, values: ['1', '2', '3'] },
                { id: 'Extras', type: CategoryType.NOMINAL, values: ['X', 'Y', 'Z'] }
            ];

            const target = {
                category1Id: 'Cats',
                value1: 'A',
                category2Id: 'Vals'
            };

            const puzzle = gen.generatePuzzle(categories, target, { targetClueCount: 5, timeoutMs: 5000 });
            // @ts-ignore
            const targetVal = puzzle.targetFact ? puzzle.targetFact.value2 : puzzle.target?.value2;

            // Check every clue
            for (const clue of puzzle.clues) {
                if (clue.type === ClueType.BINARY) {
                    const bc = clue as BinaryClue;
                    if (bc.operator === BinaryOperator.IS) {
                        // Forward Check
                        const isDirectMatch = (bc.cat1 === target.category1Id && bc.val1 === target.value1 && bc.cat2 === target.category2Id && bc.val2 === targetVal);

                        // Reverse Check
                        const isReverseMatch = (bc.cat1 === target.category2Id && bc.val1 === targetVal && bc.cat2 === target.category1Id && bc.val2 === target.value1);

                        if (isDirectMatch || isReverseMatch) {
                            throw new Error(`Direct Target Clue Found! Puzzle Seed: ${seed}`);
                        }
                    }
                }
            }
        }
    });

});
