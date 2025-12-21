import { CategoryConfig, CategoryType, ValueLabel, Solution, TargetFact, ClueGenerationConstraints, ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, CrossOrdinalOperator } from '../types';
import { ConfigurationError } from '../errors';
import { Clue, BinaryClue, OrdinalClue, SuperlativeClue, UnaryClue, CrossOrdinalClue } from './Clue';
import { LogicGrid } from './LogicGrid';
import { Solver } from './Solver';
import { GenerativeSession } from './GenerativeSession';
import { getRecommendedBounds } from './DifficultyBounds';

/**
 * Represents a single step in the logical deduction path.
 */
export interface ProofStep {
    /** The clue applied at this step. */
    clue: Clue;
    /** The number of logical eliminations that resulted immediately from this clue. */
    deductions: number;
}

/**
 * The complete result of the puzzle generation process.
 */
export interface Puzzle {
    /** The solution grid (Category -> Value -> Corresponding Value). */
    solution: Solution;
    /** The list of clues needed to solve the puzzle, in no particular order. */
    clues: Clue[];
    /** An ordered list of clues that demonstrates a step-by-step logical solution. */
    proofChain: ProofStep[];
    /** The configuration used to generate this puzzle. */
    categories: CategoryConfig[];
    /** The specific fact that the puzzle is designed to reveal at the end. */
    targetFact: TargetFact;
}

/**
 * Configuration options for the puzzle generation process.
 */
export interface GeneratorOptions {
    /**
     * The maximum number of candidate clues to evaluate at each step.
     * Lower values improve performance for large grids but may slightly reduce puzzle quality.
     * Default: Infinity (Exhaustive search).
     */
    maxCandidates?: number;
    /**
     * Attempt to generate a puzzle with exactly this many clues.
     * The generator will use backtracking to find a path of this length.
     * May throw an error if the count is infeasible.
     */
    targetClueCount?: number;
    /**
     * Timeout in milliseconds for the generation process.
     * Default: 10000ms (10s).
     */
    timeoutMs?: number;
    /**
     * Constraints to filter the types of clues generated.
     */
    constraints?: ClueGenerationConstraints;
    /**
     * Callback for trace logs execution details.
     */
    onTrace?: (message: string) => void;
}

// A simple seeded PRNG (mulberry32)
function mulberry32(a: number) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * The main class responsible for generating logic puzzles.
 * 
 * It handles the creation of a consistent solution, the generation of all possible clues,
 * and the selection of an optimal set of clues to form a solvable puzzle with a specific target.
 */
export class Generator {
    private seed: number;
    private random: () => number;
    private solver: Solver;
    private solution: Solution = {};
    private valueMap: Map<ValueLabel, Record<string, ValueLabel>> = new Map();
    private reverseSolution: Map<string, Map<ValueLabel, ValueLabel>> = new Map();

    /**
     * Creates a new Generator instance.
     * 
     * @param seed - A numeric seed for the random number generator to ensure reproducibility.
     */
    constructor(seed: number) {
        this.seed = seed;
        this.random = mulberry32(seed);
        this.solver = new Solver();
    }

    /**
     * Generates a fully solvable logic puzzle based on the provided configuration.
     * Estimates the minimum and maximum number of clues required to solve a puzzle
     * for the given configuration and target, by running several simulations.
     * This is a computationally intensive operation.
     *
     * @param categories - The categories and values to include in the puzzle.
     * @param target - The specific fact that should be the final deduction of the puzzle.
     * @returns A promise resolving to an object containing the estimated min and max clue counts.
     */
    public getClueCountBounds(categories: CategoryConfig[], target: TargetFact, maxIterations: number = 10): { min: number, max: number } {
        let min = Infinity;
        let max = 0;

        for (let i = 0; i < maxIterations; i++) {
            // Use temporary generator state for simulation
            const seed = this.seed + i + 1;
            const tempGen = new Generator(seed);

            // Min bound: Greedy Best
            try {
                const minPuzzle = tempGen.internalGenerate(categories, target, 'min');
                if (minPuzzle) min = Math.min(min, minPuzzle.clues.length);
            } catch (e) { /* Ignore unsolvables in simulation */ }

            // Max bound: Greedy Worst
            try {
                const tempGen2 = new Generator(seed); // fresh state
                const maxPuzzle = tempGen2.internalGenerate(categories, target, 'max');
                if (maxPuzzle) max = Math.max(max, maxPuzzle.clues.length);
            } catch (e) { /* Ignore */ }
        }

        if (min === Infinity) min = 0; // Failed to solve any
        return { min, max };
    }

    /**
     * Generates a fully solvable logic puzzle.
     * @param categories - The categories config.
     * @param target - Optional target fact. If missing, a random one is synthesized.
     * @param config - Generation options.
     */
    public generatePuzzle(
        categories: CategoryConfig[],
        target?: TargetFact,
        config: GeneratorOptions = {}
    ): Puzzle {
        const { targetClueCount, maxCandidates = 50, timeoutMs = 10000 } = config;

        // Validation
        if (categories.length < 2) throw new ConfigurationError("Must have at least 2 categories.");
        if (targetClueCount !== undefined && targetClueCount < 1) throw new ConfigurationError("Target clue count must be at least 1");
        if (maxCandidates < 1) throw new ConfigurationError("maxCandidates must be at least 1");

        // Synthesize Target if Missing
        let finalTarget = target;
        if (!finalTarget) {
            // Pick Random Target
            const cat1Idx = Math.floor(this.random() * categories.length);
            let cat2Idx = Math.floor(this.random() * categories.length);
            while (cat2Idx === cat1Idx) {
                cat2Idx = Math.floor(this.random() * categories.length);
            }
            const c1 = categories[cat1Idx];
            const c2 = categories[cat2Idx];
            const valIdx = Math.floor(this.random() * c1.values.length);

            finalTarget = {
                category1Id: c1.id,
                value1: c1.values[valIdx],
                category2Id: c2.id
            };
        }

        // Validate target fact
        const catIds = new Set(categories.map(c => c.id));
        if (!catIds.has(finalTarget.category1Id) || !catIds.has(finalTarget.category2Id)) {
            throw new ConfigurationError('Target fact refers to non-existent categories.');
        }
        if (finalTarget.category1Id === finalTarget.category2Id) {
            throw new ConfigurationError('Target fact must refer to two different categories.');
        }

        return this.internalGenerate(categories, finalTarget, 'standard', { maxCandidates, targetClueCount, timeoutMs, constraints: config.constraints, onTrace: config.onTrace });
    }

