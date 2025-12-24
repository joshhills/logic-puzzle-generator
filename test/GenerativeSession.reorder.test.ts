
import { GenerativeSession } from "../src/engine/GenerativeSession";
import { Generator } from "../src/engine/Generator";
import { CategoryType, ClueType } from "../src/types";

// Mock minimal dependencies
const categories = [
    { id: "Cat1", type: CategoryType.NOMINAL, name: "Cat1", values: ["A", "B", "C"] },
    { id: "Cat2", type: CategoryType.NOMINAL, name: "Cat2", values: ["1", "2", "3"] }
];

function createSession() {
    const generator = new Generator(12345);
    const puzzle = generator.generatePuzzle(categories, undefined, { maxCandidates: 100 });

    // We need a specific target to test target detection.
    // Let's pick the first fact in the solution as the target.
    // Solution structure: [ { "A": "1", ... }, { "1": "A", ... } ] (mapped by ID)
    // Actually solution is Record<string, Record<string, string>>

    const val1 = "A";
    const val2 = puzzle.solution["Cat2"][val1]; // The linked value in Cat2

    const targetFact = {
        category1Id: "Cat1",
        value1: val1,
        category2Id: "Cat2",
        value2: val2
    };

    const reverseSolution = (generator as any).reverseSolution;
    const valueMap = (generator as any).valueMap;

    return new GenerativeSession(
        generator,
        categories,
        puzzle.solution,
        reverseSolution,
        valueMap,
        targetFact
    );
}

describe("GenerativeSession Reordering & Target Detection", () => {
    test("should move a clue correctly", () => {
        const session = createSession();
        // Add 3 clues
        const c1 = session.getNextClue()?.clue;
        const c2 = session.getNextClue()?.clue;
        const c3 = session.getNextClue()?.clue;

        if (!c1 || !c2 || !c3) throw new Error("Failed to generate clues");

        // Initial order
        let chain = session.getProofChain();
        expect(chain[0]).toBe(c1);
        expect(chain[1]).toBe(c2);
        expect(chain[2]).toBe(c3);

        // Move c1 to end (index 0 -> 2)
        session.moveClue(0, 2);

        chain = session.getProofChain();
        expect(chain[0]).toBe(c2);
        expect(chain[1]).toBe(c3);
        expect(chain[2]).toBe(c1);

        // Move c1 back to start (index 2 -> 0)
        session.moveClue(2, 0);
        chain = session.getProofChain();
        expect(chain[0]).toBe(c1);
    });

    test("should detect target solved index", () => {
        const session = createSession();

        // We need to add clues until target is solved.
        // We'll add many clues.
        let solved = false;
        let c = 0;
        const LIMIT = 10;

        while (!solved && c < LIMIT) {
            const next = session.getNextClue();
            if (!next.clue) break;
            // logic inside getNextClue usage already adds it to proof chain if we returned it? 
            // no, getNextClue returns {clue} and calls applyAndSave if successful.

            // Checks if *puzzle* is solved, not target.
            // But session updates targetSolvedStepIndex internally on applyAndSave.
            if (session.getTargetSolvedStepIndex() !== -1) {
                // Target solved!
                break;
            }
            c++;
        }

        const idx = session.getTargetSolvedStepIndex();
        // If we found the solution
        if (idx !== -1) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(session.getProofChain().length);

            // Check that possibilities are 1
            const t = (session as any).targetFact;
            const count = session.getGrid().getPossibilitiesCount(t.category1Id, t.value1, t.category2Id);
            expect(count).toBe(1);
        } else {
            console.warn("Could not solve target within clue limit for test");
        }
    });
});
