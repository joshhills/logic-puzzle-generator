/**
 * A primitive value that acts as a label for an entity (e.g., "Alice", 42).
 */
export type ValueLabel = string | number;

/**
 * Defines the nature of a category's values.
 */
export enum CategoryType {
    /** Order is irrelevant (e.g., Name, Genre). */
    NOMINAL,
    /** Order is crucial for comparisons (e.g., Age, Price). Values must be numbers. */
    ORDINAL,
}

/**
 * Configuration for a single category in the puzzle.
 */
export interface CategoryConfig {
    /** Unique internal identifier for the category (e.g., 'Name'). */
    id: string;
    /** The type of data this category holds. */
    type: CategoryType;
    /** The list of possible values. Must be unique. If ORDINAL, they must be sorted. */
    values: ValueLabel[];
}

/**
 * Represents the complete solution to the puzzle (the "answer key").
 * Structure: { CategoryID -> { Value -> CorrectValueInOtherCategory } }
 */
export type Solution = Record<string, Record<string, ValueLabel>>;

/**
 * A specific correlation that the puzzle solver aims to deduce as the final answer.
 */
export interface TargetFact {
    category1Id: string;
    value1: ValueLabel;
    category2Id: string;
}

/**
 * Enumeration of all supported clue types.
 */
export enum ClueType {
    /** Expresses a direct relationship (IS or IS NOT) between two values. */
    BINARY,
    /** Expresses a comparison (GREATER THAN or LESS THAN) between two values based on an ordinal category. */
    ORDINAL,
    /** Expresses an extreme value relationship (MIN or MAX) within an ordinal category. */
    SUPERLATIVE,
    /** Expresses a property of a single value (e.g., IS EVEN) relative to an ordinal category. */
    UNARY,
    /** Expresses a relationship between relative positions in two different ordinal categories. */
    CROSS_ORDINAL,
    /** Expresses that a value is strictly between two other values on an ordinal scale. */
    BETWEEN,
    /** Expresses that two values are adjacent (indices differ by 1) on an ordinal scale. */
    ADJACENCY,
    /** Expresses valid disjunction: At least one of the sub-clues is true. */
    OR,
    /** Expresses that the difference between two values is equal to the difference between two other values. */
    ARITHMETIC,
}

export enum CrossOrdinalOperator {
    MATCH,
    NOT_MATCH,
}

export enum BinaryOperator {
    IS,
    IS_NOT,
}

export enum OrdinalOperator {
    GREATER_THAN,
    LESS_THAN,
    NOT_GREATER_THAN,
    NOT_LESS_THAN,
}

export enum SuperlativeOperator {
    MIN,
    MAX,
    NOT_MIN,
    NOT_MAX,
}

export enum UnaryFilter {
    IS_ODD,
    IS_EVEN,
}

/**
 * Configuration for constraining the types of clues generated.
 */
export interface ClueGenerationConstraints {
    /**
     * If provided, only clues of these types will be generated.
     * Use this to control difficulty or puzzle attributes.
     */
    allowedClueTypes?: ClueType[];
    /**
     * If provided, only clues that refer to these specific values (as subjects or objects) will be generated.
     * Useful for "Ask this suspect" mechanics.
     */
    includeSubjects?: string[];
    /**
     * If provided, clues referring to these values will be excluded.
     */
    excludeSubjects?: string[];
    /**
     * Minimum number of new deductions this clue must provide to be considered valid.
     * Default is 0 (allow all clues). Set to 1 to ensure progress.
     */
    minDeductions?: number;
    /**
     * Maximum number of new deductions this clue is allowed to provide.
     * Useful for finding low-impact or "filler" clues, or ensuring a clue isn't *too* powerful.
     */
    maxDeductions?: number;

    // Future extension points:
    // allowedBinaryOperators?: BinaryOperator[];
    // allowNegation?: boolean; 
}

export interface DeductionReason {
    type: 'elimination' | 'confirmation' | 'uniqueness' | 'transitivity' | 'clue' | 'unary' | 'ordinal' | 'cross_ordinal' | 'disjunction' | 'between';
    description: string;
    cells?: { cat: string, val: ValueLabel }[];
}
