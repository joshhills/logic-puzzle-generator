import { CategoryConfig, CategoryType, TargetFact, ValueLabel } from '../src/types';
import { Generator, ProofStep, Puzzle } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { Clue, BinaryClue, ClueType, BinaryOperator, OrdinalClue, OrdinalOperator, SuperlativeClue, SuperlativeOperator, UnaryClue, UnaryFilter } from '../src/engine/Clue';

const categories: CategoryConfig[] = [
    { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'David'] },
    { id: 'Genre', type: CategoryType.NOMINAL, values: ['Horror', 'Sci-Fi', 'Comedy', 'Drama'] },
    { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy', 'Chocolate'] },
    { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40, 50] },
];

const targetFact: TargetFact = {
    category1Id: 'Name',
    value1: 'David',
    category2Id: 'Snack',
};

const seed = 1234;
const generator = new Generator(seed);
const puzzle: Puzzle = generator.generatePuzzle(categories, targetFact);

console.log(`## ✨ Generated Puzzle (Seed: ${seed})`);
console.log('\n---\n');
console.log('### The Answer Key (For Verification Only)');

const baseCat = puzzle.categories[0];
for (const val of baseCat.values) {
    let line = '';
    for (const cat of puzzle.categories) {
        line += `${cat.id}: ${puzzle.solution[cat.id][val]} | `;
    }
    console.log(line.slice(0, -3));
}


console.log('\n### Goal');
console.log(`What ${puzzle.targetFact.category2Id} does [Name: ${puzzle.targetFact.value1}] have?`);
console.log('\n---\n');
console.log('### 🧩 Clue-by-Clue Proof Chain\n');

// The new API provides the proof chain directly, so we don't need to re-run the solver.
// We still create a grid to show the ambiguity snapshot at each step.
const logicGrid = new LogicGrid(categories);
const solver = new Solver();
puzzle.proofChain.forEach((step: ProofStep, index: number) => {
    console.log(`STEP ${index + 1}: Clue: ${clueToString(step.clue)}`);
    console.log(`Deductions: ${step.deductions} eliminations made.`);

    // Apply the clue to our local grid to show the state *after* this clue is applied
    solver.applyClue(logicGrid, step.clue);

    console.log('\nAmbiguity Snapshot:');

    // Focused snapshot for the target fact
    const targetCat2 = categories.find(c => c.id === puzzle.targetFact.category2Id);
    if (targetCat2) {
        const possibleValues = targetCat2.values.filter((v: ValueLabel) => logicGrid.isPossible(puzzle.targetFact.category1Id, puzzle.targetFact.value1, puzzle.targetFact.category2Id, v));
        console.log(`- Target: [${puzzle.targetFact.category1Id}: ${puzzle.targetFact.value1}] vs [${puzzle.targetFact.category2Id}]: ${possibleValues.length} possibilities remain -> [${possibleValues.join(', ')}]`);
    }

    // Overall grid completion
    const { totalPossible, currentPossible, solutionPossible } = logicGrid.getGridStats();
    const totalEliminatable = totalPossible - solutionPossible;
    const eliminatedSoFar = totalPossible - currentPossible;
    const percentageSolved = totalEliminatable > 0 ? (eliminatedSoFar / totalEliminatable) * 100 : 0;
    console.log(`- Grid Solved: ${percentageSolved.toFixed(1)}%`);

    console.log('\n---\n');
});

const targetValue = puzzle.solution[puzzle.targetFact.category2Id][puzzle.targetFact.value1];
console.log(`\n**Target Fact Solved:** [${puzzle.targetFact.category1Id}: ${puzzle.targetFact.value1}] is correlated with [${puzzle.targetFact.category2Id}: ${targetValue}]!`);


function clueToString(clue: Clue): string {
    switch (clue.type) {
        case ClueType.BINARY:
            const b = clue as BinaryClue;
            const op = b.operator === BinaryOperator.IS ? 'is' : 'is not';
            return `[${b.cat1}: ${b.val1}] ${op} [${b.cat2}: ${b.val2}]`;
        case ClueType.ORDINAL:
            const o = clue as OrdinalClue;
            const ordOp = o.operator === OrdinalOperator.GREATER_THAN ? 'is greater than' : 'is less than';
            return `The one with [${o.item1Cat}: ${o.item1Val}] ${ordOp} the one with [${o.item2Cat}: ${o.item2Val}] (by ${o.ordinalCat})`;
        case ClueType.SUPERLATIVE:
            const s = clue as SuperlativeClue;
            const supOp = s.operator === SuperlativeOperator.MAX ? 'is the oldest' : 'is the youngest';
            return `[${s.targetCat}: ${s.targetVal}] ${supOp}`;
        case ClueType.UNARY:
            const u = clue as UnaryClue;
            const filterStr = u.filter === UnaryFilter.IS_EVEN ? 'even' : 'odd';
            return `[${u.targetCat}: ${u.targetVal}] is associated with an ${filterStr} ${u.ordinalCat}`;
        default:
            return 'Unknown Clue Type';
    }
}
