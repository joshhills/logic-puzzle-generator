import React from 'react';
import { LogicGrid, CategoryConfig } from '../../../src/index';

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

interface ComparisonGridProps {
    grid: LogicGrid;
    rowCategory: CategoryConfig;
    colCategory: CategoryConfig;

    // Layout Coords
    gridIndexRow: number;
    gridIndexCol: number;

    // Hover State
    activeHover?: HoverState | null;
    onHover?: (
        rowValIndex?: number,
        colValIndex?: number,
        rowVal?: string | number,
        colVal?: string | number
    ) => void;

    targetFact?: {
        category1Id: string;
        value1: string;
        category2Id: string;
    };

    // Play Mode
    viewMode?: 'solution' | 'play';
    userPlayState?: Record<string, 'T' | 'F'>;
    onInteract?: (c1: string, v1: string | number, c2: string, v2: string | number) => void;
}

export const ComparisonGrid: React.FC<ComparisonGridProps> = ({
    grid,
    rowCategory,
    colCategory,
    gridIndexRow,
    gridIndexCol,
    activeHover,
    onHover,
    targetFact,
    viewMode = 'solution',
    userPlayState,
    onInteract
}) => {
    const cellSize = 40;

    // Check for Target Fact Overlays
    let rowOverlayIndex = -1;
    let colOverlayIndex = -1;

    if (targetFact) { // Always show helper target
        // Is this grid relevant? (Cat1 vs Cat2)
        const isCat1Row = rowCategory.id === targetFact.category1Id;
        const isCat2Row = rowCategory.id === targetFact.category2Id;
        const isCat1Col = colCategory.id === targetFact.category1Id;
        const isCat2Col = colCategory.id === targetFact.category2Id;

        // Valid pairs: (Cat1, Cat2) or (Cat2, Cat1)
        if ((isCat1Row && isCat2Col) || (isCat2Row && isCat1Col)) {
            // If Row is Cat1, overlay on Value1
            if (isCat1Row) {
                rowOverlayIndex = rowCategory.values.indexOf(targetFact.value1);
            }
            // If Col is Cat1, overlay on Value1
            if (isCat1Col) {
                colOverlayIndex = colCategory.values.indexOf(targetFact.value1);
            }
        }
    }

    return (
        <div
            className="comparison-grid"
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${colCategory.values.length}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rowCategory.values.length}, ${cellSize}px)`,
                border: '2px solid #555',
                marginRight: '-2px',
                marginBottom: '-2px',
                gap: '1px',
                backgroundColor: '#888',
                position: 'relative', // For overlays
            }}
            onMouseLeave={() => onHover && onHover(undefined, undefined, undefined, undefined)}
        >
            {rowCategory.values.map((rowVal: string | number, rowValIndex: number) =>
                colCategory.values.map((colVal: string | number, colValIndex: number) => {

                    let content = '';
                    let bgColor = '#fff';
                    let color = '#000';
                    let isPossible = true;

                    if (viewMode === 'play') {
                        // --- PLAY MODE RENDER ---
                        // Key generation must match App.tsx (Sorted Ids)
                        const [cA, cB] = [rowCategory.id, colCategory.id].sort();
                        const [vA, vB] = cA === rowCategory.id ? [rowVal, colVal] : [colVal, rowVal];
                        const key = `${cA}:${cB}:${vA}:${vB}`;
                        const userMark = userPlayState?.[key];

                        if (userMark === 'F') {
                            content = '✕';
                            color = '#ef4444'; // Red for X
                            bgColor = '#fff'; // Keep white background for cleanliness
                        } else if (userMark === 'T') {
                            content = '✓';
                            color = '#10b981'; // Green for Tick
                            bgColor = '#ecfdf5'; // Light green bg
                        }
                    } else {
                        // --- SOLUTION MODE RENDER ---
                        isPossible = grid.isPossible(rowCategory.id, rowVal, colCategory.id, colVal);

                        if (!isPossible) {
                            content = '✕';
                            color = '#ff6b6b'; // Light red
                            bgColor = '#f9f9f9';
                        } else {
                            const rowPoss = grid.getPossibilitiesCount(rowCategory.id, rowVal, colCategory.id);
                            const colPoss = grid.getPossibilitiesCount(colCategory.id, colVal, rowCategory.id);

                            if (rowPoss === 1 && colPoss === 1) {
                                content = '✓';
                                color = '#2ecc71';
                                bgColor = '#e8f8f5';
                            }
                        }
                    }

                    // L-Shape Hover Logic
                    let isRowHighlighted = false;
                    let isColHighlighted = false;

                    if (activeHover) {
                        // Row Highlight: If this cell is "Left Of" or "At" the active cursor (in relevant grid columns)
                        // Relevant Grid Columns: Any grid that is to the LEFT of the active Grid Col.
                        // OR Same Grid Col, but cell column index <= active cell column index.

                        // Condition 1: Same Row Value? (Must align horizontally)
                        if (rowCatIdCheck(activeHover.rowCatId, rowCategory.id) && activeHover.rowVal === rowVal) {
                            if (gridIndexCol < activeHover.gridCol) {
                                isRowHighlighted = true;
                            } else if (gridIndexCol === activeHover.gridCol && colValIndex <= activeHover.colValIndex) {
                                isRowHighlighted = true;
                            }
                        }

                        // Col Highlight: If this cell is "Above" or "At" the active cursor (in relevant grid rows)
                        if (colCatIdCheck(activeHover.colCatId, colCategory.id) && activeHover.colVal === colVal) {
                            if (gridIndexRow < activeHover.gridRow) {
                                isColHighlighted = true;
                            } else if (gridIndexRow === activeHover.gridRow && rowValIndex <= activeHover.rowValIndex) {
                                isColHighlighted = true;
                            }
                        }
                    }

                    // Hover color blending
                    if ((isRowHighlighted || isColHighlighted) && viewMode === 'play') {
                        if (bgColor === '#fff' || bgColor === '#ecfdf5') {
                            bgColor = '#f3f4f6'; // Light grey hover
                        }
                    } else if (viewMode === 'solution') {
                        if ((isRowHighlighted || isColHighlighted) && bgColor === '#fff') {
                            bgColor = '#e0f2fe';
                        } else if ((isRowHighlighted || isColHighlighted) && bgColor === '#e8f8f5') {
                            bgColor = '#d1fae5'; // Darker green if already decided
                        } else if ((isRowHighlighted || isColHighlighted) && bgColor === '#f9f9f9') {
                            bgColor = '#fee2e2'; // Darker red if crossed
                        }
                    }

                    // --- Target Fact Highlight (Cell-Based) ---
                    let boxShadow = 'none';
                    if (targetFact) { // Always show helper target
                        const isRowTarget = (rowOverlayIndex !== -1 && rowValIndex === rowOverlayIndex);
                        const isColTarget = (colOverlayIndex !== -1 && colValIndex === colOverlayIndex);

                        if (isRowTarget || isColTarget) {
                            // Build inset shadow
                            // Top/Bottom (for Row) or Left/Right (for Col)?
                            // Actually, if it's a ROW target, we want top/bottom borders on ALL cells.
                            // Left border on first, Right on last.

                            const color = '#ef4444';
                            const width = '3px';
                            let shadows = [];

                            if (isRowTarget) {
                                shadows.push(`inset 0 ${width} 0 0 ${color}`); // Top
                                shadows.push(`inset 0 -${width} 0 0 ${color}`); // Bottom
                                if (colValIndex === 0) shadows.push(`inset ${width} 0 0 0 ${color}`); // Left (start of row)
                                if (colValIndex === colCategory.values.length - 1) shadows.push(`inset -${width} 0 0 0 ${color}`); // Right (end of row)
                            }

                            if (isColTarget) {
                                shadows.push(`inset ${width} 0 0 0 ${color}`); // Left
                                shadows.push(`inset -${width} 0 0 0 ${color}`); // Right
                                if (rowValIndex === 0) shadows.push(`inset 0 ${width} 0 0 ${color}`); // Top (start of col)
                                if (rowValIndex === rowCategory.values.length - 1) shadows.push(`inset 0 -${width} 0 0 ${color}`); // Bottom (end of col)
                            }

                            boxShadow = shadows.join(', ');
                        }
                    }

                    return (
                        <div
                            key={`${rowVal}-${colVal}`}
                            className="grid-cell"
                            onMouseEnter={() => {
                                if (onHover) onHover(rowValIndex, colValIndex, rowVal, colVal);
                            }}
                            onClick={() => {
                                if (viewMode === 'play' && onInteract) {
                                    onInteract(rowCategory.id, rowVal, colCategory.id, colVal);
                                }
                            }}
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: color,
                                cursor: viewMode === 'play' ? 'pointer' : 'default',
                                userSelect: 'none',
                                boxShadow: boxShadow,
                                zIndex: (boxShadow !== 'none') ? 1 : 'auto' // Ensure shadow renders above
                            }}
                            title={viewMode === 'play' ? `Click to cycle: Correct / Incorrect / Empty` : `${rowVal} <-> ${colVal}`}
                        >
                            {content}
                        </div>
                    );
                })
            )}
        </div>
    );
};

// Helper to check ID matching (safe string comparison)
const rowCatIdCheck = (hId: string, rId: string) => hId === rId;
const colCatIdCheck = (hId: string, cId: string) => hId === cId;
