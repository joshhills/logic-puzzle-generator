
import { CategoryConfig, ClueGenerationConstraints, Solution, TargetFact, ValueLabel, ClueType, BinaryOperator } from '../types';
import { Clue } from './Clue';
import { LogicGrid } from './LogicGrid';
import { Solver } from './Solver';
import type { Generator } from './Generator';


export class GenerativeSession {
    private grid: LogicGrid;
    private availableClues: Clue[] = [];
    private proofChain: Clue[] = [];
    private solver: Solver;


    private historyStack: LogicGrid[] = [];

    constructor(
        private generator: Generator,
        private categories: CategoryConfig[],
        private solution: Solution,
        private reverseSolution: Map<string, Map<ValueLabel, ValueLabel>>,
        private valueMap: Map<ValueLabel, Record<string, ValueLabel>>,
        public targetFact: TargetFact
    ) {
        this.grid = new LogicGrid(categories);
        this.solver = new Solver();

        // Initial Generation of ALL possibilities (we filter later)
        // We need access to the generator's clue generation logic.
        // We will call a public method on generator.
        this.availableClues = this.generator.generateAllPossibleClues(categories, undefined, reverseSolution, valueMap);
    }

    public getTotalClueCount(): number {
        return this.availableClues.length;
    }

    public getMatchingClueCount(constraints?: ClueGenerationConstraints): number {
        return this.filterClues(constraints).length;
    }

    public getMatchingClues(constraints?: ClueGenerationConstraints, limit: number = 50): Clue[] {
        const clues = this.filterClues(constraints);
        return clues.slice(0, limit);
    }

