import { Generator } from '../src/engine/Generator';
import { CategoryConfig, CategoryType } from '../src/types';
import { ClueType, BinaryOperator, OrdinalOperator } from '../src/engine/Clue';
import { performance } from 'perf_hooks';

// Helper to generate random config
function generateConfig(numCats: number, numVals: number): CategoryConfig[] {
    const cats: CategoryConfig[] = [];
    for (let c = 0; c < numCats; c++) {
        const isOrdinal = c === numCats - 1;
        const values: any[] = [];
        for (let v = 0; v < numVals; v++) {
            if (isOrdinal) values.push((v + 1) * 10);
            else values.push(`V${v}`);
        }
        cats.push({
            id: `C${c}`,
            type: isOrdinal ? CategoryType.ORDINAL : CategoryType.NOMINAL,
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
    { name: 'Standard (3x4)', cats: 3, vals: 4, iters: 10 },
    { name: 'Medium   (4x5)', cats: 4, vals: 5, iters: 5 },
    { name: 'Large    (5x5)', cats: 5, vals: 5, iters: 2 },
    { name: 'Wide     (6x4)', cats: 6, vals: 4, iters: 2 },
    { name: 'Tall     (3x8)', cats: 3, vals: 8, iters: 2 },
    { name: 'Stress   (8x5)', cats: 8, vals: 5, iters: 1 },
    { name: 'Deep     (3x10)', cats: 3, vals: 10, iters: 1 },
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
            console.error(e);
        }
    }

    const end = performance.now();
    const duration = end - start;
    const avg = duration / test.iters;

    console.log(`${avg.toFixed(2)}ms / puzzle (Success: ${success}/${test.iters})`);
}

// Stats Benchmark
console.log('--- Clue Variety Benchmark ---');
{
    const ITERATIONS = 20;
    const generator = new Generator(999);
    const config = generateConfig(4, 5);
    const target = { category1Id: config[0].id, value1: config[0].values[0], category2Id: config[1].id };

    // Stats
    const stats: Record<string, number> = {};

    process.stdout.write(`Running Stats (4x5, N=${ITERATIONS}) ... `);
    let totalClues = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        try {
            const p = generator.generatePuzzle(config, target);
            if (p) {
                for (const c of p.clues) {
                    totalClues++;
                    let key = 'UNKNOWN';
                    if (c.type === ClueType.BINARY) key = `BINARY_${(c as any).operator === BinaryOperator.IS ? 'IS' : 'IS_NOT'}`;
                    else if (c.type === ClueType.ORDINAL) {
                        const op = (c as any).operator;
                        if (op === 0) key = 'ORD_GT';
                        else if (op === 1) key = 'ORD_LT';
                        else if (op === 2) key = 'ORD_NOT_GT'; // <=
                        else if (op === 3) key = 'ORD_NOT_LT'; // >=
                    }
                    else if (c.type === ClueType.SUPERLATIVE) {
                        const op = (c as any).operator;
                        if (op === 0) key = 'SUP_MIN';
                        else if (op === 1) key = 'SUP_MAX';
                        else if (op === 2) key = 'SUP_NOT_MIN';
                        else if (op === 3) key = 'SUP_NOT_MAX';
                    }
                    else if (c.type === ClueType.UNARY) key = 'UNARY';
                    else if (c.type === ClueType.CROSS_ORDINAL) key = 'CROSS_ORDINAL';

                    stats[key] = (stats[key] || 0) + 1;
                }
            }
        } catch (e) { }
    }
    console.log('Done.');
    console.log(`Total Clues: ${totalClues}`);
    Object.keys(stats).sort().forEach(k => {
        const pct = ((stats[k] / totalClues) * 100).toFixed(1);
        console.log(`  ${k}: ${stats[k]} (${pct}%)`);
    });
}

console.log('-----------------------------');
