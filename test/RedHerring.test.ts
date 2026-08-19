import { Generator, getSafeMaxRedHerrings } from '../src/engine/Generator';
import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType, ClueType } from '../src/types';
import { ConfigurationError } from '../src/errors';

describe('Red Herrings (Fake Clues) Feature', () => {
    const categories3x4: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'Diana'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green', 'Yellow'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40, 50] }
    ];

    const categoriesNominal3x4: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'Diana'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green', 'Yellow'] },
        { id: 'Drink', type: CategoryType.NOMINAL, values: ['Tea', 'Coffee', 'Soda', 'Water'] }
    ];

    const categories2x4Ordinal: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'Diana'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40, 50] }
    ];

    const categories2x3Ordinal: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
        { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40] }
    ];

    const invalidCategories2x3Nominal: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green'] }
    ];

    const invalidCategories2x4Nominal: CategoryConfig[] = [
        { id: 'Person', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'Diana'] },
        { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green', 'Yellow'] }
    ];

    const solver = new Solver();

    describe('Default Behavior (redHerrings disabled)', () => {
        it('should default redHerrings to [] and have validClues identical to clues when omitted', () => {
            const gen = new Generator(42);
            const puzzle = gen.generatePuzzle(categories3x4);

            expect(puzzle.redHerrings).toEqual([]);
            expect(puzzle.validClues).toEqual(puzzle.clues);
            expect(puzzle.validClues.length).toBe(puzzle.proofChain.length);
        });

        it('should have empty redHerrings when explicitly passed redHerrings: 0', () => {
            const gen = new Generator(42);
            const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: 0 });

            expect(puzzle.redHerrings).toEqual([]);
            expect(puzzle.validClues).toEqual(puzzle.clues);
        });
    });

    describe('Safe Max Red Herrings Bounds & Layout Edge Cases', () => {
        it('should report 0 for edge cases: empty, single category, or too few items', () => {
            expect(getSafeMaxRedHerrings([])).toBe(0);
            expect(getSafeMaxRedHerrings([{ id: 'A', type: CategoryType.NOMINAL, values: ['1', '2', '3'] }])).toBe(0);
            expect(getSafeMaxRedHerrings([
                { id: 'A', type: CategoryType.NOMINAL, values: ['1', '2'] },
                { id: 'B', type: CategoryType.NOMINAL, values: ['1', '2'] }
            ])).toBe(0);
        });

        it('should report 0 for 2-category nominal puzzles regardless of item count', () => {
            expect(getSafeMaxRedHerrings(invalidCategories2x3Nominal)).toBe(0);
            expect(getSafeMaxRedHerrings(invalidCategories2x4Nominal)).toBe(0);
        });

        it('should calculate exact safe bounds for 2-category ordinal puzzles', () => {
            expect(getSafeMaxRedHerrings(categories2x3Ordinal)).toBe(1);
            expect(getSafeMaxRedHerrings(categories2x4Ordinal)).toBe(2);
        });

        it('should calculate exact safe bounds for multi-category puzzles', () => {
            expect(getSafeMaxRedHerrings(categoriesNominal3x4)).toBe(3);
            expect(getSafeMaxRedHerrings(categories3x4)).toBe(4);
            expect(getSafeMaxRedHerrings([
                { id: 'P', type: CategoryType.NOMINAL, values: ['1', '2', '3', '4', '5'] },
                { id: 'C', type: CategoryType.NOMINAL, values: ['1', '2', '3', '4', '5'] },
                { id: 'A', type: CategoryType.ORDINAL, values: [1, 2, 3, 4, 5] },
                { id: 'D', type: CategoryType.ORDINAL, values: [10, 20, 30, 40, 50] }
            ])).toBe(5);
        });
    });

    describe('Configuration Validation & Boundary Enforcement', () => {
        it('should throw ConfigurationError when requesting red herrings on unsupported 2x3 nominal puzzle', () => {
            const gen = new Generator(42);
            expect(() => {
                gen.generatePuzzle(invalidCategories2x3Nominal, undefined, { redHerrings: 1 });
            }).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError when requesting red herrings on unsupported 2x4 nominal puzzle', () => {
            const gen = new Generator(42);
            expect(() => {
                gen.generatePuzzle(invalidCategories2x4Nominal, undefined, { redHerrings: 1 });
            }).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError when requesting negative count', () => {
            const gen = new Generator(42);
            expect(() => {
                gen.generatePuzzle(categories3x4, undefined, { redHerrings: -1 });
            }).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError when requesting more red herrings than safeMax on 2x4 ordinal', () => {
            const gen = new Generator(42);
            const safeMax = getSafeMaxRedHerrings(categories2x4Ordinal); // 2
            expect(() => {
                gen.generatePuzzle(categories2x4Ordinal, undefined, { redHerrings: safeMax + 1 });
            }).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError when requesting more red herrings than safeMax on 3x4 nominal', () => {
            const gen = new Generator(42);
            const safeMax = getSafeMaxRedHerrings(categoriesNominal3x4); // 3
            expect(() => {
                gen.generatePuzzle(categoriesNominal3x4, undefined, { redHerrings: safeMax + 1 });
            }).toThrow(ConfigurationError);
        });
    });

    describe('Exact Maximum Safe Bounds Generation', () => {
        it('should successfully generate at EXACT safeMax on 2-category ordinal puzzle (K=2)', () => {
            const gen = new Generator(101);
            const safeMax = getSafeMaxRedHerrings(categories2x4Ordinal); // 2
            const puzzle = gen.generatePuzzle(categories2x4Ordinal, undefined, { redHerrings: safeMax });

            expect(puzzle.redHerrings.length).toBe(safeMax);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + safeMax);
        });

        it('should successfully generate at EXACT safeMax on 3-category nominal puzzle (K=3)', () => {
            const gen = new Generator(202);
            const safeMax = getSafeMaxRedHerrings(categoriesNominal3x4); // 3
            const puzzle = gen.generatePuzzle(categoriesNominal3x4, undefined, { redHerrings: safeMax });

            expect(puzzle.redHerrings.length).toBe(safeMax);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + safeMax);
        });

        it('should successfully generate at EXACT safeMax on 3-category ordinal puzzle (K=4)', () => {
            const gen = new Generator(303);
            const safeMax = getSafeMaxRedHerrings(categories3x4); // 4
            const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: safeMax });

            expect(puzzle.redHerrings.length).toBe(safeMax);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + safeMax);
        });
    });

    describe('Single Red Herring Generation (K=1)', () => {
        it('should generate a valid puzzle with exactly 1 red herring when passed as number', () => {
            const gen = new Generator(100);
            const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: 1 });

            expect(puzzle.redHerrings.length).toBe(1);
            expect(puzzle.validClues.length).toBe(puzzle.proofChain.length);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + 1);

            // Verify the red herring is inside clues
            expect(puzzle.clues).toContainEqual(puzzle.redHerrings[0]);

            // Verify that the red herring is false under solution
            const isConsistent = gen.checkClueConsistency(
                puzzle.redHerrings[0],
                puzzle.solution,
                (gen as any).reverseSolution,
                (gen as any).valueMap,
                categories3x4
            );
            expect(isConsistent).toBe(false);

            // Verify validClues alone completely solve the puzzle
            const grid = new LogicGrid(categories3x4);
            for (const c of puzzle.validClues) {
                solver.applyClue(grid, c);
            }
            expect(gen.isPuzzleSolved(grid, puzzle.solution, (gen as any).reverseSolution)).toBe(true);

            // Verify the solved grid contradicts the red herring
            expect(solver.isClueContradicted(grid, puzzle.redHerrings[0])).toBe(true);
        });

        it('should generate a valid puzzle with RedHerringOptions object and respect allowedClueTypes', () => {
            const gen = new Generator(200);
            const puzzle = gen.generatePuzzle(categories3x4, undefined, {
                redHerrings: { count: 1, minContradictionDepth: 2, allowedClueTypes: [ClueType.BINARY] }
            });

            expect(puzzle.redHerrings.length).toBe(1);
            expect(puzzle.redHerrings[0].type).toBe(ClueType.BINARY);
        });

        it('should ensure the red herring is stealthy (Depth >= 2: no 1-to-1 clash with any single clue)', () => {
            for (let seed = 1; seed <= 10; seed++) {
                const gen = new Generator(seed);
                const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: 1 });
                const redHerring = puzzle.redHerrings[0];

                for (const validClue of puzzle.validClues) {
                    const singleGrid = new LogicGrid(categories3x4);
                    solver.applyClue(singleGrid, validClue);
                    const directClash = solver.isClueContradicted(singleGrid, redHerring);
                    expect(directClash).toBe(false);
                }
            }
        });

        it('should ensure the red herring is unambiguous (only 1 valid solution universe)', () => {
            for (let seed = 1; seed <= 5; seed++) {
                const gen = new Generator(seed);
                const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: 1 });
                const redHerring = puzzle.redHerrings[0];
                const allClues = puzzle.clues;

                let validSubsets = 0;
                for (let omit = 0; omit < allClues.length; omit++) {
                    const subset = allClues.filter((_, idx) => idx !== omit);
                    const grid = new LogicGrid(categories3x4);
                    let contradiction = false;
                    let newDeductions = 0;
                    do {
                        newDeductions = 0;
                        for (const c of subset) {
                            const res = solver.applyClue(grid, c);
                            newDeductions += res.deductions;
                            if (!grid.isValid()) {
                                contradiction = true;
                                break;
                            }
                        }
                        if (contradiction) break;
                    } while (newDeductions > 0);

                    if (!contradiction) {
                        let fullySolved = true;
                        for (const c1 of categories3x4) {
                            for (const v1 of c1.values) {
                                for (const c2 of categories3x4) {
                                    if (c1.id >= c2.id) continue;
                                    if (grid.getPossibilitiesCount(c1.id, v1, c2.id) !== 1) {
                                        fullySolved = false;
                                    }
                                }
                            }
                        }
                        if (fullySolved) validSubsets++;
                    }
                }

                // Exactly 1 valid subset exists (omitting the red herring)
                expect(validSubsets).toBe(1);
            }
        });
    });

    describe('Multiple Red Herrings (K >= 2)', () => {
        it('should generate 2 mutually compatible red herrings on a 3x4 puzzle', () => {
            const gen = new Generator(300);
            const puzzle = gen.generatePuzzle(categories3x4, undefined, { redHerrings: 2 });

            expect(puzzle.redHerrings.length).toBe(2);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + 2);

            // Check that neither red herring directly clashes with the other in isolation
            const grid1 = new LogicGrid(categories3x4);
            solver.applyClue(grid1, puzzle.redHerrings[0]);
            expect(solver.isClueContradicted(grid1, puzzle.redHerrings[1])).toBe(false);
        });

        it('should generate 3 mutually compatible red herrings on a 3x4 nominal puzzle', () => {
            const gen = new Generator(400);
            const puzzle = gen.generatePuzzle(categoriesNominal3x4, undefined, { redHerrings: 3 });

            expect(puzzle.redHerrings.length).toBe(3);
            expect(puzzle.clues.length).toBe(puzzle.validClues.length + 3);
        });
    });

    describe('Determinism & Reproducibility', () => {
        it('should produce identical validClues, redHerrings, and clues given the same seed', () => {
            const gen1 = new Generator(12345);
            const p1 = gen1.generatePuzzle(categories3x4, undefined, { redHerrings: 1 });

            const gen2 = new Generator(12345);
            const p2 = gen2.generatePuzzle(categories3x4, undefined, { redHerrings: 1 });

            expect(p1.validClues).toEqual(p2.validClues);
            expect(p1.redHerrings).toEqual(p2.redHerrings);
            expect(p1.clues).toEqual(p2.clues);
        });
    });

    describe('GenerativeSession Integration', () => {
        it('should return available red herrings as clues are added and support generating a fake clue', () => {
            const gen = new Generator(500);
            const session = gen.startSession(categories3x4);

            // Initially with 0 clues, available red herrings is empty (need >= 2 steps for stealth)
            expect(session.getAvailableRedHerrings()).toEqual([]);

            // Add clues until solved
            let step = 0;
            while (!gen.isPuzzleSolved(session.getGrid(), session.getSolution(), (session as any).reverseSolution) && step < 10) {
                step++;
                session.getNextClue();
            }

            // Now that puzzle is solved, available red herrings should be plentiful
            const availableRedHerrings = session.getAvailableRedHerrings();
            expect(availableRedHerrings.length).toBeGreaterThan(0);

            // Test generateRedHerring()
            const redHerring = session.generateRedHerring();
            expect(redHerring).not.toBeNull();

            // Verify it is false under the solution
            const isConsistent = gen.checkClueConsistency(
                redHerring!,
                session.getSolution(),
                (session as any).reverseSolution,
                (session as any).valueMap,
                categories3x4
            );
            expect(isConsistent).toBe(false);
        });
    });
});