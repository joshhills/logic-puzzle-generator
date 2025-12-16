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
