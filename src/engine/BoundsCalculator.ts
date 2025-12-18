
import { Generator } from './Generator';
import { CategoryConfig, CategoryType } from '../types';

export class BoundsCalculator {
    static calculate(numCats: number, numItems: number, iterations: number = 20): { min: number, max: number } {
        // Construct standard config
        const categories: CategoryConfig[] = [];
        for (let i = 0; i < numCats; i++) {
            categories.push({
                id: `C${i}`,
                type: CategoryType.NOMINAL,
                values: Array.from({ length: numItems }, (_, j) => `V${j}`)
            });
        }

        const target = {
            category1Id: 'C0',
            value1: 'V0',
            category2Id: 'C1'
        };

        let globalMin = Infinity;
        let globalMax = 0;

        // Run batch
        for (let i = 0; i < iterations; i++) {
            // Seed
            const seed = Date.now() + (i * 9999);
            const gen = new Generator(seed);
            const bounds = gen.getClueCountBounds(categories, target, 1); // 1 iteration of internal logic

            if (bounds.min > 0) {
                globalMin = Math.min(globalMin, bounds.min);
                globalMax = Math.max(globalMax, bounds.max);
            }
        }

        if (globalMin === Infinity) globalMin = 0;
        return { min: globalMin, max: globalMax };
    }
}
