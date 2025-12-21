import { CategoryConfig } from '../../src/types';

export interface CategoryLabels {
    groupName?: string;       // "person", "suspect", "animal"
    includeGroupName?: boolean; // Whether to say "the suspect Mustard" or just "Mustard"
    valuePrefix?: string;     // e.g. "the", "a"
    valueSuffix?: string;     // e.g. "gold", "years old"
    subjectPrefix?: string;   // e.g. "the person with", "the suspect whose motive is"
    isPossessive?: boolean;   // e.g. if true, use "Mustard's motive" phrasing
    verb?: string;            // "is", "was", "has", "is in"
    verbNegated?: string;     // "is not", "does not have", "is not in"
    ordinalBefore?: string;   // "younger", "lower", "before", "fewer than"
    ordinalAfter?: string;    // "older", "higher", "after"
    superlativeFirst?: string; // "youngest", "lowest", "first"
    superlativeLast?: string;  // "oldest", "highest", "last"
}

export interface AppCategoryConfig extends CategoryConfig {
    displayType?: 'text' | 'date';
    labels: CategoryLabels;
}
