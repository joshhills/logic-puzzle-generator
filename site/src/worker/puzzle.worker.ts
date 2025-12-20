
import { Generator, Puzzle } from '../../../src/engine/Generator';
import { CategoryConfig, TargetFact, ClueGenerationConstraints } from '../../../src/types';

// Define message types
export type WorkerMessage =
    | { type: 'start', categories: CategoryConfig[], targetFact: TargetFact, options: any }
    | { type: 'cancel' };

export type WorkerResponse =
    | { type: 'done', puzzle: Puzzle }
    | { type: 'error', message: string }
    | { type: 'trace', message: string };

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { type } = e.data;

    if (type === 'start') {
        const { categories, targetFact, options } = e.data as any;

        try {
            const gen = new Generator(options?.seed);

            // Inject onTrace callback
            const genOptions = {
                ...options,
                onTrace: (msg: string) => {
                    ctx.postMessage({ type: 'trace', message: msg });
                }
            };

            let puzzle: Puzzle;
            try {
                // Try strict generation first
                puzzle = gen.generatePuzzle(categories, targetFact, genOptions);
            } catch (strictErr: any) {
                // If specific generation failed (Likely ConfigurationError due to timeout)
                // AND we had a target clue count, try fallback.
                if (options.targetClueCount && strictErr.message && strictErr.message.includes("Could not generate puzzle")) {
                    ctx.postMessage({ type: 'trace', message: `⚠️ Strict generation failed (${strictErr.message}). Falling back to best-effort generation...` });

                    // Remove target constraint and try again
                    const fallbackOptions = { ...genOptions, targetClueCount: undefined };
                    puzzle = gen.generatePuzzle(categories, targetFact, fallbackOptions);
                } else {
                    throw strictErr; // Re-throw if it wasn't a recoverable target error
                }
            }

            ctx.postMessage({ type: 'done', puzzle });

        } catch (err: any) {
            console.error("Worker Generation Error:", err);
            ctx.postMessage({ type: 'error', message: err.message || "Unknown worker error" });
        }
    }
};
