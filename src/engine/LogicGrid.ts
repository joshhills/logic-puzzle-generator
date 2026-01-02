import { CategoryConfig, CategoryType, ValueLabel } from '../types';
import { ConfigurationError } from '../errors';

/**
 * Represents the state of the logic puzzle grid.
 * 
 * It manages the possibilities between every pair of values across different categories.
 * The grid is initialized where all connections are possible (true).
 * As clues are applied, possibilities are eliminated (set to false).
 */
export class LogicGrid {
    private grid: Map<string, Map<ValueLabel, Map<string, boolean[]>>>;
    private categories: CategoryConfig[];

    private valueMap: Map<string, Map<ValueLabel, number>>;

    /**
     * Creates a new LogicGrid instance.
     * 
     * @param categories - The configuration of categories and their values for the puzzle.
     * @throws {Error} If the configuration is invalid (duplicate IDs, duplicate values, or mismatched value counts).
     */
    constructor(categories: CategoryConfig[]) {
        this.validateConfig(categories);
        this.categories = categories;
        this.valueMap = new Map(categories.map(c => [c.id, new Map(c.values.map((v, i) => [v, i]))]));
        this.grid = new Map();

        for (const cat1 of categories) {
            const cat1Map = new Map<ValueLabel, Map<string, boolean[]>>();
            for (const val1 of cat1.values) {
                const cat2Map = new Map<string, boolean[]>();
                for (const cat2 of categories) {
                    if (cat1.id === cat2.id) continue;
                    cat2Map.set(cat2.id, Array(cat2.values.length).fill(true));
                }
                cat1Map.set(val1, cat2Map);
            }
            this.grid.set(cat1.id, cat1Map);
        }
    }

    private validateConfig(categories: CategoryConfig[]): void {
        const catIds = new Set<string>();
        let expectedSize = -1;

        for (const cat of categories) {
            if (catIds.has(cat.id)) {
                throw new ConfigurationError(`Duplicate category ID found: ${cat.id}`);
            }
            catIds.add(cat.id);

            const uniqueValues = new Set(cat.values);
            if (uniqueValues.size !== cat.values.length) {
                throw new ConfigurationError(`Category '${cat.id}' has duplicate values.`);
            }

            if (expectedSize === -1) {
                expectedSize = cat.values.length;
            } else if (cat.values.length !== expectedSize) {
                throw new ConfigurationError(`Category '${cat.id}' has ${cat.values.length} values, expected ${expectedSize}. All categories must be the same size.`);
            }
        }
    }

    /**
     * Sets the possibility state between two values from different categories.
     * 
     * @param cat1Id - The ID of the first category.
     * @param val1 - The value from the first category.
     * @param cat2Id - The ID of the second category.
     * @param val2 - The value from the second category.
     * @param state - true if the connection is possible, false if eliminated.
     */
    public setPossibility(cat1Id: string, val1: ValueLabel, cat2Id: string, val2: ValueLabel, state: boolean): void {
        const val2Index = this.valueMap.get(cat2Id)?.get(val2);
        if (val2Index !== undefined) {
            const cat1Map = this.grid.get(cat1Id);
            if (cat1Map) {
                const val1Map = cat1Map.get(val1);
                if (val1Map) {
                    const cat2Arr = val1Map.get(cat2Id);
                    if (cat2Arr) {
                        cat2Arr[val2Index] = state;
                    }
                }
            }
        }

        const val1Index = this.valueMap.get(cat1Id)?.get(val1);
        if (val1Index !== undefined) {
            const cat2Map = this.grid.get(cat2Id);
            if (cat2Map) {
                const val2Map = cat2Map.get(val2);
                if (val2Map) {
                    const cat1Arr = val2Map.get(cat1Id);
                    if (cat1Arr) {
                        cat1Arr[val1Index] = state;
                    }
                }
            }
        }
    }

    /**
     * Checks if a connection between two values is currently possible.
     * 
     * @param cat1Id - The ID of the first category.
     * @param val1 - The value from the first category.
     * @param cat2Id - The ID of the second category.
     * @param val2 - The value from the second category.
     * @returns true if the connection is possible, false otherwise.
     */
    public isPossible(cat1Id: string, val1: ValueLabel, cat2Id: string, val2: ValueLabel): boolean {
        // Identity check
        if (cat1Id === cat2Id) {
            return val1 === val2;
        }

        const val2Index = this.valueMap.get(cat2Id)?.get(val2);
        if (val2Index === undefined) return false;

        const cat1Grid = this.grid.get(cat1Id);
        if (!cat1Grid) return false;
        const val1Grid = cat1Grid.get(val1);
        if (!val1Grid) return false;
        const cat2Arr = val1Grid.get(cat2Id);
        if (!cat2Arr) return false;

        return cat2Arr[val2Index];
    }