    /**
     * Starts an interactive generative session.
     * @param categories
     * @param target Optional target fact.
     */
    public startSession(categories: CategoryConfig[], target?: TargetFact): GenerativeSession {
        // Validation
        if (categories.length < 2) throw new ConfigurationError("Must have at least 2 categories.");

        // Synthesize Target if Missing
        let finalTarget = target;
        if (!finalTarget) {
            // Pick Random Target
            const cat1Idx = Math.floor(this.random() * categories.length);
            let cat2Idx = Math.floor(this.random() * categories.length);
            while (cat2Idx === cat1Idx) {
                cat2Idx = Math.floor(this.random() * categories.length);
            }
            const c1 = categories[cat1Idx];
            const c2 = categories[cat2Idx];
            const valIdx = Math.floor(this.random() * c1.values.length);

            finalTarget = {
                category1Id: c1.id,
                value1: c1.values[valIdx],
                category2Id: c2.id
            };
        }

        // Initialize State maps locally for this session
        const valueMap = new Map<ValueLabel, Record<string, ValueLabel>>();
        const solution: Solution = {};
        const reverseSolution = new Map<string, Map<ValueLabel, ValueLabel>>();

        // Populate them
        this.createSolution(categories, valueMap, solution, reverseSolution);

        return new GenerativeSession(this, categories, solution, reverseSolution, valueMap, finalTarget);
    }

