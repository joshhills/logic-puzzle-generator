import { CategoryConfig, CategoryType, ValueLabel, Solution } from '../types';
import { Clue, ClueType, BinaryClue, BinaryOperator, OrdinalClue, OrdinalOperator, SuperlativeClue, SuperlativeOperator, UnaryClue, UnaryFilter } from './Clue';
import { LogicGrid } from './LogicGrid';

/**
 * The logical engine responsible for applying clues to a LogicGrid and deducing consequences.
 * 
 * It implements various deduction strategies including basic elimination, uniqueness checks,
 * and transitive logic logic (if A=B and B=C, then A=C).
 */
export class Solver {

    /**
     * Applies a single clue to the grid and propagates logical deductions.
     * 
     * This method runs a loop that explicitly applies the clue and then repeatedly
     * triggers the internal deduction engine until no further eliminations can be made.
     * 
     * @param grid - The LogicGrid to modify.
     * @param clue - The Clue to apply.
     * @returns An object containing the modified grid and the total count of eliminations made.
     */
    public applyClue(grid: LogicGrid, clue: Clue): { grid: LogicGrid; deductions: number } {
        let deductions = 0;

        switch (clue.type) {
            case ClueType.BINARY:
                deductions += this.applyBinaryClue(grid, clue);
                break;
            case ClueType.SUPERLATIVE:
                deductions += this.applySuperlativeClue(grid, clue as SuperlativeClue);
                break;
            case ClueType.ORDINAL:
                deductions += this.applyOrdinalClue(grid, clue as OrdinalClue);
                break;
            case ClueType.UNARY:
                deductions += this.applyUnaryClue(grid, clue as UnaryClue);
                break;
            case ClueType.CROSS_ORDINAL:
                deductions += this.applyCrossOrdinalClue(grid, clue as any); // Cast as any because import might lag or circular deps? no, just strict TS.
                break;
        }


        let newDeductions;
        do {
            newDeductions = this.runDeductionLoop(grid);
            deductions += newDeductions;
        } while (newDeductions > 0);

        return { grid, deductions };
    }

