import { CategoryConfig, CategoryType } from './types';

/**
 * A default set of categories for a standard logic puzzle (Name, Snack, Age).
 */
export const DEFAULT_CATEGORIES: CategoryConfig[] = [
    {
        id: 'Name',
        type: CategoryType.NOMINAL,
        values: ['Alice', 'Bob', 'Charlie', 'David'],
    },
    {
        id: 'Snack',
        type: CategoryType.NOMINAL,
        values: ['Chips', 'Popcorn', 'Candy', 'Chocolate'],
    },
    {
        id: 'Age',
        type: CategoryType.ORDINAL,
        values: [20, 30, 40, 50],
    },
];
