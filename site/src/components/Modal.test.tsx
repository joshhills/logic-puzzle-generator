
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';
import { describe, it, expect, vi } from 'vitest';

describe('Modal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Test Modal',
        message: 'This is a test message',
    };

    it('renders nothing when isOpen is false', () => {
        render(<Modal {...defaultProps} isOpen={false} />);
        expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders correctly when isOpen is true', () => {
        render(<Modal {...defaultProps} />);
        expect(screen.getByText('Test Modal')).toBeInTheDocument();
        expect(screen.getByText('This is a test message')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
        render(<Modal {...defaultProps} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm and onClose when Confirm is clicked', () => {
        render(<Modal {...defaultProps} />);
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
});