    private applyCrossOrdinalClue(grid: LogicGrid, clue: import('./Clue').CrossOrdinalClue): number {
        let deductions = 0;
        const categories = (grid as any).categories as CategoryConfig[];
        const ord1Config = categories.find(c => c.id === clue.ordinal1);
        const ord2Config = categories.find(c => c.id === clue.ordinal2);

        if (!ord1Config || !ord2Config) return 0;

        // Helper to get possible indices for an item in its ordinal category
        const getPossibleIndices = (itemCat: string, itemVal: ValueLabel, ordCat: string, ordConfig: CategoryConfig) => {
            return ordConfig.values
                .map((v, i) => ({ val: v, idx: i }))
                .filter(v => grid.isPossible(itemCat, itemVal, ordCat, v.val));
        };

        const eligible1 = getPossibleIndices(clue.item1Cat, clue.item1Val, clue.ordinal1, ord1Config);
        const eligible2 = getPossibleIndices(clue.item2Cat, clue.item2Val, clue.ordinal2, ord2Config);

        // Filter 1 based on 2
        for (const cand1 of eligible1) {
            const targetIdx1 = cand1.idx + clue.offset1;
            const targetVal1 = ord1Config.values[targetIdx1];

            // Bounds check
            if (targetVal1 === undefined) {
                grid.setPossibility(clue.item1Cat, clue.item1Val, clue.ordinal1, cand1.val, false);
                deductions++;
                continue;
            }

            // Compatibility check
            // Is there ANY cand2 that maps to a targetVal2 compatible with targetVal1?
            let supported = false;
            for (const cand2 of eligible2) {
                const targetIdx2 = cand2.idx + clue.offset2;
                const targetVal2 = ord2Config.values[targetIdx2];

                if (targetVal2 !== undefined) {
                    // Check if (Ord1=TargetVal1) is compatible with (Ord2=TargetVal2)
                    if (grid.isPossible(clue.ordinal1, targetVal1, clue.ordinal2, targetVal2)) {
                        supported = true;
                        break;
                    }
                }
            }

            if (!supported) {
                grid.setPossibility(clue.item1Cat, clue.item1Val, clue.ordinal1, cand1.val, false);
                deductions++;
            }
        }

        // Filter 2 based on 1 (Symmetric)
        // Re-read eligible1 in case it shrank? For max deduction, yes. But strict 1-pass is fine for now; loop handles it.
        // Actually, let's use the potentially filtered list? 
        // LogicGrid updates in place, so `isPossible` checks inside `getPossibleIndices` would need re-running.
        // Let's just run the loop on the original capture, the outer `runDeductionLoop` will re-trigger this function if changes happened.

        for (const cand2 of eligible2) {
            const targetIdx2 = cand2.idx + clue.offset2;
            const targetVal2 = ord2Config.values[targetIdx2];

            if (targetVal2 === undefined) {
                grid.setPossibility(clue.item2Cat, clue.item2Val, clue.ordinal2, cand2.val, false);
                deductions++;
                continue;
            }

            let supported = false;
            for (const cand1 of eligible1) {
                const targetIdx1 = cand1.idx + clue.offset1;
                const targetVal1 = ord1Config.values[targetIdx1];

                if (targetVal1 !== undefined) {
                    if (grid.isPossible(clue.ordinal1, targetVal1, clue.ordinal2, targetVal2)) {
                        supported = true;
                        break;
                    }
                }
            }

            if (!supported) {
                grid.setPossibility(clue.item2Cat, clue.item2Val, clue.ordinal2, cand2.val, false);
                deductions++;
            }
        }

        // Lock linkage if unique
        // We re-query the grid to see resolved state
        const finalEligible1 = getPossibleIndices(clue.item1Cat, clue.item1Val, clue.ordinal1, ord1Config);
        const finalEligible2 = getPossibleIndices(clue.item2Cat, clue.item2Val, clue.ordinal2, ord2Config);

        if (finalEligible1.length === 1 && finalEligible2.length === 1) {
            const t1 = finalEligible1[0].idx + clue.offset1;
            const t2 = finalEligible2[0].idx + clue.offset2;
            const v1 = ord1Config.values[t1];
            const v2 = ord2Config.values[t2];

            if (v1 !== undefined && v2 !== undefined) {
                if (grid.getPossibilitiesCount(clue.ordinal1, v1, clue.ordinal2) > 1) {
                    grid.setPossibility(clue.ordinal1, v1, clue.ordinal2, v2, true);
                    deductions++;
                }
            }
        }

        return deductions;
    }

    private applyUnaryClue(grid: LogicGrid, clue: UnaryClue): number {
        let deductions = 0;
        const categories = (grid as any).categories as CategoryConfig[];
        const ordinalCatConfig = categories.find(c => c.id === clue.ordinalCat);

        if (!ordinalCatConfig || ordinalCatConfig.type !== CategoryType.ORDINAL) return 0;
        if (!ordinalCatConfig.values.every(v => typeof v === 'number')) return 0;

        const isEven = clue.filter === UnaryFilter.IS_EVEN;

        for (const ordVal of ordinalCatConfig.values) {
            const ordNum = ordVal as number;
            const shouldEliminate = isEven ? ordNum % 2 !== 0 : ordNum % 2 === 0;

            if (shouldEliminate) {
                if (grid.isPossible(clue.targetCat, clue.targetVal, clue.ordinalCat, ordVal)) {
                    grid.setPossibility(clue.targetCat, clue.targetVal, clue.ordinalCat, ordVal, false);
                    deductions++;
                }
            }
        }
        return deductions;
    }

    private applyBinaryClue(grid: LogicGrid, clue: BinaryClue): number {
        let deductions = 0;
        const categories = (grid as any).categories as CategoryConfig[];
        const cat1Config = categories.find(c => c.id === clue.cat1);
        const cat2Config = categories.find(c => c.id === clue.cat2);

        if (!cat1Config || !cat2Config) return 0;

        if (clue.operator === BinaryOperator.IS) {
            if (grid.isPossible(clue.cat1, clue.val1, clue.cat2, clue.val2)) {
                // This is not a deduction, but a fact application. Still, we need to eliminate other possibilities.
            }
            grid.setPossibility(clue.cat1, clue.val1, clue.cat2, clue.val2, true);


            for (const val of cat2Config.values) {
                if (val !== clue.val2) {
                    if (grid.isPossible(clue.cat1, clue.val1, clue.cat2, val)) {
                        grid.setPossibility(clue.cat1, clue.val1, clue.cat2, val, false);
                        deductions++;
                    }
                }
            }
            for (const val of cat1Config.values) {
                if (val !== clue.val1) {
                    if (grid.isPossible(clue.cat1, val, clue.cat2, clue.val2)) {
                        grid.setPossibility(clue.cat1, val, clue.cat2, clue.val2, false);
                        deductions++;
                    }
                }
            }
        } else { // IS_NOT
            if (grid.isPossible(clue.cat1, clue.val1, clue.cat2, clue.val2)) {
                grid.setPossibility(clue.cat1, clue.val1, clue.cat2, clue.val2, false);
                deductions++;
            }
        }
        return deductions;
    }

