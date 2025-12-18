
// Precomputed via Monte Carlo simulation (src/scripts/GenerateBounds.test.ts)
// Key format: "${numCats}x${numItems}"
// Updated after banning Direct Target Clues to ensure puzzle quality.
export const DIFFICULTY_BOUNDS: Record<string, { min: number, max: number }> = {
    "2x3": { "min": 2, "max": 2 },
    "2x4": { "min": 3, "max": 10 },
    "2x5": { "min": 4, "max": 17 },
    "2x6": { "min": 5, "max": 26 },
    "3x3": { "min": 3, "max": 9 },
    "3x4": { "min": 5, "max": 26 },
    "3x5": { "min": 7, "max": 47 },
    "3x6": { "min": 9, "max": 72 },
    "4x3": { "min": 5, "max": 16 },
    "4x4": { "min": 8, "max": 44 },
    "4x5": { "min": 11, "max": 87 },
    "4x6": { "min": 14, "max": 100 }
};

export const getRecommendedBounds = (numCats: number, numItems: number) => {
    const key = `${numCats}x${numItems}`;
    return DIFFICULTY_BOUNDS[key] || { min: 8, max: 20 }; // Safe Fallback
};
