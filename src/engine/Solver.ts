import { CategoryConfig, CategoryType, ValueLabel, Solution, ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, CrossOrdinalOperator } from '../types';
import { Clue, BinaryClue, OrdinalClue, SuperlativeClue, UnaryClue } from './Clue';
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

        const isNot = clue.operator === CrossOrdinalOperator.NOT_MATCH;

        // Helper to get possible indices for an item in its ordinal category
        const getPossibleIndices = (itemCat: string, itemVal: ValueLabel, ordCat: string, ordConfig: CategoryConfig) => {
            return ordConfig.values
                .map((v, i) => ({ val: v, idx: i }))
                .filter(v => grid.isPossible(itemCat, itemVal, ordCat, v.val));
        };

        const eligible1 = getPossibleIndices(clue.item1Cat, clue.item1Val, clue.ordinal1, ord1Config);
        const eligible2 = getPossibleIndices(clue.item2Cat, clue.item2Val, clue.ordinal2, ord2Config);

        if (!isNot) {
            // --- POSITIVE LOGIC (MATCH) ---

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
                let supported = false;
                for (const cand2 of eligible2) {
                    const targetIdx2 = cand2.idx + clue.offset2;
                    const targetVal2 = ord2Config.values[targetIdx2];

                    if (targetVal2 !== undefined) {
                        // Check if (Ord1=TargetVal1) is compatible with (Ord2=TargetVal2)
                        // i.e., can they be the same entity?
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
            // We re-query indices as they might have been reduced above
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
        } else {
            // --- NEGATIVE LOGIC (NOT_MATCH) ---
            // "The entity at (Pos1 + Off1) in Ord1 is NOT the entity at (Pos2 + Off2) in Ord2"

            // If we have determined the specific Ordinal Values for both sides, we can eliminate their link.

            // Re-query eligible indices (optimization: use passed in ones? No, better safe)
            // (Using local consts `eligible1` etc is fine as we haven't mutated grid yet in this block)

            // Can we eliminate a candidate for Item1?
            // If putting Item1 at `cand1` FORCES the derived Ord1 Value to be `V1`
            // AND
            // The derived Ord2 Value `V2` (from Item2) is DEFINITELY determined...
            // AND `V1` MUST be `V2` (i.e. they are the same entity)...
            // THEN we force a contradiction?

            // Simpler: If we know the derived values V1 and V2, we say V1 IS_NOT V2.

            // Case 1: Both anchors fixed relative to their ordinals.
            // If Item1 can ONLY be at `idx1` (so derived `targetVal1` is fixed)
            // AND Item2 can ONLY be at `idx2` (so derived `targetVal2` is fixed)
            // THEN `targetVal1` IS NOT `targetVal2`.

            if (eligible1.length === 1 && eligible2.length === 1) {
                const t1 = eligible1[0].idx + clue.offset1;
                const t2 = eligible2[0].idx + clue.offset2;
                const v1 = ord1Config.values[t1];
                const v2 = ord2Config.values[t2];

                if (v1 !== undefined && v2 !== undefined) {
                    if (grid.isPossible(clue.ordinal1, v1, clue.ordinal2, v2)) {
                        grid.setPossibility(clue.ordinal1, v1, clue.ordinal2, v2, false);
                        deductions++;
                    }
                }
            }
            // Is that it? What about partial information?
            // If `targetVal1` is fixed, and it IS connected to `targetVal2`, 
            // then we know Item2 CANNOT be at any position that yields `targetVal2`.

            // Iterate all candidates for Item1
            for (const cand1 of eligible1) {
                const targetIdx1 = cand1.idx + clue.offset1;
                const targetVal1 = ord1Config.values[targetIdx1];
                if (targetVal1 === undefined) continue; // Out of bounds, invalid path (should have been eliminated elsewhere? Or maybe just this path is invalid)

                // If `targetVal1` is strictly linked to some `targetVal2`...
                // (We need to check possibilities between Ord1 and Ord2)

                // Check against all candidates for Item2
                for (const cand2 of eligible2) {
                    const targetIdx2 = cand2.idx + clue.offset2;
                    const targetVal2 = ord2Config.values[targetIdx2];
                    if (targetVal2 === undefined) continue;

                    // If we hypothetically choose both candidates:
                    // We assert that (Ord1=v1) IS NOT (Ord2=v2).
                    // If the grid says (Ord1=v1) MUST BE (Ord2=v2), then this combination is invalid.

                    // "MUST BE" means isPossible is true AND it's the ONLY possibility?
                    // Or if (clue.ordinal1, v1, clue.ordinal2, v2) is the only link?

                    // Actually, if grid.isPossible(Ord1, v1, Ord2, v2) is FALSE, then they are already not the same.
                    // If it is TRUE, they MIGHT be the same.
                    // The clue says they are NOT the same.

                    // Wait. "A is NOT B".
                    // Means the cell (A, B) is FALSE.
                    // Here A is (Ord1, v1) and B is (Ord2, v2).
                    // So we effectively add a "IS_NOT" boolean constraint between v1 and v2.
                    // BUT we only know this constraint applies IF Item1 is at cand1 and Item2 is at cand2.

                    // So we can't write to the grid unless we are sure about location?
                    // UNLESS:
                    // If Item1 IS defined (eligible1.length === 1).
                    // Then for every candidate of Item2 (cand2 -> v2),
                    // We know v1 IS_NOT v2.
                    // So we can eliminate v2 from being equal to v1.
                    // i.e., setPossibility(Ord1, v1, Ord2, v2, false)?
                    // YES.
                }
            }

            // Refined Negative Logic:

            // If Item1's derived ordinal value is fixed to V1:
            // Then Item2's derived ordinal value CANNOT be any V2 that is "Equal" to V1.
            // (Where "Equal" means the cell (V1, V2) is true/possible).
            // Actually, "Equal" means referring to the same entity.
            // If we force V1 != V2, we are setting (V1, V2) to false.

            if (eligible1.length === 1) {
                const targetIdx1 = eligible1[0].idx + clue.offset1;
                const v1 = ord1Config.values[targetIdx1];
                if (v1 !== undefined) {
                    // For every candidate of Item2
                    for (const cand2 of eligible2) {
                        const targetIdx2 = cand2.idx + clue.offset2;
                        const v2 = ord2Config.values[targetIdx2];
                        if (v2 !== undefined) {
                            // Link (v1, v2) is FORBIDDEN by this clue.
                            // If this link is the ONLY connection between v1 and v2?
                            // Wait. The clue says: The entity at V1 is NOT the entity at V2.
                            // So grid.setPossibility(Ord1, v1, Ord2, v2, false).

                            // BUT we can only do this if we are SURE Item2 uses v2?
                            // No. If Item2 uses v2, then V1!=V2.
                            // If V1 MUST be V2 (i.e. grid says so), then Item2 CANNOT uses V2.

                            // Logic:
                            // We know EntityA = Entity(Ord1, V1).
                            // We know EntityB = Entity(Ord2, derived from Item2).
                            // Clue: EntityA != EntityB.

                            // If EntityA is fixed (V1).
                            // For a candidate valid for Item2 yielding V2:
                            // If grid says Entity(Ord1,V1) === Entity(Ord2,V2) (Possible relationship),
                            // WE are adding the constraint that EntityA != EntityB.
                            // So if Item2 picks V2, then EntityB is Entity(Ord2,V2).
                            // Is Entity(Ord2,V2) same as Entity(Ord1,V1)?
                            // If they are physically the same slot in the "Person" hidden category?
                            // Our grid models pairwise relationships.
                            // isPossible(Ord1, V1, Ord2, V2) means "Can V1 and V2 belong to the same person?".
                            // The clue says "Person A (V1) is NOT Person B (derived V2)".
                            // So:
                            // If Item2=cand2 (implying Person B has V2),
                            // AND Person A has V1.
                            // AND the clue says Person A != Person B.
                            // DO V1 and V2 refer to the same person?
                            // If `isPossible(V1, V2)` is true, they MIGHT.
                            // Providing the clue says "They are different people",
                            // does that mean V1 and V2 must be incompatible?
                            // NO. "Person A is NOT Person B".
                            // It allows Person A to have Age 20 and Person B to have Height 180 (even if Age 20 usually goes with Height 180? NO).
                            // If Age 20 goes with Height 180, then that's ONE person.
                            // If Person A is Age 20, and Person B is Height 180.
                            // And clue says Person A != Person B.
                            // Then (since Age 20 <-> Height 180 defines ONE person), this state is impossible?
                            // YES. 
                            // Therefore, if V1 and V2 correspond to the SAME person (are 'linked'), then Person A and Person B would be the same.
                            // Since they are NOT the same, then if V1 is linked to V2, we have a contradiction for this candidate.
                            // OR rather: One of the assumptions is wrong.

                            // So:
                            // If (V1, V2) represents the SAME entity (i.e. they are fully linked, or just possibly linked?),
                            // If they are possibly linked, they COULD be the same person.
                            // If the clue says they are DIFFERENT people,
                            // Then we cannot have (Item2 at cand2) AND (Item1 at cand1) both be true IF V1 and V2 are "the same person".
                            // But how do we know if V1 and V2 are the same person?
                            // In our model, V1 and V2 are "Same" if the cell (V1, V2) is TRUE.
                            // Actually, (V1, V2)=TRUE means they exist together on one entity.
                            // If (V1, V2)=FALSE, they cannot be on one entity.

                            // So if Clue says: StartEntity != EndEntity.
                            // And we select V1 for Start and V2 for End.
                            // If (V1, V2) is TRUE, then V1 and V2 coexist on one entity.
                            // Does that mean StartEntity == EndEntity?
                            // YES. Because V1 and V2 belong to the "same row".
                            // So "StartEntity != EndEntity" implies that we cannot pick V1 and V2 such that they coexist.
                            // i.e. We generally expect V1 and V2 to NOT coexist?
                            // Wait.
                            // If I say "The person who is 20 is NOT the person who eats Cake".
                            // Values: 20 (Age), Cake (Snack).
                            // If (20, Cake) is TRUE (Possible), then there is a person who is 20 and eats Cake.
                            // The clue says: Person(20) != Person(Cake).
                            // This means the Person(20) CANNOT be the Person(Cake).
                            // So the person who is 20 must NOT eat Cake.
                            // So (20, Cake) must be FALSE.

                            // CORRECT.
                            // "Person A != Person B" translates to "Properties of A are not Properties of B"?
                            // Specifically, if A is defined by Property P1, and B by P2.
                            // Then P1 is incompatible with P2.
                            // So `isPossible(P1, P2)` must be set to `false`.

                            // So, back to the implementation:
                            // IF we know P1 (Item1's derived val) and P2 (Item2's derived val),
                            // THEN `grid.setPossibility(P1, P2, false)`.

                            // If we DON'T know P1 uniquely?
                            // If P1 could be {A, B} and P2 is {C}.
                            // Then (A, C) is false AND (B, C) is false.
                            // i.e. ALL potential pairings of P1 and P2 are false.

                            // So for every pair of candidates:
                            // If Item1=cand1 implies Val1, and Item2=cand2 implies Val2.
                            // Then (Val1, Val2) must be FALSE.
                            // BUT we only enforce this if Item1=cand1 AND Item2=cand2 are actually true.
                            // We don't know they are true.

                            // However, if for ALL candidates of Item1, the derived Val1 is the SAME (fixed),
                            // Then we know P1 is fixed.
                            // Then for ALL candidates of Item2, the derived Val2 must be incompatible with P1.
                            // So `setPossibility(Ord1, fixedV1, Ord2, candVal2, false)`.
                            // Wait, if Item2 has multiple candidates, we can eliminate the ones that are compatible with P1?
                            // Yes.
                            // If Item2=candX implies ValX, and (ValX is compatible with P1), then Item2 CANNOT be candX.
                            // Because if Item2=candX, Person B has ValX. Person A has P1.
                            // If ValX and P1 are compatible, they COULD be the same person.
                            // Wait. "Person A != Person B".
                            // If ValX and P1 are compatible (i.e. theoretically same person allowed),
                            // but we are imposing they are DIFFERENT.
                            // Does that mean ValX cannot be P1?
                            // If ValX and P1 are just values in different categories...
                            // If they are compatible, they describe the same entity.
                            // If the clue says "Entity A != Entity B", can Entity A have ValX and Entity B have P1?
                            // Only if ValX and P1 map to DIFFERENT entities?
                            // But (ValX, P1) = TRUE means they map to SAME entity.
                            // So "Entity A != Entity B" means we cannot have a situation where Entity A has P1 and Entity B has ValX IF (P1, ValX) implies Same Entity (which it does in our grid).
                            // So YES. (P1, ValX) must be FALSE.

                            // THEREFORE:
                            // If P1 is fixed.
                            // For each candidate cand2 of Item2 (yielding Val2):
                            // We enforce (P1, Val2) = FALSE.
                            // If (P1, Val2) WAS currently TRUE (possible), then this candidate forces a contradiction with the Clue.
                            // So Item2 CANNOT be cand2.
                            // Eliminate cand2.

                            if (grid.isPossible(clue.ordinal1, v1, clue.ordinal2, v2)) {
                                grid.setPossibility(clue.item2Cat, clue.item2Val, clue.ordinal2, cand2.val, false);
                                deductions++;
                            }
                        }
                    }
                }
            }

            // Symmetric for Eligible2 fixed
            if (eligible2.length === 1) {
                const targetIdx2 = eligible2[0].idx + clue.offset2;
                const v2 = ord2Config.values[targetIdx2];
                if (v2 !== undefined) {
                    for (const cand1 of eligible1) {
                        const targetIdx1 = cand1.idx + clue.offset1;
                        const v1 = ord1Config.values[targetIdx1];
                        if (v1 !== undefined) {
                            if (grid.isPossible(clue.ordinal1, v1, clue.ordinal2, v2)) {
                                grid.setPossibility(clue.item1Cat, clue.item1Val, clue.ordinal1, cand1.val, false);
                                deductions++;
                            }
                        }
                    }
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