    /**
     * Internal generation method exposed for simulations.
     * @param strategy 'standard' | 'min' | 'max'
     */
    public internalGenerate(categories: CategoryConfig[], target: TargetFact, strategy: 'standard' | 'min' | 'max', options?: GeneratorOptions): Puzzle {
        if (!categories || categories.length < 2) {
            throw new ConfigurationError('At least 2 categories are required to generate a puzzle.');
        }

        const maxCandidates = options?.maxCandidates ?? Infinity;
        const targetCount = options?.targetClueCount;
        const constraints = options?.constraints;

        if (options?.onTrace) options.onTrace("Generator: internalGenerate started.");

        // Ensure values exist (start of orphan code)
        const cat1 = categories.find(c => c.id === target.category1Id);
        if (cat1 && !cat1.values.includes(target.value1)) {
            throw new ConfigurationError(`Target value '${target.value1}' does not exist in category '${target.category1Id}'.`);
        }

        // Validate Constraints vs Categories
        if (constraints?.allowedClueTypes) {
            // Guard: Prevent "Ambiguous" constraint sets (Weak types only).
            // Strong types provide specific identity or relative position (Comparison) needed to solve N > 2.
            // Weak types (Unary, Superlative) only provide buckets or boundaries.
            const strongTypes = [ClueType.BINARY, ClueType.ORDINAL, ClueType.CROSS_ORDINAL];
            const hasStrongType = constraints.allowedClueTypes.some(t => strongTypes.includes(t));

            if (constraints.allowedClueTypes.length > 0 && !hasStrongType) {
                throw new ConfigurationError("Invalid Constraints: The selected clue types are ambiguous on their own. Please allow at least one identity-resolving type (Binary, Ordinal, or Cross-Ordinal).");
            }

            const ordinalCategories = categories.filter(c => c.type === CategoryType.ORDINAL);
            const ordinalCount = ordinalCategories.length;
            const hasOrdinalCategory = ordinalCount > 0;

            const ordinalDependentTypes = [
                ClueType.ORDINAL,
                ClueType.SUPERLATIVE,
                ClueType.UNARY,
                ClueType.CROSS_ORDINAL
            ];

            const requestedOrdinal = constraints.allowedClueTypes.some(t => ordinalDependentTypes.includes(t));

            if (requestedOrdinal && !hasOrdinalCategory) {
                if (!constraints.allowedClueTypes.includes(ClueType.BINARY)) {
                    throw new ConfigurationError('Invalid Constraints: Ordinal-based clue types were requested, but no Ordinal categories exist. Please add an ordinal category or allow Binary clues.');
                }
            }

            // Cross-Ordinal Validation: Requires at least 2 ordinal categories
            if (constraints.allowedClueTypes.includes(ClueType.CROSS_ORDINAL) && ordinalCount < 2) {
                throw new ConfigurationError("Invalid Constraints: Cross-Ordinal clues require at least two separate Ordinal categories.");
            }

            // Unary Clue Validation: Even/Odd requires at least one ordinal category where values have at least one odd and at least one even
            if (constraints.allowedClueTypes.includes(ClueType.UNARY)) {
                const hasValidUnaryCategory = ordinalCategories.some(cat => {
                    const numericValues = cat.values.map(v => Number(v)).filter(v => !isNaN(v));
                    const hasOdd = numericValues.some(v => v % 2 !== 0);
                    const hasEven = numericValues.some(v => v % 2 === 0);
                    return hasOdd && hasEven;
                });

                if (!hasValidUnaryCategory) {
                    throw new ConfigurationError("Invalid Constraints: Unary clues (Even/Odd) require at least one Ordinal category to contain both odd and even values.");
                }
            }
        }







        // Validate Ordinal Categories
        for (const cat of categories) {
            if (cat.type === CategoryType.ORDINAL) {
                const nonNumeric = cat.values.some(v => typeof v !== 'number' && isNaN(Number(v)));
                if (nonNumeric) {
                    // Try to auto-fix/parse?
                    // For strictness in the library, we should probably throw or rely on the caller to provide numbers.
                    // But the JSON input from UI might be strings.
                    // The Generator expects `ValueLabel` which is `string | number`.
                    // If we want to support "1", "2" strings as numbers, we should parse them?
                    // But `category.values` is the source of truth.
                    // If the user passes ["1", "2"], they are strings.
                    // The engine treats them as discrete values.
                    // BUT Ordinal logic (Clue generation) does `(a as number) - (b as number)`.
                    // So they MUST be actual numbers or we must cast them efficiently.

                    // Let's enforce that if it is ORDINAL, the values MUST be parseable as numbers.
                    // And ideally, they should BE numbers in the config.

                    // If we throw here, we protect the engine from NaN logic.
                    throw new ConfigurationError(`Category '${cat.id}' is ORDINAL but contains non-numeric values.`);
                }
            }
        }

        // Initialize Solution & State Maps (REQUIRED for clue generation)
        // Initialize Solution & State Maps (REQUIRED for clue generation)
        // Note: internalGenerate uses the instance properties for state to simulate original behavior
        // But we should clean this up to be pure if possible. 
        // For now, we reset instance properties.
        this.valueMap = new Map();
        this.solution = {};
        this.reverseSolution = new Map();

        if (options?.onTrace) options.onTrace("Generator: Creating solution...");
        this.createSolution(categories, this.valueMap, this.solution, this.reverseSolution);
        if (options?.onTrace) options.onTrace("Generator: Solution created.");

        // Backtracking Method (Exact Target)
        if (targetCount !== undefined) {
            // Feasibility Check:
            // Use precompiled bounds instead of expensive simulation.
            // if (options?.onTrace) options.onTrace("Generator: Checking feasibility (static bounds lookup)...");

            // Assume 5 items per cat max if 5x10, etc. 
            // Actually getRecommendedBounds needs numCats and numItems.
            // We can approximate numItems from the first category (assuming symmetry).
            const numCats = categories.length;
            const numItems = categories[0].values.length;

            const bounds = getRecommendedBounds(numCats, numItems);

            if (options?.onTrace) options.onTrace(`Generator: Feasibility check complete. Recommended bounds: ${bounds.min}-${bounds.max}`);

            const MARGIN = 0;
            let effectiveTarget = targetCount;
            if (bounds.min > 0 && targetCount < (bounds.min - MARGIN)) {
                console.warn(`Target clue count ${targetCount} is too low (Estimated min: ${bounds.min}). Auto-adjusting to ${bounds.min}.`);
                effectiveTarget = bounds.min;
            }

            // We need an exact count.
            // Run backtracking search with the feasible target.
            try {
                return this.generateWithBacktracking(
                    categories,
                    target,
                    effectiveTarget,
                    maxCandidates,
                    strategy,
                    options?.timeoutMs ?? 10000,
                    options?.constraints,
                    options?.onTrace
                );
            } catch (e: any) {
                // If it failed (timeout or exhausted), fallback?
                throw e;
            }
        }

        if (options?.onTrace) options.onTrace("Generator: Generating all possible clues...");
        let availableClues = this.generateAllPossibleClues(categories, options?.constraints, this.reverseSolution, this.valueMap);
        if (options?.onTrace) options.onTrace(`Generator: Generated ${availableClues.length} candidate clues.`);

        const logicGrid = new LogicGrid(categories);

        const proofChain: ProofStep[] = [];
        const MAX_STEPS = 100;

        while (proofChain.length < MAX_STEPS) {
            // Trace Support for Standard Mode
            if (options?.onTrace) {
                const depth = proofChain.length;
                const stats = logicGrid.getGridStats();
                // Ensure denominator is valid and non-zero. 
                // totalPossible = N*N*C*(C-1)/2 (approx). 
                // solutionPossible = N*C*(C-1)/2 (exact matches).
                const range = Math.max(1, stats.totalPossible - stats.solutionPossible);
                const current = Math.max(0, stats.currentPossible - stats.solutionPossible);
                const solvedP = Math.min(100, Math.round(((range - current) / range) * 100));

                options.onTrace(`Depth ${depth}: ${solvedP}% Solved. Candidates: ${availableClues.length}`);

                if (solvedP >= 100 && this.isPuzzleSolved(logicGrid, this.solution, this.reverseSolution)) {
                    options.onTrace("Generator: Puzzle Solved (100%).");
                    break;
                }
            }

            let bestCandidate: { clue: Clue, score: number } | null = null;
            let finalCandidate: { clue: Clue, score: number } | null = null;

            // Strategy-specific shuffling
            if (maxCandidates < availableClues.length) {
                for (let i = availableClues.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [availableClues[i], availableClues[j]] = [availableClues[j], availableClues[i]];
                }
            }

            const candidatesToCheck = Math.min(availableClues.length, maxCandidates);
            let checkedCount = 0;

            for (let i = availableClues.length - 1; i >= 0; i--) {
                if (checkedCount >= candidatesToCheck) break;

                const clue = availableClues[i];
                const tempGrid = logicGrid.clone();
                const { deductions } = this.solver.applyClue(tempGrid, clue);

                if (deductions === 0) {
                    availableClues.splice(i, 1);
                    continue;
                }

                checkedCount++;
                let score = 0;

                // Strategy Logic
                if (strategy === 'min') {
                    // Prefer HIGH deductions
                    score = deductions * 1000;
                } else if (strategy === 'max') {
                    // Prefer LOW deductions (but > 0)
                    score = (100 / deductions);
                } else {
                    // Standard balanced scoring
                    score = this.calculateClueScore(tempGrid, target, deductions, clue, proofChain.map(p => p.clue), this.solution, this.reverseSolution);
                }

                // Check for immediate solution vs normal step
                const clueType = clue.type;
                const targetValue = this.solution[target.category2Id][target.value1];
                const isTargetSolved = tempGrid.isPossible(target.category1Id, target.value1, target.category2Id, targetValue) &&
                    tempGrid.getPossibilitiesCount(target.category1Id, target.value1, target.category2Id) === 1;
                const puzzleSolved = this.isPuzzleSolved(tempGrid, this.solution, this.reverseSolution);

                if (isTargetSolved) {
                    if (puzzleSolved) {
                        // Solves it completely - always a candidate
                        finalCandidate = { clue, score: score + 1000000 };
                    } else {
                        // Solves target but grid incomplete - bad
                        score = -1000000;
                    }
                }

                if (score > -999999) {
                    if (!bestCandidate || score > bestCandidate.score) {
                        bestCandidate = { clue, score };
                    }
                }
            }

            const chosenCandidate = finalCandidate || bestCandidate; // Prioritize finishing if possible?
            // Actually standard logic prioritizes 'bestCandidate_ unless final is the only option or final is better.
            // Let's stick closer to original:
            // if (isTargetSolved && puzzleSolved) return 1000000

            // Simplified selection for simulation:
            if (!chosenCandidate) break;

            const chosenClue = chosenCandidate.clue;
            const { deductions } = this.solver.applyClue(logicGrid, chosenClue);
            proofChain.push({ clue: chosenClue, deductions });

            const chosenIndex = availableClues.findIndex(c => JSON.stringify(c) === JSON.stringify(chosenClue));
            if (chosenIndex > -1) availableClues.splice(chosenIndex, 1);

            if (this.isPuzzleSolved(logicGrid, this.solution, this.reverseSolution)) break;
        }

        return {
            solution: this.solution,
            clues: proofChain.map(p => p.clue),
            proofChain,
            categories,
            targetFact: target,
        };
    }