    public getScoredMatchingClues(constraints?: ClueGenerationConstraints, limit: number = 50): { clue: Clue, score: number, deductions: number, isDirectAnswer: boolean }[] {
        const clues = this.filterClues(constraints);

        // Score all (or up to a reasonable hard limit to avoid perf issues, say 200)
        // Then sort and take top 'limit'
        const candidateLimit = 200;
        const candidates = clues.slice(0, candidateLimit);

        const scored = candidates.map(clue => {
            // Score Logic - similar to getNextClue but without the constraints checks (already done)
            const tempGrid = this.grid.clone();
            const { deductions } = this.solver.applyClue(tempGrid, clue);

            // Calculate real score
            const score = this.generator.calculateClueScore(this.grid, this.targetFact, deductions, clue, this.proofChain, this.solution, this.reverseSolution);

            // Check if this is the "Direct Answer" (Positive link for the target fact)
            let isDirectAnswer = false;
            if (clue.type === ClueType.BINARY) {
                // Check if it links the target subject to the target category
                // Positive operators: IS (0). Assuming enum values.
                const isPositive = clue.operator === BinaryOperator.IS;
                if (isPositive) {
                    const c = clue;
                    const matchForward = c.cat1 === this.targetFact.category1Id && c.val1 === this.targetFact.value1 && c.cat2 === this.targetFact.category2Id;
                    const matchReverse = c.cat2 === this.targetFact.category1Id && c.val2 === this.targetFact.value1 && c.cat1 === this.targetFact.category2Id;
                    if (matchForward || matchReverse) {
                        isDirectAnswer = true;
                    }
                }
            }

            return { clue, score, deductions, isDirectAnswer };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, limit);
    }

    public useClue(clue: Clue): { remaining: number, solved: boolean } {
        // Ensure the clue is removed from available if it was there
        // (If searching, the UI passes a Clue object that should exist in our availableClues)
        this.applyAndSave(clue);
        return { remaining: this.availableClues.length, solved: this.generator.isPuzzleSolved(this.grid, this.solution, this.reverseSolution) };
    }

    private filterClues(constraints?: ClueGenerationConstraints): Clue[] {
        return this.availableClues.filter(clue => {
            // 2. Constraints
            if (constraints?.allowedClueTypes && !constraints.allowedClueTypes.includes(clue.type)) return false;

            // Validation: Check for intersection
            if (constraints?.includeSubjects && constraints?.excludeSubjects) {
                const intersection = constraints.includeSubjects.filter(s => constraints.excludeSubjects!.includes(s));
                if (intersection.length > 0) {
                    throw new Error(`Constraint Error: The following subjects are both included and excluded: ${intersection.join(', ')}`);
                }
            }

            // Subject Constraints
            if (constraints?.includeSubjects || constraints?.excludeSubjects) {
                const valuesInClue = this.extractValuesFromClue(clue);

                if (constraints.includeSubjects) {
                    const hasMatch = constraints.includeSubjects.some(s => valuesInClue.includes(s));
                    if (!hasMatch) return false;
                }

                if (constraints.excludeSubjects) {
                    const hasMatch = constraints.excludeSubjects.some(s => valuesInClue.includes(s));
                    if (hasMatch) return false;
                }
            }

            return true;
        });
    }

    private applyAndSave(clue: Clue) {
        // Save state
        this.historyStack.push(this.grid.clone());

        // Apply it
        this.solver.applyClue(this.grid, clue);
        this.proofChain.push(clue);

        // Remove from available
        const idx = this.availableClues.indexOf(clue);
        if (idx > -1) this.availableClues.splice(idx, 1);
    }

    public getNextClue(constraints?: ClueGenerationConstraints): { clue: Clue | null, remaining: number, solved: boolean } {
        const validClues = this.filterClues(constraints);

        // Score them
        let bestClue: Clue | null = null;
        let bestScore = -Infinity;

        // Shuffle validClues first to ensure variety.
        const candidates = [...validClues].sort(() => Math.random() - 0.5);

        // Take top N candidates?
        const searchLimit = 50;
        let checked = 0;

        const minDeductions = constraints?.minDeductions ?? 0;

        for (const clue of candidates) {
            checked++;
            if (checked > searchLimit && bestClue) break; // found something good enough?

            // Score Logic
            // We must clone grid and apply to see deductions.
            const tempGrid = this.grid.clone();
            const { deductions } = this.solver.applyClue(tempGrid, clue);

            // Check Deduction Floor
            if (deductions < minDeductions) {
                continue;
            }

            // Re-calc score with deductions
            const realScore = this.generator.calculateClueScore(this.grid, this.targetFact, deductions, clue, this.proofChain, this.solution, this.reverseSolution);

            if (realScore > bestScore) {
                bestScore = realScore;
                bestClue = clue;
            }
        }

        if (bestClue) {
            this.applyAndSave(bestClue);
            return { clue: bestClue, remaining: this.availableClues.length, solved: this.generator.isPuzzleSolved(this.grid, this.solution, this.reverseSolution) };
        }

        return { clue: null, remaining: validClues.length, solved: this.generator.isPuzzleSolved(this.grid, this.solution, this.reverseSolution) };
    }

    /**
     * Asynchronously gets the next clue (non-blocking wrapper).
     * @param constraints
     */
    public async getNextClueAsync(constraints?: ClueGenerationConstraints): Promise<{ clue: Clue | null, remaining: number, solved: boolean }> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const result = this.getNextClue(constraints);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            }, 0);
        });
    }

    public rollbackLastClue(): { success: boolean, clue: Clue | null } {
        if (this.historyStack.length === 0) return { success: false, clue: null };

        const prevGrid = this.historyStack.pop();
        if (prevGrid) this.grid = prevGrid;

        const lastClue = this.proofChain.pop();
        if (lastClue) {
            this.availableClues.push(lastClue);
            return { success: true, clue: lastClue };
        }

        return { success: false, clue: null };
    }

    private isUseful(grid: LogicGrid): boolean {
        // Did it eliminate anything? 
        // LogicGrid could report this.
        // We compare clone vs original?
        // Actually Solver returns deductions count.
        // If deductions > 0, it's useful.
        return true;
    }

    // Getters for UI
    public getGrid(): LogicGrid { return this.grid; }
    public getProofChain(): Clue[] { return this.proofChain; }
    public getSolution(): Solution { return this.solution; }
    public getValueMap(): Map<ValueLabel, Record<string, ValueLabel>> { return this.valueMap; }

    private extractValuesFromClue(clue: Clue): string[] {
        const values: string[] = [];
        // Extract based on type (simpler than full traversal)
        // We cast values to string for easy comparison
        const add = (v: ValueLabel | undefined) => { if (v !== undefined) values.push(String(v)); };

        // Common fields
        // @ts-ignore
        add(clue.val1);
        // @ts-ignore
        add(clue.val2);
        // @ts-ignore
        add(clue.item1Val);
        // @ts-ignore
        add(clue.item2Val);
        // @ts-ignore
        add(clue.targetVal);

        return values;
    }
}
