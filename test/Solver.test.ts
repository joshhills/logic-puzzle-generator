import { Solver } from '../src/engine/Solver';
import { LogicGrid } from '../src/engine/LogicGrid';
import { CategoryConfig, CategoryType, ValueLabel, Solution } from '../src/types';
import { Clue, ClueType, BinaryOperator, OrdinalClue, SuperlativeClue, OrdinalOperator, SuperlativeOperator, UnaryClue, UnaryFilter, BinaryClue } from '../src/engine/Clue';

describe('Solver', () => {
    let categories: CategoryConfig[];
    let logicGrid: LogicGrid;
    let solver: Solver;

    beforeEach(() => {
        categories = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40] },
            { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy'] },
        ];
        logicGrid = new LogicGrid(categories);
        solver = new Solver();
    });

    it('should apply a binary IS clue and deduce uniqueness', () => {
        const clue: Clue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name',
            val1: 'Alice',
            cat2: 'Snack',
            val2: 'Chips',
        };

        const { deductions } = solver.applyClue(logicGrid, clue);
        expect(deductions).toBeGreaterThan(0);
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Chips')).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Popcorn')).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Snack', 'Candy')).toBe(false);
        expect(logicGrid.isPossible('Name', 'Bob', 'Snack', 'Chips')).toBe(false);
        expect(logicGrid.isPossible('Name', 'Charlie', 'Snack', 'Chips')).toBe(false);
    });

    it('should apply transitivity rule', () => {
        const clue1: Clue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name',
            val1: 'Alice',
            cat2: 'Snack',
            val2: 'Chips',
        };
        const clue2: Clue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Snack',
            val1: 'Chips',
            cat2: 'Age',
            val2: 20,
        };

        solver.applyClue(logicGrid, clue1);
        solver.applyClue(logicGrid, clue2);

        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(false);
    });

    it('should apply a superlative MAX clue', () => {
        const clue: SuperlativeClue = {
            type: ClueType.SUPERLATIVE,
            operator: SuperlativeOperator.MAX,
            targetCat: 'Name',
            targetVal: 'Alice',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
    });

    it('should apply a superlative MIN clue', () => {
        const clue: SuperlativeClue = {
            type: ClueType.SUPERLATIVE,
            operator: SuperlativeOperator.MIN,
            targetCat: 'Name',
            targetVal: 'Bob',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 20)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 30)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 40)).toBe(false);
    });

    it('should apply an ordinal GREATER_THAN clue', () => {
        const clue: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.GREATER_THAN,
            item1Cat: 'Name',
            item1Val: 'Alice',
            item2Cat: 'Name',
            item2Val: 'Bob',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        // Alice can't be the youngest, Bob can't be the oldest
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 40)).toBe(false);

        // If Bob is 30, Alice must be 40
        const clue2: Clue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Name', val1: 'Bob',
            cat2: 'Age', val2: 30,
        };
        solver.applyClue(logicGrid, clue2);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(false);
    });

    it('should apply an ordinal LESS_THAN clue', () => {
        const clue: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.LESS_THAN,
            item1Cat: 'Name',
            item1Val: 'Charlie',
            item2Cat: 'Name',
            item2Val: 'Alice',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        // Charlie can't be the oldest, Alice can't be the youngest
        expect(logicGrid.isPossible('Name', 'Charlie', 'Age', 40)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
    });

    it('should apply a true cross-category ordinal clue', () => {
        const categoriesWithGenre = [
            ...categories,
            { id: 'Genre', type: CategoryType.NOMINAL, values: ['Horror', 'Sci-Fi', 'Comedy'] },
        ]
        logicGrid = new LogicGrid(categoriesWithGenre);
        // "The person with Popcorn is older than the person who likes Horror"
        const clue: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.GREATER_THAN,
            item1Cat: 'Snack',
            item1Val: 'Popcorn',
            item2Cat: 'Genre',
            item2Val: 'Horror',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        // The person who eats Popcorn cannot be the youngest (20)
        expect(logicGrid.isPossible('Snack', 'Popcorn', 'Age', 20)).toBe(false);
        // The person who likes Horror cannot be the oldest (40)
        expect(logicGrid.isPossible('Genre', 'Horror', 'Age', 40)).toBe(false);
    });

    it('should apply a unary IS_ODD clue', () => {
        // Add an odd age to make the test meaningful
        const categoriesWithOddAge = [
            { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie'] },
            { id: 'Age', type: CategoryType.ORDINAL, values: [20, 31, 40] },
            { id: 'Snack', type: CategoryType.NOMINAL, values: ['Chips', 'Popcorn', 'Candy'] },
        ];
        logicGrid = new LogicGrid(categoriesWithOddAge);

        const clue: UnaryClue = {
            type: ClueType.UNARY,
            filter: UnaryFilter.IS_ODD,
            targetCat: 'Name',
            targetVal: 'Alice',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 31)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(false);
    });

    it('should apply a unary IS_EVEN clue', () => {
        const clue: UnaryClue = {
            type: ClueType.UNARY,
            filter: UnaryFilter.IS_EVEN,
            targetCat: 'Name',
            targetVal: 'Bob',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        // Bob must have an even age.
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 20)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 30)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 40)).toBe(true);
    });

    it('should handle a chain of ordinal clues', () => {
        // Alice > Bob, Bob > Charlie  => Alice=40, Bob=30, Charlie=20
        const clue1: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.GREATER_THAN,
            item1Cat: 'Name', item1Val: 'Alice',
            item2Cat: 'Name', item2Val: 'Bob',
            ordinalCat: 'Age',
        };
        const clue2: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.GREATER_THAN,
            item1Cat: 'Name', item1Val: 'Bob',
            item2Cat: 'Name', item2Val: 'Charlie',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue1);
        solver.applyClue(logicGrid, clue2);

        // Check initial impossibilities
        // Alice can't be 20 or 30
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(false);
        // Bob can't be 20 or 40
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 40)).toBe(false);
        // Charlie can't be 30 or 40
        expect(logicGrid.isPossible('Name', 'Charlie', 'Age', 30)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Charlie', 'Age', 40)).toBe(false);

        // The solver should deduce the exact ages
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Bob', 'Age', 30)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Charlie', 'Age', 20)).toBe(true);

        // And it should deduce uniqueness for other categories through transitivity
        const clue3: BinaryClue = {
            type: ClueType.BINARY,
            operator: BinaryOperator.IS,
            cat1: 'Age', val1: 20,
            cat2: 'Snack', val2: 'Candy',
        }
        solver.applyClue(logicGrid, clue3);
        expect(logicGrid.isPossible('Name', 'Charlie', 'Snack', 'Candy')).toBe(true);
        expect(logicGrid.isPossible('Name', 'Charlie', 'Snack', 'Chips')).toBe(false);
    });

    it('should apply NEGATIVE ordinal clues (NOT_BEFORE/NOT_AFTER)', () => {
        // Alice is NOT BEFORE Bob (Age). So Alice >= Bob.
        // Ages: 20, 30, 40.
        // If Bob is 40, Alice must be 40 (conceptually equal allowed by operator, though unique values prevent it usually).
        // If Alice is 20, she can't be after anyone (unless =).
        // Let's test pruning:
        // Alice(20) cannot be >= Bob(40).
        // Alice(20) cannot be >= Bob(30).
        // So if Alice is 20, Bob must be 20 (if equal possible) or impossible if distinct.

        const clue: OrdinalClue = {
            type: ClueType.ORDINAL,
            operator: OrdinalOperator.NOT_LESS_THAN, // Alice >= Bob
            item1Cat: 'Name', item1Val: 'Alice',
            item2Cat: 'Name', item2Val: 'Bob',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        // If Alice is 20, Bob must be <= 20. Bob could be 20? 
        // In standard logic grid, items have unique values. So Alice != Bob. 
        // LogicGrid doesn't enforce uniqueness per se until "Uniqueness" loop checks distinct assignments.
        // But solver applies constraints based on POSSIBILITY.

        // Is it possible for Alice=20 and Bob=30? No, 20 is NOT >= 30.
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20) && logicGrid.isPossible('Name', 'Bob', 'Age', 30)).toBe(true); // Wait. logicGrid.isPossible checks individual cells.
        // The solver prunes inconsistent possibilities.
        // It iterates pval1 and checks if there EXISTS a pval2 s.t. pval1 >= pval2.

        // If Alice=20, can Bob be anything <= 20? Only 20.
        // If uniqueness is assumed later, great. But here 20>=20 is true.
        // If Alice=20, Bob=20 is valid for this clue.

        // If Alice=20, can Bob be 30? No. 20 < 30.
        // The default Solver logic we implemented iterates all pairs.
        // Wait, current Solver logic prunes pval1 if NO pval2 makes the condition true.
        // If Alice=20, exists Bob=20? Yes. So Alice=20 is NOT pruned.

        // Let's force a better case.
        // Bob is 30.
        const clue2: Clue = { type: ClueType.BINARY, operator: BinaryOperator.IS, cat1: 'Name', val1: 'Bob', cat2: 'Age', val2: 30 };
        solver.applyClue(logicGrid, clue2);

        // Alice >= Bob (30). 
        // Bob is 30. Uniqueness means Alice != 30.
        // So Alice must be > 30. i.e. 40.

        solver.applyClue(logicGrid, clue);

        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(false); // Pruned by Uniqueness (Bob=30)
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(true);
    });

    it('should apply NEGATIVE superlative clues (NOT_MIN/NOT_MAX)', () => {
        // Alice is NOT the youngest (20).
        const clue: SuperlativeClue = {
            type: ClueType.SUPERLATIVE,
            operator: SuperlativeOperator.NOT_MIN,
            targetCat: 'Name', targetVal: 'Alice',
            ordinalCat: 'Age',
        };

        solver.applyClue(logicGrid, clue);

        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 30)).toBe(true);
        expect(logicGrid.isPossible('Name', 'Alice', 'Age', 40)).toBe(true);
    });
    it('should apply CROSS_ORDINAL clues', () => {
        // "The item before Alice (Name) in Age is the item after Chips (Snack) in Age"
        // Let's set up:
        // Alice is Name-1 (Age 30). Item before is Age 20.
        // Chips is Snack-0 (Age 10? No, values are 20,30,40).
        // Let's use specific setup.

        // Scenario:
        // Bob (Name) = 30 (Age)
        // Alice (Name) = 40 (Age)
        // Charlie (Name) = 20 (Age)

        // Popcorn (Snack) = 20 (Age)

        // Clue: "The item BEFORE Alice (Name) in Age is Popcorn (Snack)"
        // Alice is 40. Item before is 30. So Popcorn must be 30.

        // Let's supply this clue:
        // item1: Alice (Name)
        // ordinal1: Age
        // offset1: -1 (Before)
        // item2: Popcorn (Snack)
        // ordinal2: Age
        // offset2: 0 (The item itself) -> Wait, currently CrossOrdinal is "Item A + offset = Item B + offset".
        // Let's check definition. 
        // "The item BEFORE A ... IS ... B".
        // item1: Alice, offset1: -1.
        // item2: Popcorn, offset2: 0.

        const clue: Clue = {
            type: ClueType.CROSS_ORDINAL,
            item1Cat: 'Name', item1Val: 'Alice',
            ordinal1: 'Age', offset1: -1,
            item2Cat: 'Snack', item2Val: 'Popcorn',
            ordinal2: 'Age', offset2: 0,
        } as any;

        // Make Alice = 40
        solver.applyClue(logicGrid, { type: ClueType.BINARY, operator: BinaryOperator.IS, cat1: 'Name', val1: 'Alice', cat2: 'Age', val2: 40 });

        solver.applyClue(logicGrid, clue);

        // Alice is 40 (Idx 2). Before Alice is Idx 1 (30).
        // So Popcorn should be 30.
        expect(logicGrid.isPossible('Snack', 'Popcorn', 'Age', 30)).toBe(true);
        expect(logicGrid.isPossible('Snack', 'Popcorn', 'Age', 20)).toBe(false);
        expect(logicGrid.isPossible('Snack', 'Popcorn', 'Age', 40)).toBe(false);
    });
});