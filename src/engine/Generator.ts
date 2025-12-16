import { CategoryConfig, CategoryType, ValueLabel, Solution, TargetFact } from '../types';
import { ConfigurationError } from '../errors';
import { Clue, ClueType, BinaryClue, BinaryOperator, OrdinalClue, OrdinalOperator, SuperlativeClue, SuperlativeOperator, UnaryClue, UnaryFilter } from './Clue';
import { LogicGrid } from './LogicGrid';
import { Solver } from './Solver';

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
     * 
     * @param categories - The categories and values to include in the puzzle.
     * @param target - The specific fact that should be the final deduction of the puzzle.
     * @param options - Optional configuration for the generation process.
     * @returns A complete Puzzle object containing the solution, clues, and proof chain.
     */
    public generatePuzzle(categories: CategoryConfig[], target: TargetFact, options?: GeneratorOptions): Puzzle {
        if (!categories || categories.length < 2) {
            throw new ConfigurationError('At least 2 categories are required to generate a puzzle.');
        }

        const maxCandidates = options?.maxCandidates ?? Infinity;

        // Validate target fact
        const catIds = new Set(categories.map(c => c.id));
        if (!catIds.has(target.category1Id) || !catIds.has(target.category2Id)) {
            throw new ConfigurationError('Target fact refers to non-existent categories.');
        }
        if (target.category1Id === target.category2Id) {
            throw new ConfigurationError('Target fact must refer to two different categories.');
        }

        // Ensure values exist
        const cat1 = categories.find(c => c.id === target.category1Id);
        if (cat1 && !cat1.values.includes(target.value1)) {
            throw new ConfigurationError(`Target value '${target.value1}' does not exist in category '${target.category1Id}'.`);
        }

        this.createSolution(categories);
        let availableClues = this.generateAllPossibleClues(categories);
        const logicGrid = new LogicGrid(categories);

        const proofChain: ProofStep[] = [];

        while (proofChain.length < 100) { // Safety break
            let bestCandidate: { clue: Clue, score: number } | null = null;
            let finalCandidate: { clue: Clue, score: number } | null = null;

            // Shuffle available clues if we are sampling
            if (maxCandidates < availableClues.length) {
                for (let i = availableClues.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [availableClues[i], availableClues[j]] = [availableClues[j], availableClues[i]];
                }
            }

            const candidatesToCheck = Math.min(availableClues.length, maxCandidates);

            let checkedCount = 0;

            for (let i = availableClues.length - 1; i >= 0; i--) {
                if (checkedCount >= candidatesToCheck) {
                    break;
                }

                const clue = availableClues[i];
                const tempGrid = logicGrid.clone();
                const { deductions } = this.solver.applyClue(tempGrid, clue);

                if (deductions === 0) {
                    availableClues.splice(i, 1); // Permanently remove redundant clue
                    continue;
                }

                checkedCount++;

                const score = this.calculateScore(tempGrid, target, deductions, clue, proofChain.map(p => p.clue));

                if (score > -1000000) { // Not a premature solve
                    if (!bestCandidate || score > bestCandidate.score) {
                        bestCandidate = { clue, score };
                    }
                } else {
                    finalCandidate = { clue, score }; // It solves the target, keep as a final option
                }
            }

            const chosenCandidate = bestCandidate || finalCandidate;

            if (!chosenCandidate) {
                // No more useful clues found
                break;
            }

            const chosenClue = chosenCandidate.clue;
            const { deductions } = this.solver.applyClue(logicGrid, chosenClue);
            proofChain.push({ clue: chosenClue, deductions });

            // Remove the chosen clue from the available list
            const chosenIndex = availableClues.findIndex(c => JSON.stringify(c) === JSON.stringify(chosenClue));
            if (chosenIndex > -1) {
                availableClues.splice(chosenIndex, 1);
            }

            if (this.isPuzzleSolved(logicGrid)) {
                break;
            }
        }

        return {
            solution: this.solution,
            clues: proofChain.map(p => p.clue),
            proofChain,
            categories,
            targetFact: target,
        };
    }

    private createSolution(categories: CategoryConfig[]): void {
        const baseCategory = categories[0];

        baseCategory.values.forEach(val => {
            this.valueMap.set(val, { [baseCategory.id]: val });
        });

        for (let i = 1; i < categories.length; i++) {
            const currentCategory = categories[i];
            const shuffledValues = [...currentCategory.values].sort(() => this.random() - 0.5);
            let i_shuffled = 0;
            for (const val of baseCategory.values) {
                const record = this.valueMap.get(val);
                if (record)
                    record[currentCategory.id] = shuffledValues[i_shuffled++];
            }
        }

        for (const cat of categories) {
            this.solution[cat.id] = {};
            this.reverseSolution.set(cat.id, new Map());
        }

        for (const baseVal of baseCategory.values) {
            const mappings = this.valueMap.get(baseVal);
            if (mappings) {
                for (const catId in mappings) {
                    this.solution[catId][baseVal] = mappings[catId];
                    this.reverseSolution.get(catId)?.set(mappings[catId], baseVal);
                }
            }
        }
    }

    private generateAllPossibleClues(categories: CategoryConfig[]): Clue[] {
        const clues: Clue[] = [];
        const baseCategory = categories[0];

        // Generate BinaryClues
        for (const cat1 of categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of categories) {
                    if (cat1.id >= cat2.id) continue;

                    const baseVal = this.reverseSolution.get(cat1.id)?.get(val1);
                    if (!baseVal) continue;
                    const mappings = this.valueMap.get(baseVal);
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

        // Generate Ordinal and SuperlativeClues
        for (const ordCategory of categories.filter(c => c.type === CategoryType.ORDINAL)) {
            const sortedValues = [...ordCategory.values].sort((a, b) => (a as number) - (b as number));
            const minVal = sortedValues[0];
            const maxVal = sortedValues[sortedValues.length - 1];

            // Generate SuperlativeClues for all categories
            for (const targetCat of categories) {
                if (targetCat.id === ordCategory.id) continue;

                const baseValForMin = this.reverseSolution.get(ordCategory.id)!.get(minVal)!;
                const itemValForMin = this.valueMap.get(baseValForMin)![targetCat.id];
                clues.push({
                    type: ClueType.SUPERLATIVE,
                    operator: SuperlativeOperator.MIN,
                    targetCat: targetCat.id,
                    targetVal: itemValForMin,
                    ordinalCat: ordCategory.id,
                } as SuperlativeClue);

                const baseValForMax = this.reverseSolution.get(ordCategory.id)!.get(maxVal)!;
                const itemValForMax = this.valueMap.get(baseValForMax)![targetCat.id];
                clues.push({
                    type: ClueType.SUPERLATIVE,
                    operator: SuperlativeOperator.MAX,
                    targetCat: targetCat.id,
                    targetVal: itemValForMax,
                    ordinalCat: ordCategory.id,
                } as SuperlativeClue);
            }

            // Generate OrdinalClues for all pairs of categories
            for (const item1Cat of categories) {
                if (item1Cat.id === ordCategory.id) continue;
                for (const item2Cat of categories) {
                    if (item2Cat.id === ordCategory.id) continue;

                    for (const item1Val of item1Cat.values) {
                        for (const item2Val of item2Cat.values) {
                            if (item1Cat.id === item2Cat.id && item1Val === item2Val) continue;

                            const baseVal1 = this.reverseSolution.get(item1Cat.id)?.get(item1Val);
                            const baseVal2 = this.reverseSolution.get(item2Cat.id)?.get(item2Val);
                            if (!baseVal1 || !baseVal2) continue;

                            // if they are the same entity, don't compare
                            if (baseVal1 === baseVal2) continue;

                            const mappings1 = this.valueMap.get(baseVal1);
                            const mappings2 = this.valueMap.get(baseVal2);
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
                            }
                        }
                    }
                }
            }
        }

        // Generate UnaryClues
        for (const ordCategory of categories) {
            if (ordCategory.type !== CategoryType.ORDINAL) continue;
            // Check if all values are numbers
            if (!ordCategory.values.every(v => typeof v === 'number')) continue;

            for (const targetCategory of categories) {
                if (targetCategory.id === ordCategory.id) continue;

                for (const targetVal of targetCategory.values) {
                    const baseVal = this.reverseSolution.get(targetCategory.id)?.get(targetVal);
                    if (!baseVal) continue;
                    const mappings = this.valueMap.get(baseVal);
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

        return clues;
    }

    private calculateScore(grid: LogicGrid, target: TargetFact, deductions: number, clue: Clue, previouslySelectedClues: Clue[]): number {
        const clueType = clue.type;
        const targetValue = this.solution[target.category2Id][target.value1];
        const isTargetSolved = grid.isPossible(target.category1Id, target.value1, target.category2Id, targetValue) &&
            grid.getPossibilitiesCount(target.category1Id, target.value1, target.category2Id) === 1;

        const puzzleSolved = this.isPuzzleSolved(grid);

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
            case ClueType.ORDINAL: complexityBonus = 1.5; break;
            case ClueType.SUPERLATIVE: complexityBonus = 1.2; break;
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
        }

        const repetitionPenalty = Math.pow(0.4, repetitionScore);

        const score = ((synergyScore * complexityBonus) + (completenessScore * 5)) * repetitionPenalty;
        return score;
    }

    private isPuzzleSolved(grid: LogicGrid): boolean {
        const categories = (grid as any).categories as CategoryConfig[];
        const baseCategory = categories[0];
        for (const cat1 of categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of categories) {
                    if (cat1.id >= cat2.id) continue;

                    const baseVal = this.reverseSolution.get(cat1.id)?.get(val1);
                    if (!baseVal) return false; // Should not happen
                    const correctVal2 = this.solution[cat2.id][baseVal];

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
