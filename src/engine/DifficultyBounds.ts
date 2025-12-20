
// Precomputed via Monte Carlo simulation (src/scripts/GenerateBounds.test.ts)
// Key format: "${numCats}x${numItems}"
// Updated after banning Direct Target Clues to ensure puzzle quality.
export const DIFFICULTY_BOUNDS: Record<string, { min: number, max: number }> = {
    // 2 Categories
    "2x3": { "min": 2, "max": 2 },
    "2x4": { "min": 3, "max": 10 },
    "2x5": { "min": 4, "max": 17 },
    "2x6": { "min": 5, "max": 26 },
    "2x7": { "min": 6, "max": 37 },
    "2x8": { "min": 7, "max": 50 },
    "2x9": { "min": 8, "max": 65 },
    "2x10": { "min": 9, "max": 82 },

    // 3 Categories
    "3x3": { "min": 3, "max": 9 },
    "3x4": { "min": 5, "max": 26 },
    "3x5": { "min": 7, "max": 47 },
    "3x6": { "min": 9, "max": 72 },
    "3x7": { "min": 11, "max": 100 },
    "3x8": { "min": 13, "max": 130 },
    "3x9": { "min": 15, "max": 160 },
    "3x10": { "min": 17, "max": 200 },

    // 4 Categories
    "4x3": { "min": 5, "max": 16 },
    "4x4": { "min": 8, "max": 44 },
    "4x5": { "min": 11, "max": 87 },
    "4x6": { "min": 14, "max": 140 },
    "4x7": { "min": 17, "max": 200 },
    "4x8": { "min": 20, "max": 260 },
    "4x9": { "min": 23, "max": 330 },
    "4x10": { "min": 26, "max": 400 },

    // 5 Categories
    "5x3": { "min": 7, "max": 25 },
    "5x4": { "min": 11, "max": 70 },
    "5x5": { "min": 15, "max": 130 },
    "5x6": { "min": 19, "max": 200 },
    "5x7": { "min": 23, "max": 280 },
    "5x8": { "min": 27, "max": 370 },
    "5x9": { "min": 31, "max": 470 },
    "5x10": { "min": 35, "max": 580 }
};

export const getRecommendedBounds = (numCats: number, numItems: number) => {
    const key = `${numCats}x${numItems}`;
    if (DIFFICULTY_BOUNDS[key]) return DIFFICULTY_BOUNDS[key];

    // Dynamic Fallback for large grids
    // Based on regression from smaller grids:
    // Min ~ 0.8 * (Cats-1) * Items
    // Max ~ 6.0 * (Cats-1) * Items (loose upper bound)
    const factor = (numCats - 1) * numItems;
    const min = Math.max(5, Math.floor(factor * 0.7));
    const max = Math.floor(factor * 5.0);

    return { min, max };
};