    /**
     * Gets the number of possible connections for a specific value in one category
     * relative to another category.
     * 
     * @param cat1Id - The ID of the starting category.
     * @param val1 - The value from the starting category.
     * @param cat2Id - The target category ID.
     * @returns The number of values in cat2 that are still possible for val1.
     */
    public getPossibilitiesCount(cat1Id: string, val1: ValueLabel, cat2Id: string): number {
        const possibilities = this.grid.get(cat1Id)?.get(val1)?.get(cat2Id);
        if (!possibilities) return 0;
        return possibilities.filter(p => p).length;
    }

    /**
     * Calculates statistics about the current state of the grid.
     * 
     * @returns An object containing:
     *  - totalPossible: The initial total logical connections.
     *  - currentPossible: The number of remaining possible connections.
     *  - solutionPossible: The target number of connections for a solved grid.
     */
    public getGridStats(): { totalPossible: number; currentPossible: number; solutionPossible: number; } {
        let currentPossible = 0;
        const catCount = this.categories.length;
        const valCount = this.categories[0]?.values.length || 0;

        if (valCount === 0 || catCount < 2) {
            return { totalPossible: 0, currentPossible: 0, solutionPossible: 0 };
        }

        const numPairs = catCount * (catCount - 1) / 2;
        const totalPossible = numPairs * valCount * valCount;
        const solutionPossible = numPairs * valCount;

        for (const cat1 of this.categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of this.categories) {
                    if (cat1.id >= cat2.id) continue;

                    const possibilities = this.grid.get(cat1.id)?.get(val1)?.get(cat2.id);
                    if (possibilities) {
                        currentPossible += possibilities.filter(p => p).length;
                    }
                }
            }
        }

        return { totalPossible, currentPossible, solutionPossible };
    }

    /**
     * Creates a deep copy of the current LogicGrid.
     * 
     * @returns A new LogicGrid instance with the exact same state.
     */
    public clone(): LogicGrid {
        const newGrid = new LogicGrid(this.categories);
        newGrid.grid = new Map(
            [...this.grid.entries()].map(([cat1Id, cat1Map]) => [
                cat1Id,
                new Map(
                    [...cat1Map.entries()].map(([val1, val1Map]) => [
                        val1,
                        new Map(
                            [...val1Map.entries()].map(([cat2Id, cat2Arr]) => [
                                cat2Id,
                                [...cat2Arr],
                            ])
                        ),
                    ])
                ),
            ])
        );
        return newGrid;
    }
    /**
     * Compares this grid with a previous state and counts visual updates.
     * A "Visual Update" is defined as:
     * 1. A cell changing from Possible (True) to Eliminated (False) [Red Cross]
     * 2. A cell changing from Ambiguous (Count > 1) to Unique (Count == 1) [Green Check]
     * 
     * @param prevGrid - The previous grid state.
     * @returns The number of visual updates.
     */
    public compareVisualState(prevGrid: LogicGrid): number {
        let updates = 0;
        const categories = this.categories;

        for (const cat1 of categories) {
            for (const val1 of cat1.values) {
                for (const cat2 of categories) {
                    if (cat1.id >= cat2.id) continue;

                    // 1. Check for Red Crosses (True -> False)
                    // We iterate individual cells
                    const val1Map = this.grid.get(cat1.id)?.get(val1);
                    const prevVal1Map = prevGrid.grid.get(cat1.id)?.get(val1);

                    if (val1Map && prevVal1Map) {
                        const vals2Arr = val1Map.get(cat2.id);
                        const prevVals2Arr = prevVal1Map.get(cat2.id);

                        if (vals2Arr && prevVals2Arr) {
                            for (let i = 0; i < vals2Arr.length; i++) {
                                // If it WAS true and IS NOW false
                                if (prevVals2Arr[i] && !vals2Arr[i]) {
                                    updates++;
                                }
                            }
                        }
                    }

                    // 2. Check for Green Checks (Ambiguous -> Unique)
                    // We check the Row Context (Possibilities Count)
                    const prevCount = prevGrid.getPossibilitiesCount(cat1.id, val1, cat2.id);
                    const currCount = this.getPossibilitiesCount(cat1.id, val1, cat2.id);

                    if (prevCount > 1 && currCount === 1) {
                        updates++;
                    }
                }
            }
        }
        return updates;
    }
}
