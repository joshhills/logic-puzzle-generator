
import { Generator } from '../engine/Generator';
import { CategoryConfig, CategoryType } from '../types';

// CONFIGURATION
const NUM_CATS = 5;
const NUM_ITEMS = 10;
const TARGET_CLUES = 45; // Minimum is 35, so 45 is still very hard (tight constraint)
const TIMEOUT_MS = 60000; // Give it 60s for this extreme test

// Setup Categories
const categories: CategoryConfig[] = [];
for (let i = 0; i < NUM_CATS; i++) {
    const values: string[] = [];
    for (let j = 0; j < NUM_ITEMS; j++) {
        values.push(`Item ${j + 1}`);
    }
    categories.push({
        id: `cat_${i + 1}`,
        type: CategoryType.NOMINAL,
        values: values
    });
}

const generator = new Generator(Date.now()); // Seed with time

console.log(`Starting Stress Test: ${NUM_CATS}x${NUM_ITEMS} Grid. Target: ${TARGET_CLUES}`);

let lastLogTime = 0;

try {
    const puzzle = generator.generatePuzzle(categories, undefined, {
        maxCandidates: Infinity,
        targetClueCount: TARGET_CLUES,
        timeoutMs: TIMEOUT_MS,
        onTrace: (msg: string) => {
            // Throttle logs to avoid flooding terminal
            if (msg.includes("Depth") || msg.includes("SOLVED") || msg.includes("Pruning")) {
                console.log(msg);
            } else if (Date.now() - lastLogTime > 1000) {
                console.log(msg);
                lastLogTime = Date.now();
            }
        }
    });

    console.log("SUCCESS! Puzzle generated.");
    console.log(`Clues: ${puzzle.clues.length}`);
    console.log("Proof Chain Length:", puzzle.proofChain.length);

} catch (error) {
    console.error("FAILED to generate puzzle.");
    console.error(error);
}