    private runDeductionLoop(grid: LogicGrid): number {
        let deductions = 0;
        const categories = (grid as any).categories as CategoryConfig[];

        for (const cat1 of categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of categories) {
                    if (cat1.id === cat2.id) continue;

                    // Uniqueness Check
                    const possibleValues = cat2.values.filter(val2 => grid.isPossible(cat1.id, val1, cat2.id, val2));
                    if (possibleValues.length === 1) {
                        const val2 = possibleValues[0];
                        // If val1 is uniquely associated with val2, then no other val from cat1 can be associated with val2
                        for (const otherVal1 of cat1.values) {
                            if (otherVal1 !== val1) {
                                if (grid.isPossible(cat1.id, otherVal1, cat2.id, val2)) {
                                    grid.setPossibility(cat1.id, otherVal1, cat2.id, val2, false);
                                    deductions++;
                                }
                            }
                        }
                    }

                    // Transitivity
                    for (const cat3 of categories) {
                        if (cat1.id === cat3.id || cat2.id === cat3.id) continue;

                        // Positive Transitivity
                        const definiteVal2 = possibleValues.length === 1 ? possibleValues[0] : null;
                        if (definiteVal2) {
                            const possibleVal3s = cat3.values.filter(val3 => grid.isPossible(cat2.id, definiteVal2, cat3.id, val3));
                            if (possibleVal3s.length === 1) {
                                const definiteVal3 = possibleVal3s[0];
                                if (grid.isPossible(cat1.id, val1, cat3.id, definiteVal3) === false) {
                                    // This indicates a contradiction, but for now we are just making deductions.
                                } else if (grid.getPossibilitiesCount(cat1.id, val1, cat3.id) > 1) {
                                    grid.setPossibility(cat1.id, val1, cat3.id, definiteVal3, true);
                                    deductions++;
                                }
                            }
                        }

                        // Negative Transitivity
                        for (const val3 of cat3.values) {
                            if (grid.isPossible(cat1.id, val1, cat3.id, val3)) {
                                const isPathPossible = cat2.values.some(val2 => grid.isPossible(cat1.id, val1, cat2.id, val2) && grid.isPossible(cat2.id, val2, cat3.id, val3));
                                if (!isPathPossible) {
                                    grid.setPossibility(cat1.id, val1, cat3.id, val3, false);
                                    deductions++;
                                }
                            }
                        }
                    }
                }
            }
        }

        return deductions;
    }

    private applyOrdinalClue(grid: LogicGrid, constraint: OrdinalClue): number {
        let deductions = 0;
        const categories = (grid as any).categories as CategoryConfig[];

        const ordCatConfig = categories.find(c => c.id === constraint.ordinalCat);
        if (!ordCatConfig || ordCatConfig.type !== CategoryType.ORDINAL) return 0;

        const possibleVals1 = ordCatConfig.values
            .map((v, i) => ({ val: v, idx: i }))
            .filter(v => grid.isPossible(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, v.val));

        const possibleVals2 = ordCatConfig.values
            .map((v, i) => ({ val: v, idx: i }))
            .filter(v => grid.isPossible(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, v.val));

        if (possibleVals1.length === 0 || possibleVals2.length === 0) return 0;

        // --- Item 1 Pruning ---
        if (constraint.operator === OrdinalOperator.GREATER_THAN) { // item1 > item2
            for (const pval1 of possibleVals1) {
                const canBeGreaterThan = possibleVals2.some(pval2 => pval1.idx > pval2.idx);
                if (!canBeGreaterThan) {
                    if (grid.isPossible(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val)) {
                        grid.setPossibility(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.LESS_THAN) { // item1 < item2
            for (const pval1 of possibleVals1) {
                const canBeLessThan = possibleVals2.some(pval2 => pval1.idx < pval2.idx);
                if (!canBeLessThan) {
                    if (grid.isPossible(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val)) {
                        grid.setPossibility(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.NOT_GREATER_THAN) { // item1 <= item2
            for (const pval1 of possibleVals1) {
                const canBeLessOrEqual = possibleVals2.some(pval2 => pval1.idx <= pval2.idx);
                if (!canBeLessOrEqual) {
                    if (grid.isPossible(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val)) {
                        grid.setPossibility(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.NOT_LESS_THAN) { // item1 >= item2
            for (const pval1 of possibleVals1) {
                const canBeGreaterOrEqual = possibleVals2.some(pval2 => pval1.idx >= pval2.idx);
                if (!canBeGreaterOrEqual) {
                    if (grid.isPossible(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val)) {
                        grid.setPossibility(constraint.item1Cat, constraint.item1Val, constraint.ordinalCat, pval1.val, false);
                        deductions++;
                    }
                }
            }
        }

        // --- Item 2 Pruning ---
        if (constraint.operator === OrdinalOperator.GREATER_THAN) { // item2 < item1
            for (const pval2 of possibleVals2) {
                const canBeLessThan = possibleVals1.some(pval1 => pval2.idx < pval1.idx);
                if (!canBeLessThan) {
                    if (grid.isPossible(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val)) {
                        grid.setPossibility(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.LESS_THAN) { // item2 > item1
            for (const pval2 of possibleVals2) {
                const canBeGreaterThan = possibleVals1.some(pval1 => pval2.idx > pval1.idx);
                if (!canBeGreaterThan) {
                    if (grid.isPossible(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val)) {
                        grid.setPossibility(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.NOT_GREATER_THAN) { // item2 >= item1
            for (const pval2 of possibleVals2) {
                const canBeGreaterOrEqual = possibleVals1.some(pval1 => pval2.idx >= pval1.idx);
                if (!canBeGreaterOrEqual) {
                    if (grid.isPossible(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val)) {
                        grid.setPossibility(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val, false);
                        deductions++;
                    }
                }
            }
        } else if (constraint.operator === OrdinalOperator.NOT_LESS_THAN) { // item2 <= item1
            for (const pval2 of possibleVals2) {
                const canBeLessOrEqual = possibleVals1.some(pval1 => pval2.idx <= pval1.idx);
                if (!canBeLessOrEqual) {
                    if (grid.isPossible(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val)) {
                        grid.setPossibility(constraint.item2Cat, constraint.item2Val, constraint.ordinalCat, pval2.val, false);
                        deductions++;
                    }
                }
            }
        }

        return deductions;
    }

    private applySuperlativeClue(grid: LogicGrid, clue: SuperlativeClue): number {
        const categories = (grid as any).categories as CategoryConfig[];
        const ordinalCatConfig = categories.find(c => c.id === clue.ordinalCat);
        if (!ordinalCatConfig || ordinalCatConfig.type !== CategoryType.ORDINAL) return 0;

        let extremeValue: ValueLabel;
        let isNot = false;

        switch (clue.operator) {
            case SuperlativeOperator.MAX:
                extremeValue = ordinalCatConfig.values[ordinalCatConfig.values.length - 1];
                break;
            case SuperlativeOperator.MIN:
                extremeValue = ordinalCatConfig.values[0];
                break;
            case SuperlativeOperator.NOT_MAX:
                extremeValue = ordinalCatConfig.values[ordinalCatConfig.values.length - 1];
                isNot = true;
                break;
            case SuperlativeOperator.NOT_MIN:
                extremeValue = ordinalCatConfig.values[0];
                isNot = true;
                break;
            default: return 0;
        }

        // This clue is essentially a binary IS clue.
        const binaryClue: BinaryClue = {
            type: ClueType.BINARY,
            cat1: clue.targetCat,
            val1: clue.targetVal,
            cat2: clue.ordinalCat,
            val2: extremeValue,
            operator: isNot ? BinaryOperator.IS_NOT : BinaryOperator.IS,
        };

        return this.applyBinaryClue(grid, binaryClue);
    }
}
