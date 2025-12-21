
import { BoundsCalculator } from '../engine/BoundsCalculator';

describe('Bounds Generation', () => {
    // We increase timeout significantly for simulation
    jest.setTimeout(120000);

    test('Generate Table', () => {
        const configs = [
            { c: 2, i: 3 }, { c: 2, i: 4 }, { c: 2, i: 5 }, { c: 2, i: 6 },
            { c: 3, i: 3 }, { c: 3, i: 4 }, { c: 3, i: 5 }, { c: 3, i: 6 },
            { c: 4, i: 3 }, { c: 4, i: 4 }, { c: 4, i: 5 }, { c: 4, i: 6 }
        ];

        const results: Record<string, { min: number, max: number }> = {};

        console.log("Generating Bounds Table (this may take a minute)...");

        for (const conf of configs) {
            const key = `${conf.c}x${conf.i}`;
            // 20 iterations per config
            process.stdout.write(`Computing ${key}... `);
            const bounds = BoundsCalculator.calculate(conf.c, conf.i, 20);
            results[key] = bounds;
            console.log(`[${bounds.min}, ${bounds.max}]`);
        }

        console.log("\n--- JSON OUTPUT ---");
        console.log(JSON.stringify(results, null, 2));
        console.log("--- END JSON ---\n");
    });
});
