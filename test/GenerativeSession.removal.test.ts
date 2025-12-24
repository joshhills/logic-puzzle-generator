
import { GenerativeSession } from "../src/engine/GenerativeSession";
import { Generator } from "../src/engine/Generator";
import { CategoryType, ClueType } from "../src/types";

// Mock minimal dependencies
const categories = [
    { id: "Cat1", type: CategoryType.NOMINAL, name: "Cat1", values: ["A", "B", "C"] },
    { id: "Cat2", type: CategoryType.NOMINAL, name: "Cat2", values: ["1", "2", "3"] }
];

// Helper to create a valid session
function createSession() {
    const generator = new Generator(12345);
    // 2nd arg is target (undefined = random), 3rd is options
    const puzzle = generator.generatePuzzle(categories, undefined, {
        // Relax constraints to ensure generation succeeds quickly
        maxCandidates: 100
    });

    // Private properties are not returned by generatePuzzle, 
    // so we access them from the generator instance for testing purposes.
    const reverseSolution = (generator as any).reverseSolution;
    const valueMap = (generator as any).valueMap;

    // Create new session using the same config
    return new GenerativeSession(
        generator,
        categories,
        puzzle.solution,
        reverseSolution,
        valueMap,
        { category1Id: "Cat1", value1: "A", category2Id: "Cat2" } // dummy target (no value2)
    );
}

describe("GenerativeSession Clue Removal", () => {
    test("should remove the last clue correctly", () => {
        const session = createSession();

        // Add 3 clues
        const clue1 = session.getNextClue()?.clue;
        const clue2 = session.getNextClue()?.clue;
        const clue3 = session.getNextClue()?.clue;

        expect(session.getProofChain().length).toBe(3);

        // Remove last
        session.removeClueAt(2);

        expect(session.getProofChain().length).toBe(2);
        expect(session.getProofChain()[0]).toBe(clue1);
        expect(session.getProofChain()[1]).toBe(clue2);
    });

    test("should remove a middle clue and replay metadata", () => {
        const session = createSession();

        // We need deterministic clues to check deduction changes.
        // Ideally we pick clues that affect each other.
        // For this test, we just verify the chain integrity and that it runs without error.

        const c1 = session.getNextClue()?.clue;
        const c2 = session.getNextClue()?.clue;
        const c3 = session.getNextClue()?.clue;

        if (!c1 || !c2 || !c3) throw new Error("Could not generate 3 clues");

        // Remove middle (index 1)
        session.removeClueAt(1);

        const chain = session.getProofChain();
        expect(chain.length).toBe(2);
        expect(chain[0]).toBe(c1);
        expect(chain[1]).toBe(c3); // c3 should shift down

        // Verify c2 is back in available
        // We check the specific instance since we haven't cloned unnecessarily in removeClueAt before returning
        const available = (session as any).availableClues as any[];
        expect(available).toContain(c2);

        // Also ensure count increased (it was decreasing as we used clues)
        // Initial available count? We'd need to know it. 
        // But verifying inclusion is strong enough.
    });

    test("should handle invalid indices gracefully", () => {
        const session = createSession();
        session.getNextClue();

        expect(session.removeClueAt(-1)).toBe(false);
        expect(session.removeClueAt(5)).toBe(false);
        expect(session.getProofChain().length).toBe(1);
    });
});