    private generateWithBacktracking(
        categories: CategoryConfig[],
        target: TargetFact,
        targetCount: number,
        maxCandidates: number,
        strategy: 'standard' | 'min' | 'max',
        timeoutMs: number = 10000,
        constraints?: ClueGenerationConstraints,
        onTrace?: (msg: string) => void
    ): Puzzle {
        const availableClues = this.generateAllPossibleClues(categories, constraints, this.reverseSolution, this.valueMap);

        // ADAPTIVE MID-RUN BACKTRACKING
        // Instead of restarting, we increase aggression dynamically when we hit dead ends.
        const logicGrid = new LogicGrid(categories);
        let backtrackCount = 0;
        const startTime = Date.now();


        // Define recursive search within this attempt context

        const search = (currentGrid: LogicGrid, currentChain: ProofStep[], currentAvailable: Clue[], overrideStrategy?: 'SPEED' | 'STALL'): ProofStep[] | null => {
            // Panic based on TIME, not backtrack count.
            // This ensures we use the full available timeout (e.g. 270s) before giving up.
            const elapsed = Date.now() - startTime;
            const timeRatio = elapsed / timeoutMs; // 0.0 to 1.0

            // detailed pacing control.
            // Bias ramps slightly to encourage backtracking if we are stuck.
            const aggressionBias = 1.0 + (timeRatio * 3.0);

            // Trace Status
            if (onTrace && currentChain.length % 1 === 0) {
                const depth = currentChain.length + 1;
                const stats = currentGrid.getGridStats();
                const solvedP = Math.round(((stats.totalPossible - stats.currentPossible) / (stats.totalPossible - stats.solutionPossible)) * 100);

                if (Math.random() < 0.05) {
                    onTrace(`Depth ${depth}/${targetCount}: ${solvedP}% Solved. Bias: ${aggressionBias.toFixed(2)} (Backtracks: ${backtrackCount})`);
                }
            }

            // Check if solved
            const isSolved = this.isPuzzleSolved(currentGrid, this.solution, this.reverseSolution);

            if (isSolved) {
                if (currentChain.length === targetCount) {
                    if (onTrace) onTrace(`SOLVED! Exact match at ${targetCount} clues.`);
                    return currentChain;
                }
                return null;
            }

            if (currentChain.length >= targetCount) {
                return null; // Overshot target without solving. Trigger backtracking to previous depth.
            }

            // Heuristic Sorting
            const stats = currentGrid.getGridStats();
            const progress = (stats.totalPossible - stats.currentPossible) / (stats.totalPossible - stats.solutionPossible);
            const stepsTaken = currentChain.length + 1; // considering next step
            // const idealProgressPerStep = 1.0 / targetCount;
            // const currentExpectedProgress = stepsTaken * idealProgressPerStep;

            // Filter and Sort Candidates
            let candidates: { clue: Clue, deductions: number, score: number, grid: LogicGrid, index: number, currentScore?: number }[] = [];

            // Shuffle for variety
            if (maxCandidates < currentAvailable.length) {
                for (let i = currentAvailable.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [currentAvailable[i], currentAvailable[j]] = [currentAvailable[j], currentAvailable[i]];
                }
            }

            // DYNAMIC PRUNING
            // ...
            // Use quadratic power instead of cubic for gentler falloff
            // At Bias 1.26 (50 backtracks): Check 50 / 2 = 25.
            // At Bias 1.58 (100 backtracks): Check 50 / 4 = 12.
            const baseMax = overrideStrategy ? 3 : ((maxCandidates === Infinity) ? 50 : maxCandidates);
            const dynamicLimit = Math.max(1, Math.floor(baseMax / Math.pow(aggressionBias, 2)));
            const limit = Math.min(currentAvailable.length, dynamicLimit);

            // Debug pruning
            if (onTrace && Math.random() < 0.001) {
                onTrace(`Pruning: Limit reduced to ${limit} (Bias ${aggressionBias.toFixed(1)})`);
            }

            let checked = 0;

            for (let i = 0; i < currentAvailable.length; i++) {
                if (checked >= limit) break;

                const clue = currentAvailable[i];
                const tempGrid = currentGrid.clone();
                const { deductions } = this.solver.applyClue(tempGrid, clue);

                if (deductions === 0) continue;
                checked++;

                // Do NOT allow early solves unless it's the last step
                const solvedNow = this.isPuzzleSolved(tempGrid, this.solution, this.reverseSolution);
                if (solvedNow && (stepsTaken < targetCount)) continue;

                // Calculate Base Quality Score (Variety, Repetition, etc.)
                let score = this.calculateClueScore(tempGrid, target, deductions, clue, currentChain.map(p => p.clue), this.solution, this.reverseSolution);

                // TARGET CLUE COUNT HEURISTIC
                if (targetCount) {
                    const percentThroughTarget = stepsTaken / targetCount;
                    const percentSolved = (stats.totalPossible - tempGrid.getGridStats().currentPossible) / (stats.totalPossible - stats.solutionPossible);

                    const expectedSolved = Math.pow(percentThroughTarget, 1.8);
                    const diff = percentSolved - expectedSolved;

                    // If diff is POSITIVE, we are AHEAD (Too Fast).
                    // We need to stall -> Penalize deductions.

                    // If diff is NEGATIVE, we are BEHIND (Too Slow).
                    // We need to catch up -> Reward deductions.

                    // Weight: 50 * Diff * Deductions.
                    // If Diff is +0.2 (20% ahead), we subtract 10 * Deductions.
                    // If Diff is -0.2 (20% behind), we add 10 * Deductions.
                    score -= (diff * deductions * 50);
                }

                candidates.push({ clue, deductions, score, grid: tempGrid, index: i });
            }

            // candidates.sort((a, b) => b.score - a.score); // MOVED INSIDE LOOP


            // ---------------------------------------------------------
            // HYBRID PRIORITY SORTING (ITERATIVE CORRECTION)
            // ---------------------------------------------------------
            // Strategy: "Try Normal -> If Fail -> Try Correction -> If Fail -> Try Rest"
            // This ensures we attempt to fix the pacing (Speed/Stall) immediately upon backtracking.

            let orderedCandidates: typeof candidates = [];
            let primaryCandidate: typeof candidates[0] | undefined;
            let correctionCandidate: typeof candidates[0] | undefined;

            if (overrideStrategy) {
                const isStall = overrideStrategy === 'STALL';
                // Sort by weak/strong immediately
                orderedCandidates = candidates.sort((a, b) => {
                    const diff = a.deductions - b.deductions;
                    return isStall ? diff : -diff; // Weakest first vs Strongest first
                });
            } else {
                // 1. Primary Heuristic (Balance)
                candidates.sort((a, b) => b.score - a.score);
                primaryCandidate = candidates[0];
            }

            if (!overrideStrategy) {
                // 2. Correction Heuristic (Extreme Logic)
                correctionCandidate = candidates[0];

                if (targetCount) {
                    const expectedProgress = Math.pow(stepsTaken / targetCount, 1.8);
                    if (progress > expectedProgress) {
                        // STALL: Prefer Min Deductions
                        const sortedByWeakness = [...candidates].sort((a, b) => {
                            if (a.deductions !== b.deductions) return a.deductions - b.deductions;
                            return b.score - a.score;
                        });
                        correctionCandidate = sortedByWeakness[0];
                    } else {
                        // SPEED: Prefer Max Deductions
                        const sortedByStrength = [...candidates].sort((a, b) => {
                            if (a.deductions !== b.deductions) return b.deductions - a.deductions;
                            return b.score - a.score;
                        });
                        correctionCandidate = sortedByStrength[0];
                    }
                }

                // 3. Construct Final List
                // (orderedCandidates var is from outer scope)
                if (primaryCandidate) orderedCandidates.push(primaryCandidate);
                if (correctionCandidate && correctionCandidate !== primaryCandidate) {
                    orderedCandidates.push(correctionCandidate);
                }

                for (const c of candidates) {
                    if (c !== primaryCandidate && c !== correctionCandidate) {
                        orderedCandidates.push(c);
                    }
                }
            }

            // 4. Iterate (With Timeout guard)
            for (const cand of orderedCandidates) {
                // Update Time Bias
                const freshBias = 1.0 + ((Date.now() - startTime) / timeoutMs * 4.0);

                // Smart Backtracking Check: 
                // If we are deep (Depth > 4) and under pressure (Bias > 1.1),
                // we only permit the Primary and Correction candidates. 
                // We prune the "Rest".
                if (targetCount && currentChain.length > 4) {
                    if (freshBias > 1.1) {
                        const isElite = (!!overrideStrategy || cand === primaryCandidate || cand === correctionCandidate);
                        if (!isElite) break;
                    }
                }

                const nextAvailable = [...currentAvailable];
                nextAvailable.splice(cand.index, 1);

                // TRACE LOGGING: Explain Decision
                const isPrimary = (cand === primaryCandidate);
                const isCorrection = (cand === correctionCandidate && cand !== primaryCandidate);

                // Determine Next Strategy (Stickiness)
                let nextStrategy: 'SPEED' | 'STALL' | undefined = overrideStrategy;
                let actionStr = "";

                if (!overrideStrategy && isCorrection && targetCount) {
                    // We are initiating a Correction Strategy. It becomes Sticky.
                    const ahead = progress > (stepsTaken / targetCount);
                    const debugVal = `(Prog ${progress.toFixed(2)} vs Exp ${(stepsTaken / targetCount).toFixed(2)})`;
                    // Set the strategy for the child
                    nextStrategy = ahead ? 'STALL' : 'SPEED';
                    actionStr = ahead ? `(Stalling - Weakest) ${debugVal}` : `(Speeding - Strongest) ${debugVal}`;
                } else if (overrideStrategy) {
                    actionStr = `(Continued ${overrideStrategy})`;
                }

                if (onTrace && (isCorrection || overrideStrategy || Math.random() < 0.05)) {
                    const typeStr = overrideStrategy ? `STICKY ${overrideStrategy}` : (isPrimary ? "Primary" : (isCorrection ? "CORRECTION" : "Rest"));

                    if (isCorrection) {
                        onTrace(`[BACKTRACK] Depth ${currentChain.length}: Primary Strategy Failed. Switching to ${actionStr}. Ded: ${cand.deductions}`);
                    } else if (overrideStrategy) {
                        // Only log occasionally for sticky steps to avoid spam, or finding a solution
                        if (Math.random() < 0.1) {
                            onTrace(`Depth ${currentChain.length}: ${Math.round(progress * 100)}% Solved. Strategy: ${typeStr}. Ded: ${cand.deductions}`);
                        }
                    } else {
                        onTrace(`Depth ${currentChain.length}: ${Math.round(progress * 100)}% Solved. Trying ${typeStr} Cand. Ded: ${cand.deductions}`);
                    }
                }

                const result = search(cand.grid, [...currentChain, { clue: cand.clue, deductions: cand.deductions }], nextAvailable, nextStrategy);
                if (result) return result;
            }

            backtrackCount++;
            return null;
        };

        const result = search(logicGrid, [], [...availableClues]);
        if (result) {
            let puzzle = {
                solution: this.solution,
                clues: result.map(p => p.clue),
                proofChain: result,
                categories,
                targetFact: target,
            };

            return puzzle;
        }

        throw new ConfigurationError(`Could not generate puzzle with exactly ${targetCount} clues within timeout.`);
    }







