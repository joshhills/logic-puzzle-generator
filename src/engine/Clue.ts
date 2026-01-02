import {
    ValueLabel,
    ClueType,
    BinaryOperator,
    OrdinalOperator,
    SuperlativeOperator,
    UnaryFilter,
    CrossOrdinalOperator
} from '../types';

export { ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, CrossOrdinalOperator };

/**
 * A clue that establishes a direct link or separation between two specific values.
 * Example: "Alice likes Horror movies." (IS)
 * Example: "Bob does not like Comedy." (IS_NOT)
 */
export interface BinaryClue {
    type: ClueType.BINARY;
    operator: BinaryOperator;
    cat1: string;
    val1: ValueLabel;
    cat2: string;
    val2: ValueLabel;
}

/**
 * A clue that compares two entities based on a third ordinal category.
 * Example: "The person who likes Horror is older than Alice."
 */
export interface OrdinalClue {
    type: ClueType.ORDINAL;
    operator: OrdinalOperator;
    item1Cat: string;
    item1Val: ValueLabel;
    item2Cat: string;
    item2Val: ValueLabel;
    /** The ordinal category used for comparison (e.g., "Age"). */
    ordinalCat: string;
}

/**
 * A clue that identifies an entity as having an extreme value in an ordinal category.
 * Example: "The person who likes Popcorn is the oldest."
 */
export interface SuperlativeClue {
    type: ClueType.SUPERLATIVE;
    operator: SuperlativeOperator;
    targetCat: string;
    targetVal: ValueLabel;
    /** The ordinal category (e.g., "Age") where the value is extreme. */
    ordinalCat: string;
}

/**
 * A clue that filters a value based on a property of its associated ordinal value.
 * Example: "The person who likes Chips has an even age."
 */
export interface UnaryClue {
    type: ClueType.UNARY;
    filter: UnaryFilter;
    targetCat: string;
    targetVal: ValueLabel;
    ordinalCat: string;
}

/**
 * A clue that links relative positions across two ordinal categories.
 * Example: "The person immediately before [Item A] in [Cat 1] is the same as the person immediately after [Item B] in [Cat 2]."
 */
export interface CrossOrdinalClue {
    type: ClueType.CROSS_ORDINAL;
    operator: CrossOrdinalOperator;
    /** The first anchor entity */
    item1Cat: string;
    item1Val: ValueLabel;
    /** The ordinal category for the first relation */
    ordinal1: string;
    /** The offset from the anchor (-1 = before, +1 = after) */
    offset1: number;

    /** The second anchor entity */
    item2Cat: string;
    item2Val: ValueLabel;
    /** The ordinal category for the second relation */
    ordinal2: string;
    /** The offset from the anchor (-1 = before, +1 = after) */
    offset2: number;
}

/**
 * Union type representing any valid clue.
 */
export type Clue = BinaryClue | OrdinalClue | SuperlativeClue | UnaryClue | CrossOrdinalClue;

/**
 * Extension for clues with metadata attached during generation/solving.
 */
export type ClueWithMetadata = Clue & {
    deductions?: number;
    updates?: number;
    percentComplete?: number;
};
