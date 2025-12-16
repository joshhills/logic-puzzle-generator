import { Generator } from '../src/engine/Generator';
import { CategoryConfig, CategoryType } from '../src/types';
import { performance } from 'perf_hooks';

// Helper to generate random config
function generateConfig(numCats: number, numVals: number): CategoryConfig[] {
    const cats: CategoryConfig[] = [];
    for (let c = 0; c < numCats; c++) {
        const values: string[] = [];
        for (let v = 0; v < numVals; v++) {
            values.push(`V${v}`);
        }
        cats.push({
            id: `C${c}`,
            type: c === numCats - 1 ? CategoryType.ORDINAL : CategoryType.NOMINAL, // Make last one ordinal for variety
            values: values
        });
    }
    return cats;
}

interface TestCase {
    name: string;
    cats: number;
    vals: number;
    iters: number;
}

const MATRIX: TestCase[] = [
    { name: 'Standard (3x4)', cats: 3, vals: 4, iters: 100 },
    { name: 'Medium   (4x5)', cats: 4, vals: 5, iters: 50 },
    { name: 'Large    (5x5)', cats: 5, vals: 5, iters: 20 },
    { name: 'Wide     (6x4)', cats: 6, vals: 4, iters: 20 },
    { name: 'Tall     (3x8)', cats: 3, vals: 8, iters: 20 },
    { name: 'Stress   (8x5)', cats: 8, vals: 5, iters: 5 },
    { name: 'Deep     (3x10)', cats: 3, vals: 10, iters: 10 },
];

console.log('--- Scalability Benchmark ---');

for (const test of MATRIX) {
    const seed = Math.floor(Math.random() * 10000);
    const generator = new Generator(seed);
    const config = generateConfig(test.cats, test.vals);

    // Target: Cat0:Val0 -> Cat1
    const target = {
        category1Id: config[0].id,
        value1: config[0].values[0],
        category2Id: config[1].id,
    };

    const start = performance.now();
    let success = 0;

    process.stdout.write(`Running ${test.name} ... `);

    for (let i = 0; i < test.iters; i++) {
        try {
            let options: any = undefined;
            if (test.cats >= 8) options = { maxCandidates: 50 };
            else if (test.cats >= 6) options = { maxCandidates: 200 };

            const puzzle = generator.generatePuzzle(config, target, options);
            if (puzzle) success++;
        } catch (e) {
            // console.error(e); 
        }
    }

    const end = performance.now();
    const duration = end - start;
    const avg = duration / test.iters;

    console.log(`${avg.toFixed(2)}ms / puzzle (Success: ${success}/${test.iters})`);
}

// Exact Count Benchmark
console.log('--- Exact Count Benchmark ---');
{
    const ITERATIONS = 10;
    const TARGET_COUNT = 15;
    const generator = new Generator(123);
    const config = generateConfig(4, 5); // 4x5 grid
    const target = { category1Id: config[0].id, value1: config[0].values[0], category2Id: config[1].id };

    process.stdout.write(`Running Exact Count (4x5, Target=${TARGET_COUNT}) ... `);
    const start = performance.now();
    let success = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        try {
            const p = generator.generatePuzzle(config, target, { targetClueCount: TARGET_COUNT, maxCandidates: 100 });
            if (p.clues.length === TARGET_COUNT) success++;
        } catch (e) { }
    }
    const avg = (performance.now() - start) / ITERATIONS;
    console.log(`${avg.toFixed(2)}ms / puzzle (Success: ${success}/${ITERATIONS})`);
}

console.log('-----------------------------');
