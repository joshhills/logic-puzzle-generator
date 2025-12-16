import React from 'react';
import { LogicGrid, CategoryConfig } from '../../../src/index';

interface ComparisonGridProps {
    grid: LogicGrid;
    rowCategory: CategoryConfig;
    colCategory: CategoryConfig;
}

export const ComparisonGrid: React.FC<ComparisonGridProps> = ({ grid, rowCategory, colCategory }) => {
    const cellSize = 40;

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${colCategory.values.length}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rowCategory.values.length}, ${cellSize}px)`,

                // Border Strategy (Collapsed):
                // Give EVERY grid a full 2px border.
                border: '2px solid #555',

                // Use negative margins to overlap borders with neighbors.
                // The logical neighbor will place its Left border on top of our Right border.
                // But we want to ensure visual consistency.
                marginRight: '-2px',
                marginBottom: '-2px',

                gap: '1px', // Creates the inner lines
                backgroundColor: '#888', // Color of the inner lines (gap color)
            }}
        >
            {rowCategory.values.map((rowVal: string | number) =>
                colCategory.values.map((colVal: string | number) => {
                    const isPossible = grid.isPossible(rowCategory.id, rowVal, colCategory.id, colVal);

                    let content = '';
                    let bgColor = '#fff'; // Default cell color
                    let color = '#000';

                    if (!isPossible) {
                        content = '✕';
                        color = '#ff6b6b';
                        bgColor = '#f9f9f9';
                    } else {
                        const rowPoss = grid.getPossibilitiesCount(rowCategory.id, rowVal, colCategory.id);
                        const colPoss = grid.getPossibilitiesCount(colCategory.id, colVal, rowCategory.id);

                        if (rowPoss === 1 && colPoss === 1) {
                            content = 'O';
                            color = '#2ecc71';
                            bgColor = '#e8f8f5';
                        }
                    }

                    return (
                        <div
                            key={`${rowVal}-${colVal}`}
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
                                cursor: 'default',
                            }}
                            title={`${rowVal} <-> ${colVal}`}
                        >
                            {content}
                        </div>
                    );
                })
            )}
        </div>
    );
};
