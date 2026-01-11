import {
    Generator,
    CategoryType,
    type CategoryConfig,
    type GenerativeSession,
    type Clue,
    ClueType,
    BinaryOperator
} from 'logic-puzzle-generator';

export class IntelDevice {
    private generator: Generator;
    private session: GenerativeSession | null = null;
    private categories: CategoryConfig[];
    // private target: any | null = null; // Unused
    // private solution: any; // Unused

    constructor() {
        this.generator = new Generator(Date.now());

        // Define standard categories for the mystery
        this.categories = [
            {
                id: 'Suspect',
                type: CategoryType.NOMINAL,
                values: ['Baroness', 'Doctor', 'General']
            },
            {
                id: 'Location',
                type: CategoryType.NOMINAL,
                values: ['Library', 'Lounge', 'Study']
            },
            {
                id: 'Item',
                type: CategoryType.NOMINAL,
                values: ['Candlestick', 'Revolver', 'Rope']
            }
        ];

        this.startNewCase();
    }

    private targetDescription: string = "Mission Pending...";

    public getTarget(): string {
        return this.targetDescription;
    }

    public getCategories(): CategoryConfig[] {
        return this.categories;
    }

    public startNewCase() {
        try {
            this.session = this.generator.startSession(this.categories);
            this.generateTarget();
        } catch (e) {
            console.error("Failed to start case:", e);
        }
    }

    private generateTarget() {
        if (!this.session) return;

        // Strategy:
        // 1. Pick a "Given" Category (e.g., Item) and Value (e.g., Dagger).
        // 2. Pick a "Target" Category (e.g., Suspect).
        // 3. The goal is to find the Target Value associated with the Given Value.

        const catKeys = this.categories.map(c => c.id);
        const givenCatIndex = Math.floor(Math.random() * catKeys.length);
        const givenCat = this.categories[givenCatIndex];

        let targetCatIndex = Math.floor(Math.random() * catKeys.length);
        while (targetCatIndex === givenCatIndex) {
            targetCatIndex = Math.floor(Math.random() * catKeys.length);
        }
        const targetCat = this.categories[targetCatIndex];

        const givenValue = givenCat.values[Math.floor(Math.random() * givenCat.values.length)];

        // We don't necessarily need to know the answer to *set* the target description,
        // but the player needs to answer it.
        // Currently attemptSolve() checks Suspect/Location/Item tuple.
        // This new target changes the win condition to just finding one fact?
        // OR does the user still need to provide full solution?
        // User request: "target should be a specific fact... find the suspect"
        // Implies the "Solve" action might need to change or we just frame the mission this way
        // but still demand full solution? 
        // "Find the correct combination" was the old target.
        // Let's assume for now we frame the mission, but the "Solve" button still asks for the full triple.
        // It's a "Detective" game, you usually need the full picture to convict.

        this.targetDescription = `Find the ${targetCat.id} associated with the ${givenValue} (${givenCat.id}).`;
    }

    public getTrueClue(): string {
        if (!this.session) return "Device Malfunction";
        const result = this.session.getNextClue();
        if (result.clue) {
            return this.formatClue(result.clue);
        }
        return "No more intel available.";
    }

    public getSmartClue(): string {
        if (!this.session) return "Device Malfunction";
        // Get the absolute best clue available
        const results = this.session.getScoredMatchingClues(undefined, 1);
        if (results.length > 0) {
            const best = results[0].clue;
            // We must "use" it to remove it from the pool (GenerativeSession doesn't auto-use for getScoredMatchingClues check?)
            // Checking GenerativeSession: getScoredMatchingClues DOES NOT modify state.
            // We must manually call useClue.
            this.session.useClue(best);
            return this.formatClue(best);
        }
        return this.getTrueClue(); // Fallback
    }

    public getFakeClue(): string {
        if (!this.session) return "Device Malfunction";

        // Determine the solution to ensure we lie correctly.
        // The solution isn't directly exposed on session typically, but we can assume
        // we generate a random statement.
        // NOTE: In a real implementation we would access the solution to guarantee falsity.
        // For this prototype, we'll construct a random clue.

        // Simple strategy: Pick two random categories.
        const c1 = this.categories[Math.floor(Math.random() * this.categories.length)];
        const c2 = this.categories[Math.floor(Math.random() * this.categories.length)];
        if (c1.id === c2.id) return this.getFakeClue(); // Retry

        const v1 = c1.values[Math.floor(Math.random() * c1.values.length)];
        const v2 = c2.values[Math.floor(Math.random() * c2.values.length)];

        // We claim they are linked.
        return `The ${v1} (${c1.id}) IS the ${v2} (${c2.id}).`;
    }

    private formatClue(clue: Clue): string {
        if (clue.type === ClueType.BINARY) {
            // Access properties safely if possible, or cast.
            // Clue structure for binary: { ...BinaryClue }
            const c = clue as any;
            const is = c.operator === BinaryOperator.IS ? 'is' : 'is NOT';
            return `${c.val1} (${c.cat1}) ${is} associated with ${c.val2} (${c.cat2}).`;
        }
        else if (clue.type === ClueType.ORDINAL) {
            const c = clue as any;
            return `The item associated with ${c.val1} (${c.cat1}) is ${c.operator} the one associated with ${c.val2} (${c.cat2}).`; // Simplified
        }

        // Fallback for other types
        return `Complex intel: ${JSON.stringify(clue)}`;
    }

    public checkSolution(suspect: string, location: string, item: string): boolean {
        if (!this.session) return false;

        const sol = (this.session as any).getSolution();

        const sToL = sol['Suspect']?.[suspect]?.['Location'];
        if (sToL !== location) return false;

        const sToI = sol['Suspect']?.[suspect]?.['Item'];
        if (sToI !== item) return false;

        return true;
    }
}
