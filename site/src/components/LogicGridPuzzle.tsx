import React from 'react';
import { LogicGrid, CategoryConfig } from '../../../src/index';
import { AppCategoryConfig } from '../types';
import { ComparisonGrid } from './ComparisonGrid';

interface HoverState {
    gridRow: number;
    gridCol: number;
    rowValIndex: number;
    colValIndex: number;
    rowCatId: string;
    colCatId: string;
    rowVal: string | number;
    colVal: string | number;
}

interface LogicGridPuzzleProps {
    categories: AppCategoryConfig[];
    grid: LogicGrid;
    targetFact?: {
        category1Id: string;
        value1: string;
        category2Id: string;
    };
    // Play Mode
    viewMode?: 'solution' | 'play';
    userPlayState?: Record<string, 'T' | 'F'>;
    checkAnswers?: boolean;
    solution?: Record<string, Record<string, string | number>>;
    onInteract?: (c1: string, v1: string | number, c2: string, v2: string | number) => void;
}

export const LogicGridPuzzle: React.FC<LogicGridPuzzleProps> = ({ categories, grid, targetFact, viewMode = 'solution', userPlayState, checkAnswers, solution, onInteract }) => {
    const [activeHover, setActiveHover] = React.useState<HoverState | null>(null);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!categories || categories.length < 2) return <div>Invalid Categories</div>;

    // Helper for Date Formatting
    const formatValue = (val: string | number, cat: AppCategoryConfig) => {
        if (cat.displayType === 'date') {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                // Short format: "Jan 1, 23"
                return new Date(num).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
            }
        }
        return val;
    };

    // 1. Setup Axes
    // Top Axis: C[1] ... C[N-1]
    const topCategories = categories.slice(1);

    // Left Axis: C[0], then C[N-1] down to C[2]
    const leftCategories = [
        categories[0],
        ...categories.slice(2).reverse()
    ];

    const cellSize = isMobile ? 28 : 40; // match ComparisonGrid
    const labelSize = isMobile ? 80 : 100;

    const isHeaderHighlighted = (axis: 'row' | 'col', catIndex: number, valIndex: number) => {
        if (!activeHover) return false;
        if (axis === 'col') {
            return activeHover.gridCol === catIndex && activeHover.colValIndex === valIndex;
        } else {
            return activeHover.gridRow === catIndex && activeHover.rowValIndex === valIndex;
        }
    };

    return (
        <div style={{ display: 'inline-block' }} className="logic-grid-container" role="grid" aria-label="Logic Puzzle Grid">
            <div style={{ display: 'grid', gridTemplateColumns: `${labelSize}px repeat(${topCategories.length}, auto)` }}>
                {/* Header Row */}
                <div /* Top-Left Corner (Empty) */ />
                {topCategories.map((cat, i) => (
                    <div key={`header-${cat.id}`} style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{cat.id}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            {cat.values.map((val: string | number, valIndex: number) => {
                                const active = isHeaderHighlighted('col', i, valIndex);
                                const displayVal = formatValue(val, cat);
                                return (
                                    <div key={valIndex} className="header-cell" style={{
                                        width: `${cellSize}px`,
                                        writingMode: 'vertical-rl',
                                        transform: 'rotate(180deg)',
                                        height: '80px', // More space for text
                                        fontSize: '0.8em',
                                        display: 'flex',
                                        alignItems: 'center', // Centers text in the 'strip'
                                        justifyContent: 'flex-start', // Starts text at the 'top' (which is bottom due to rotation)
                                        // Actually with 180 rotation:
                                        // 'flex-start' is visual top (pre-rotation). Rotated 180 -> visual bottom.
                                        // Let's try 'flex-start' logic.
                                        backgroundColor: active ? '#e0f2fe' : 'transparent',
                                        color: active ? '#000' : 'inherit',
                                        fontWeight: active ? 'bold' : 'normal',
                                        borderRadius: '4px'
                                    }}>
                                        <span style={{ paddingBottom: '4px' }}>{displayVal}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Rows */}
                {leftCategories.map((rowCat, rowIndex) => (
                    <React.Fragment key={`row-${rowCat.id}`}>
                        {/* Row Label */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '25px 1fr', // Fixed width for Title
                            gap: '8px',
                            justifyContent: 'end',
                            height: '100%',
                            paddingRight: '10px',
                        }}>
                            {/* Category Name Rotated */}
                            <div style={{
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%' // Force fill
                            }}>
                                {rowCat.id}
                            </div>

                            {/* Values Stack */}
                            <div style={{ fontSize: '0.8em', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '2px' }}>
                                {rowCat.values.map((v: string | number, vIndex: number) => {
                                    const active = isHeaderHighlighted('row', rowIndex, vIndex);
                                    const displayVal = formatValue(v, rowCat);
                                    return (
                                        <div key={vIndex} className="header-cell" style={{
                                            height: `${cellSize}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            backgroundColor: active ? '#e0f2fe' : 'transparent',
                                            color: active ? '#000' : 'inherit',
                                            fontWeight: active ? 'bold' : 'normal',
                                            paddingRight: '4px',
                                            borderRadius: '4px'
                                        }}>

                                            {displayVal}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grid Cells */}
                        {topCategories.map((colCat, colIndex) => {
                            // Check Validity
                            if (rowCat.id === colCat.id) {
                                return <div key={`empty-${rowCat.id}-${colCat.id}`} />;
                            }

                            // Check Redundancy
                            // We only render if (row, col) is unique.
                            // The standard logic is we populate the Triangle.
                            // The "Left Axis" construction [0, N..2] is designed specifically so that:
                            // Row 0 (A) captures all.
                            // Row 1 (Last) captures all EXCEPT (Last, Last).

                            // Let's do a simple check: Have we rendered this PAIR before?
                            // Actually, given strict layout, we can just block the "diagonal" and "below diagonal".
                            // But since our axis are swizzled, simple i<=j checks don't work trivially.

                            // Let's use the explicit exclusion rule:
                            // Exclude if colIndex > (somewhere).

                            // Let's trace N=4.
                            // Top: 1(B), 2(C), 3(D)
                            // Left: 0(A), 3(D), 2(C)

                            // R0(A) vs B, C, D -> All Good (Since A is never in Top)
                            // R1(D) vs B, C, D -> (D,B) Good. (D,C) Good. (D,D) Bad.
                            // R2(C) vs B, C, D -> (C,B) Good. (C,C) Bad. (C,D)?
                            // Wait, (C,D) is effectively (D,C) which we did in R1.

                            // Rule: Render if rowCat.index < colCat.index? No.
                            // Rule: Render if the pair hasn't be done?
                            // Since we iterate deterministically, we can just check:
                            // Is this pair (rowCat, colCat) present in a 'previous' row's connections?

                            // Actually, looking at the pattern:
                            // The shapes form a triangle.
                            // Row 0 fills entirely.
                            // Row 1 fills until it hits itself?

                            // Let's just check ids.
                            // If we view ids as indices 0..N-1.
                            // We want unique pairs {a, b} where a != b.
                            // We are visiting (Left[r], Top[c]).
                            // We should only render if we haven't rendered {Left[r], Top[c]} yet.
                            // But that requires state or global knowledge.

                            // Easier Rule for this specific layout:
                            // Render if rowIndex + colIndex < N - 1?
                            // R0(A) + C0(B) = 0? No.

                            // Let's rely on checking the ID comparison.
                            // Is it simpler to just check:
                            // A pair is (C1, C2).
                            // If C1 == C2, skip.
                            // If we already did (C2, C1), skip.
                            // In this specific iteration order:
                            // R0(A): (A,B), (A,C), (A,D). (A is unique to Left). Keep all.
                            // R1(D): (D,B), (D,C), (D,D). (D,D) skip. (D,B), (D,C) keep?
                            // R2(C): (C,B), (C,C), (C,D). (C,C) skip. (C,B) keep. (C,D) skip (D,C exists).
                            // 
                            // How do we know (D,C) exists? D is in Left (visited). C is in Top.
                            // In row D (previous), we visited col C. So (D,C) is done.
                            // Now in row C, we visit col D. So (C,D) is redundant.

                            // So valid if: rowCat is NOT present in TopCategories-to-the-right-of-current-colCat?
                            // No.

                            // Let's use the layout visual rule:
                            // Render if colIndex < (topColumns - rowIndex)? 
                            // R0 (idx 0). TopCols=3. Render 3. (0 < 3, 1 < 3, 2 < 3). OK.
                            // R1 (idx 1). Render 2? (D: B, C). (0 < 2, 1 < 2). OK. (Col D is idx 2. 2 < 2 False). OK.
                            // R2 (idx 2). Render 1? (C: B). (0 < 1). OK. (Col C is idx 1. 1 < 1 False). OK.
                            //
                            // Formula: Render if colIndex < (topCategories.length - rowIndex).
                            // Let's verify N=4.
                            // TopLen = 3.
                            // R0: loops 0..2. All < 3-0=3. OK.
                            // R1: loops 0..2. Needs 0,1. Limit 3-1=2. (0<2 ok, 1<2 ok, 2<2 skip). Matches (D,B), (D,C). Skips (D,D). Correct.
                            // R2: loops 0..2. Needs 0. Limit 3-2=1. (0<1 ok, 1<1 skip). Matches (C,B). Skips (C,C), (C,D). Correct.

                            const limit = topCategories.length - rowIndex;
                            const shouldRender = colIndex < limit;

                            if (!shouldRender) {
                                return <div key={`skip-${rowCat.id}-${colCat.id}`} />;
                            }

                            // Edge Detection Logic
                            // Right Edge: The last rendered column in this row.
                            // ... (Logic removed as props are removed)

                            return (
                                <div key={`grid-${rowCat.id}-${colCat.id}`} style={{ padding: '0px', lineHeight: 0, fontSize: 0 }}>
                                    <ComparisonGrid
                                        grid={grid}
                                        rowCategory={rowCat}
                                        colCategory={colCat}

                                        // Layout Coords
                                        gridIndexRow={rowIndex}
                                        gridIndexCol={colIndex}
                                        cellSize={cellSize}

                                        // Hover State
                                        activeHover={activeHover}
                                        onHover={(rIdx, cIdx, rVal, cVal) => {
                                            if (rIdx === undefined) {
                                                setActiveHover(null);
                                            } else {
                                                setActiveHover({
                                                    gridRow: rowIndex,
                                                    gridCol: colIndex,
                                                    rowValIndex: rIdx!,
                                                    colValIndex: cIdx!,
                                                    rowCatId: rowCat.id,
                                                    colCatId: colCat.id,
                                                    rowVal: rVal!,
                                                    colVal: cVal!
                                                });
                                            }
                                        }}

                                        targetFact={targetFact}

                                        // Play Mode
                                        viewMode={viewMode}
                                        userPlayState={userPlayState}
                                        checkAnswers={checkAnswers}
                                        solution={solution}
                                        onInteract={onInteract}
                                    />
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}

                {/* 
                   Wait, we need Column Value Labels!
                   The top axis currently just shows "Name".
                   It needs to show "Alice Bob Charlie".
                   And they need to align heavily with the grid cells.
                */}
            </div >

            {/* 
               Correction:
               The Top Axis 'div' needs to render the values of that category horizontally.
               I should update the header loop above.
            */}
        </div >
    );
};
