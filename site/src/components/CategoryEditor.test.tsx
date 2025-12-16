
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryEditor } from './CategoryEditor';
import { CategoryType } from '../../../src/index'; // Ensure this mapping works or mock it
import { describe, it, expect, vi } from 'vitest';

// Mock CategoryType if imports fail in test env, but hopefully standard mapping works
// If not, we might need to adjust vite alias in test

describe('CategoryEditor Component', () => {
    const mockCategories = [
        { id: 'Cat1', values: ['A', 'B'], type: CategoryType.NOMINAL },
        { id: 'Cat2', values: ['1', '2'], type: CategoryType.ORDINAL },
    ];

    const defaultProps = {
        originalCategories: mockCategories,
        draftCategories: mockCategories,
        onDraftUpdate: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
    };

    it('renders category names', () => {
        render(<CategoryEditor {...defaultProps} />);
        expect(screen.getByDisplayValue('Cat1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Cat2')).toBeInTheDocument();
    });

    it('calls onDraftUpdate when a name is changed', () => {
        render(<CategoryEditor {...defaultProps} />);
        const input = screen.getByDisplayValue('Cat1');
        fireEvent.change(input, { target: { value: 'Cat1Updated' } });

        expect(defaultProps.onDraftUpdate).toHaveBeenCalled();
        // Check constraints of call if needed
        const updatedCalls = defaultProps.onDraftUpdate.mock.calls[0][0];
        expect(updatedCalls[0].id).toBe('Cat1Updated');
    });

    it('calls onDraftUpdate when a value is changed', () => {
        render(<CategoryEditor {...defaultProps} />);
        const valInput = screen.getByDisplayValue('A');
        fireEvent.change(valInput, { target: { value: 'X' } });

        const updatedCalls = defaultProps.onDraftUpdate.mock.calls;
        const lastCallArgs = updatedCalls[updatedCalls.length - 1][0];
        expect(lastCallArgs[0].values[0]).toBe('X');
    });

    it('shows error for duplicate names', () => {
        // Create draft with duplicates
        const duplicateDraft = [
            { id: 'Same', values: ['A'], type: 0 },
            { id: 'Same', values: ['B'], type: 0 }
        ];
        render(<CategoryEditor {...defaultProps} draftCategories={duplicateDraft} />);

        expect(screen.getAllByText('Duplicate Name').length).toBeGreaterThan(0);
        expect(screen.getByText('Save Changes')).toBeDisabled();
    });

    it('shows error for non-numeric ordinal', () => {
        const invalidDraft = [
            { id: 'Time', values: ['Morning'], type: CategoryType.ORDINAL }
        ];
        render(<CategoryEditor {...defaultProps} draftCategories={invalidDraft} />);

        expect(screen.getByText(/Ordinal values must be numbers/)).toBeInTheDocument();
        expect(screen.getByText('Save Changes')).toBeDisabled();
    });

    it('calls onSave when Save is clicked and dirty', () => {
        // Must pass different object to simulate dirty state logic inside component
        // Actually component does check: JSON.stringify(original) !== JSON.stringify(draft)
        const dirtyDraft = [
            { id: 'Cat1Changed', values: ['A', 'B'], type: CategoryType.NOMINAL },
            { id: 'Cat2', values: ['1', '2'], type: CategoryType.ORDINAL },
        ];

        render(<CategoryEditor {...defaultProps} draftCategories={dirtyDraft} />);
        const saveBtn = screen.getByText('Save Changes');
        expect(saveBtn).not.toBeDisabled();

        fireEvent.click(saveBtn);
        expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('calls onCancel when Cancel is clicked', () => {
        render(<CategoryEditor {...defaultProps} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(defaultProps.onCancel).toHaveBeenCalled();
    });
});