    private createSolution(
        categories: CategoryConfig[],
        valueMap: Map<ValueLabel, Record<string, ValueLabel>>,
        solution: Solution,
        reverseSolution: Map<string, Map<ValueLabel, ValueLabel>>
    ): void {
        const baseCategory = categories[0];

        baseCategory.values.forEach(val => {
            valueMap.set(val, { [baseCategory.id]: val });
        });

        for (let i = 1; i < categories.length; i++) {
            const currentCategory = categories[i];
            const shuffledValues = [...currentCategory.values].sort(() => this.random() - 0.5);
            let i_shuffled = 0;
            for (const val of baseCategory.values) {
                const record = valueMap.get(val);
                if (record)
                    record[currentCategory.id] = shuffledValues[i_shuffled++];
            }
        }

        for (const cat of categories) {
            solution[cat.id] = {};
            reverseSolution.set(cat.id, new Map());
        }

        for (const baseVal of baseCategory.values) {
            const mappings = valueMap.get(baseVal);
            if (mappings) {
                for (const catId in mappings) {
                    solution[catId][baseVal] = mappings[catId];
                    reverseSolution.get(catId)?.set(mappings[catId], baseVal);
                }
            }
        }
    }

    public generateAllPossibleClues(
        categories: CategoryConfig[],
        constraints: ClueGenerationConstraints | undefined,
        reverseSolution: Map<string, Map<ValueLabel, ValueLabel>>,
        valueMap: Map<ValueLabel, Record<string, ValueLabel>>
    ): Clue[] {
        const clues: Clue[] = [];
        const baseCategory = categories[0];

        // Type Checking Helpers
        const isAllowed = (type: ClueType) => !constraints?.allowedClueTypes || constraints.allowedClueTypes.includes(type);

        // Generate BinaryClues
        if (isAllowed(ClueType.BINARY)) {
            for (const cat1 of categories) {
                for (const val1 of cat1.values) {
                    for (const cat2 of categories) {
                        if (cat1.id >= cat2.id) continue;

                        const baseVal = reverseSolution.get(cat1.id)?.get(val1);
                        if (!baseVal) continue;
                        const mappings = valueMap.get(baseVal);
                        if (!mappings) continue;

                        for (const val2 of cat2.values) {
                            const correctVal2 = mappings[cat2.id];
                            if (val2 === correctVal2) {
                                clues.push({
                                    type: ClueType.BINARY,
                                    operator: BinaryOperator.IS,
                                    cat1: cat1.id,
                                    val1: val1,
                                    cat2: cat2.id,
                                    val2: val2,
                                } as BinaryClue);
                            } else {
                                clues.push({
                                    type: ClueType.BINARY,
                                    operator: BinaryOperator.IS_NOT,
                                    cat1: cat1.id,
                                    val1: val1,
                                    cat2: cat2.id,
                                    val2: val2,
                                } as BinaryClue);
                            }
                        }
                    }
                }
            }
        }


        // Generate Ordinal and SuperlativeClues
        for (const ordCategory of categories.filter(c => c.type === CategoryType.ORDINAL)) {
            const sortedValues = [...ordCategory.values].sort((a, b) => (a as number) - (b as number));
            const minVal = sortedValues[0];
            const maxVal = sortedValues[sortedValues.length - 1];

            // Generate SuperlativeClues for all categories
            if (isAllowed(ClueType.SUPERLATIVE)) {
                for (const targetCat of categories) {
                    if (targetCat.id === ordCategory.id) continue;

                    for (const targetVal of targetCat.values) {
                        const baseVal = reverseSolution.get(targetCat.id)?.get(targetVal);
                        if (!baseVal) continue;
                        const mappings = valueMap.get(baseVal);
                        if (!mappings) continue;

                        const ordVal = mappings[ordCategory.id] as number;

                        if (ordVal === minVal) {
                            clues.push({
                                type: ClueType.SUPERLATIVE,
                                operator: SuperlativeOperator.MIN,
                                targetCat: targetCat.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as SuperlativeClue);
                        } else {
                            // Valid negative clue: "This item is NOT the lowest"
                            clues.push({
                                type: ClueType.SUPERLATIVE,
                                operator: SuperlativeOperator.NOT_MIN,
                                targetCat: targetCat.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as SuperlativeClue);
                        }

                        if (ordVal === maxVal) {
                            clues.push({
                                type: ClueType.SUPERLATIVE,
                                operator: SuperlativeOperator.MAX,
                                targetCat: targetCat.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as SuperlativeClue);
                        } else {
                            clues.push({
                                type: ClueType.SUPERLATIVE,
                                operator: SuperlativeOperator.NOT_MAX,
                                targetCat: targetCat.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as SuperlativeClue);
                        }
                    }
                }
            }


            // Generate OrdinalClues for all pairs of categories
            if (isAllowed(ClueType.ORDINAL)) {
                for (const item1Cat of categories) {
                    if (item1Cat.id === ordCategory.id) continue;
                    for (const item2Cat of categories) {
                        if (item2Cat.id === ordCategory.id) continue;

                        for (const item1Val of item1Cat.values) {
                            for (const item2Val of item2Cat.values) {
                                if (item1Cat.id === item2Cat.id && item1Val === item2Val) continue;

                                const baseVal1 = reverseSolution.get(item1Cat.id)?.get(item1Val);
                                const baseVal2 = reverseSolution.get(item2Cat.id)?.get(item2Val);
                                if (!baseVal1 || !baseVal2) continue;

                                // if they are the same entity, don't compare
                                if (baseVal1 === baseVal2) continue;

                                const mappings1 = valueMap.get(baseVal1);
                                const mappings2 = valueMap.get(baseVal2);
                                if (!mappings1 || !mappings2) continue;

                                const ordVal1 = mappings1[ordCategory.id] as number;
                                const ordVal2 = mappings2[ordCategory.id] as number;

                                if (ordVal1 > ordVal2) {
                                    clues.push({
                                        type: ClueType.ORDINAL,
                                        operator: OrdinalOperator.GREATER_THAN,
                                        item1Cat: item1Cat.id,
                                        item1Val: item1Val,
                                        item2Cat: item2Cat.id,
                                        item2Val: item2Val,
                                        ordinalCat: ordCategory.id,
                                    } as OrdinalClue);
                                    clues.push({
                                        type: ClueType.ORDINAL,
                                        operator: OrdinalOperator.NOT_LESS_THAN, // Not Before
                                        item1Cat: item1Cat.id,
                                        item1Val: item1Val,
                                        item2Cat: item2Cat.id,
                                        item2Val: item2Val,
                                        ordinalCat: ordCategory.id,
                                    } as OrdinalClue);
                                } else if (ordVal1 < ordVal2) {
                                    clues.push({
                                        type: ClueType.ORDINAL,
                                        operator: OrdinalOperator.LESS_THAN,
                                        item1Cat: item1Cat.id,
                                        item1Val: item1Val,
                                        item2Cat: item2Cat.id,
                                        item2Val: item2Val,
                                        ordinalCat: ordCategory.id,
                                    } as OrdinalClue);
                                    clues.push({
                                        type: ClueType.ORDINAL,
                                        operator: OrdinalOperator.NOT_GREATER_THAN, // Not After
                                        item1Cat: item1Cat.id,
                                        item1Val: item1Val,
                                        item2Cat: item2Cat.id,
                                        item2Val: item2Val,
                                        ordinalCat: ordCategory.id,
                                    } as OrdinalClue);
                                }
                            }
                        }
                    }
                }
            }
        }


        // Generate UnaryClues
        if (isAllowed(ClueType.UNARY)) {
            for (const ordCategory of categories) {
                if (ordCategory.type !== CategoryType.ORDINAL) continue;
                // Check if all values are numbers
                if (!ordCategory.values.every(v => typeof v === 'number')) continue;

                for (const targetCategory of categories) {
                    if (targetCategory.id === ordCategory.id) continue;

                    for (const targetVal of targetCategory.values) {
                        const baseVal = reverseSolution.get(targetCategory.id)?.get(targetVal);
                        if (!baseVal) continue;
                        const mappings = valueMap.get(baseVal);
                        if (!mappings) continue;

                        const ordValue = mappings[ordCategory.id] as number;

                        if (ordValue % 2 === 0) {
                            clues.push({
                                type: ClueType.UNARY,
                                filter: UnaryFilter.IS_EVEN,
                                targetCat: targetCategory.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as UnaryClue);
                        } else {
                            clues.push({
                                type: ClueType.UNARY,
                                filter: UnaryFilter.IS_ODD,
                                targetCat: targetCategory.id,
                                targetVal: targetVal,
                                ordinalCat: ordCategory.id,
                            } as UnaryClue);
                        }
                    }
                }
            }
        }

        return clues;
    }

    /**
     * Calculates the heuristic score for a candidate clue.
     * Higher scores represent better clues according to the current strategy.
     */
    public calculateClueScore(
        grid: LogicGrid,
        target: TargetFact,
        deductions: number,
        clue: Clue,
        previouslySelectedClues: Clue[],
        solution: Solution,
        reverseSolution: Map<string, Map<ValueLabel, ValueLabel>>
    ): number {
        const clueType = clue.type;

        // Resolve Correct Target Value
        // If Target is Cat1 -> Cat2
        // We need to know what Val1 (in Cat1) maps to in Cat2.
        // Solution is { CatID -> { BaseVal -> ValInCat } }.
        // We first need the BaseVal for Val1.
        const baseVal = reverseSolution.get(target.category1Id)?.get(target.value1);
        let targetValue: ValueLabel | undefined;

        if (baseVal !== undefined) {
            targetValue = solution[target.category2Id][baseVal];
        }

        const isTargetSolved =
            targetValue !== undefined &&
            grid.isPossible(target.category1Id, target.value1, target.category2Id, targetValue) &&
            grid.getPossibilitiesCount(target.category1Id, target.value1, target.category2Id) === 1;

        const puzzleSolved = this.isPuzzleSolved(grid, solution, reverseSolution);

        // BAN DIRECT TARGET CLUES
        // If the clue is literally "Subject IS Answer", it's too easy/boring.
        // We want the target to be deduced, not stated.
        if (clue.type === ClueType.BINARY && (clue as BinaryClue).operator === BinaryOperator.IS) {
            const bc = clue as BinaryClue;
            // Check Forward
            if (bc.cat1 === target.category1Id && bc.val1 === target.value1 &&
                bc.cat2 === target.category2Id && bc.val2 === targetValue) {
                return -Infinity;
            }
            // Check Reverse (if target was defined backwards)
            if (bc.cat1 === target.category2Id && bc.val1 === targetValue &&
                bc.cat2 === target.category1Id && bc.val2 === target.value1) {
                return -Infinity;
            }
        }

        if (isTargetSolved && puzzleSolved) {
            return 1000000; // This is the winning clue
        }

        if (isTargetSolved && !puzzleSolved) {
            return -1000000; // This clue solves the target too early
        }


        const synergyScore = deductions;
        const { totalPossible, currentPossible, solutionPossible } = grid.getGridStats();
        const totalEliminatable = totalPossible - solutionPossible;
        const eliminatedSoFar = totalPossible - currentPossible;
        const completenessScore = totalEliminatable > 0 ? (eliminatedSoFar / totalEliminatable) : 0;

        let complexityBonus = 0;
        switch (clueType) {
            case ClueType.ORDINAL:
                complexityBonus = 1.5;
                if ((clue as OrdinalClue).operator >= 2) complexityBonus = 5.0; // Boost Negative Ordinals
                break;
            case ClueType.SUPERLATIVE:
                complexityBonus = 1.2;
                if ((clue as SuperlativeClue).operator >= 2) complexityBonus = 5.0; // Boost Negative Superlatives
                break;
            case ClueType.UNARY: complexityBonus = 1.2; break;
            case ClueType.BINARY:
                complexityBonus = 1.0;
                // Boost IS_NOT to encourage variety, as they are weaker deduction-wise
                if ((clue as BinaryClue).operator === BinaryOperator.IS_NOT) {
                    complexityBonus = 5.0;
                }
                break;
        }

        // --- Combined Three-Part Penalty Logic ---
        let repetitionScore = 0;

        // 1. Subject Penalty
        const getEntities = (c: Clue): { primary: ValueLabel[], secondary: ValueLabel[] } => {
            const safeGet = (cat: string, val: ValueLabel) => this.reverseSolution.get(cat)?.get(val);
            let primary: (ValueLabel | undefined)[] = [];
            let secondary: (ValueLabel | undefined)[] = [];

            switch (c.type) {
                case ClueType.BINARY:
                    const b = c as BinaryClue;
                    primary.push(safeGet(b.cat1, b.val1));
                    if (b.operator === BinaryOperator.IS_NOT) {
                        secondary.push(safeGet(b.cat2, b.val2));
                    }
                    break;
                case ClueType.SUPERLATIVE:
                    const s = c as SuperlativeClue;
                    primary.push(safeGet(s.targetCat, s.targetVal));
                    break;
                case ClueType.ORDINAL:
                    const o = c as OrdinalClue;
                    primary.push(safeGet(o.item1Cat, o.item1Val));
                    secondary.push(safeGet(o.item2Cat, o.item2Val));
                    break;
                case ClueType.UNARY:
                    const u = c as UnaryClue;
                    primary.push(safeGet(u.targetCat, u.targetVal));
                    break;
            }
            return {
                primary: primary.filter((e): e is ValueLabel => !!e),
                secondary: secondary.filter((e): e is ValueLabel => !!e)
            };
        };

        const mentionedEntities = new Set<ValueLabel>();
        for (const pClue of previouslySelectedClues) {
            const { primary, secondary } = getEntities(pClue);
            primary.forEach(e => mentionedEntities.add(e));
            secondary.forEach(e => mentionedEntities.add(e));
        }

        const { primary: currentPrimary, secondary: currentSecondary } = getEntities(clue);
        currentPrimary.forEach(e => {
            if (mentionedEntities.has(e)) {
                repetitionScore += 1.0; // Full penalty for primary subject
            }
        });
        currentSecondary.forEach(e => {
            if (mentionedEntities.has(e)) {
                repetitionScore += 0.5; // Half penalty for secondary subject
            }
        });

        // 2. Dimension (Ordinal Category) Penalty
        const currentOrdinalCat = (clue as any).ordinalCat;
        if (currentOrdinalCat) {
            for (const pClue of previouslySelectedClues) {
                const prevOrdinalCat = (pClue as any).ordinalCat;
                if (currentOrdinalCat === prevOrdinalCat) {
                    repetitionScore += 0.5; // Penalize reuse of 'Age'
                }
            }
        }

        // 3. Structure (Clue Type) Penalty
        if (previouslySelectedClues.length > 0) {
            const lastClue = previouslySelectedClues[previouslySelectedClues.length - 1];

            // Immediate Repetition Penalty
            if (clue.type === lastClue.type) {
                repetitionScore += 2.0; // Strong penalty for same type

                // Double "IS" Penalty - Binary IS clues are very powerful but boring if repeated
                if (clue.type === ClueType.BINARY &&
                    (clue as BinaryClue).operator === BinaryOperator.IS &&
                    (lastClue as BinaryClue).operator === BinaryOperator.IS) {
                    repetitionScore += 2.0;
                }
            }

            // Streak Penalty (3 in a row)
            if (previouslySelectedClues.length > 1) {
                const secondLastClue = previouslySelectedClues[previouslySelectedClues.length - 2];
                if (clue.type === lastClue.type && clue.type === secondLastClue.type) {
                    repetitionScore += 5.0; // Massive penalty for 3-streak
                }
            }

            // 4. Complexity Variance Penalty (New)
            const getComplexity = (c: Clue): number => {
                switch (c.type) {
                    case ClueType.SUPERLATIVE: return 1; // "Highest" is very direct
                    case ClueType.BINARY:
                        // User feedback: Binary IS is equivalent to Superlative (Direct Tick)
                        return (c as BinaryClue).operator === BinaryOperator.IS ? 1 : 3;
                    case ClueType.ORDINAL: return 3;
                    case ClueType.UNARY: return 3;
                    case ClueType.CROSS_ORDINAL: return 4; // Hardest
                    default: return 2;
                }
            };

            const currentComplexity = getComplexity(clue);
            const lastComplexity = getComplexity(lastClue);

            if (currentComplexity === lastComplexity) {
                repetitionScore += 1.5; // Penalize same difficulty level back-to-back
            }

            // Penalize monotonically increasing/decreasing too fast?
            // No, just variety is good.
        }

        const repetitionPenalty = Math.pow(0.4, repetitionScore);

        const score = ((synergyScore * complexityBonus) + (completenessScore * 5)) * repetitionPenalty;
        return score;
    }

    public isPuzzleSolved(
        grid: LogicGrid,
        solution: Solution,
        reverseSolution: Map<string, Map<ValueLabel, ValueLabel>>
    ): boolean {
        const categories = (grid as any).categories as CategoryConfig[];
        const baseCategory = categories[0];
        for (const cat1 of categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of categories) {
                    if (cat1.id >= cat2.id) continue;

                    const baseVal = reverseSolution.get(cat1.id)?.get(val1);
                    if (!baseVal) return false; // Should not happen
                    const correctVal2 = solution[cat2.id][baseVal];

                    if (grid.getPossibilitiesCount(cat1.id, val1, cat2.id) > 1) {
                        return false;
                    }
                    if (!grid.isPossible(cat1.id, val1, cat2.id, correctVal2)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
}
