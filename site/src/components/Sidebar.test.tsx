
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect, vi } from 'vitest';

describe('Sidebar Component', () => {
    const defaultProps = {
        currentStep: 0,
        steps: ['Step 1', 'Step 2', 'Step 3'],
        onStepSelect: vi.fn(),
        maxReachableStep: 1,
        onReset: vi.fn(),
        canReset: true,
        onExport: vi.fn(),
        onImport: vi.fn(),
    };

    it('renders all steps', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByText('Step 1')).toBeInTheDocument();
        expect(screen.getByText('Step 2')).toBeInTheDocument();
        expect(screen.getByText('Step 3')).toBeInTheDocument();
    });

    it('renders export and import buttons if provided', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByTitle('Export JSON')).toBeInTheDocument();
        expect(screen.getByTitle('Import JSON')).toBeInTheDocument();
    });

    it('calls onStepSelect when clicking a reachable step', () => {
        render(<Sidebar {...defaultProps} />);
        // Step 2 is index 1, maxReachable is 1, so it should be clickable
        fireEvent.click(screen.getByText('Step 2'));
        expect(defaultProps.onStepSelect).toHaveBeenCalledWith(1);
    });

    it('does not call onStepSelect when clicking an unreachable step', () => {
        render(<Sidebar {...defaultProps} />);
        // Step 3 is index 2, maxReachable is 1, so it should be disabled
        fireEvent.click(screen.getByText('Step 3'));
        expect(defaultProps.onStepSelect).not.toHaveBeenCalled();
    });

    it('renders reset button correctly', () => {
        render(<Sidebar {...defaultProps} />);
        const resetBtn = screen.getByText(/Reset Puzzle/i);
        expect(resetBtn).toBeInTheDocument();
        expect(resetBtn).not.toBeDisabled();
    });

    it('disables reset button when canReset is false', () => {
        render(<Sidebar {...defaultProps} canReset={false} />);
        const resetBtn = screen.getByText(/Reset Puzzle/i);
        expect(resetBtn).toBeDisabled();
    });

    it('renders footer version', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByText(/v0.2.2/)).toBeInTheDocument();
    });
});
