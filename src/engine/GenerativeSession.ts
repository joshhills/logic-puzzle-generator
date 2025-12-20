
import { CategoryConfig, ClueGenerationConstraints, Solution, TargetFact, ValueLabel } from '../types';
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

    public getNextClue(constraints?: ClueGenerationConstraints): { clue: Clue | null, remaining: number, solved: boolean } {
        // Filter available clues based on constraints & current relevance
        // Use the same heuristic logic as Generator?

        const validClues = this.availableClues.filter(clue => {
            // 1. Must not define something already known (Solver.applyClue check basically)
            // Actually, redundancy check happens in scoring.

            // 2. Constraints
            if (constraints?.allowedClueTypes && !constraints.allowedClueTypes.includes(clue.type)) return false;

            return true;
        });

        // Score them
        let bestClue: Clue | null = null;
        let bestScore = -Infinity;

        // We should shuffle validClues to limit search space or just search all?
        // For interactive session, speed is less critical than quality, but we want variety.
        // Shuffle validClues first.
        // In-place shuffle copy
        const candidates = [...validClues].sort(() => Math.random() - 0.5);

        // Take top N candidates?
        const searchLimit = 50;
        let checked = 0;

        for (const clue of candidates) {
            checked++;
            if (checked > searchLimit && bestClue) break; // found something good enough?

            const score = this.generator.publicCalculateScore(
                this.grid, this.targetFact, 0, clue, this.proofChain,
                this.solution, this.reverseSolution
                // Note: we need to actually apply it to get deductions count for scoring to work well
            );

            // Wait, publicCalculateScore needs `deductions`.
            // So we must clone grid and apply.
            const tempGrid = this.grid.clone();
            const { deductions } = this.solver.applyClue(tempGrid, clue);

            if (deductions === 0 && !this.isUseful(tempGrid)) {
                // Useless clue
                continue;
            }

            // Re-calc score with deductions
            const realScore = this.generator.publicCalculateScore(this.grid, this.targetFact, deductions, clue, this.proofChain, this.solution, this.reverseSolution);

            if (realScore > bestScore) {
                bestScore = realScore;
                bestClue = clue;
            }
        }

        if (bestClue) {
            // Save state
            this.historyStack.push(this.grid.clone());

            // Apply it
            this.solver.applyClue(this.grid, bestClue);
            this.proofChain.push(bestClue);

            // Remove from available
            const idx = this.availableClues.indexOf(bestClue);
            if (idx > -1) this.availableClues.splice(idx, 1);

            return { clue: bestClue, remaining: this.availableClues.length, solved: this.generator.isPuzzleSolved(this.grid, this.solution, this.reverseSolution) };
        }

        return { clue: null, remaining: validClues.length, solved: this.generator.isPuzzleSolved(this.grid, this.solution, this.reverseSolution) };
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
}
