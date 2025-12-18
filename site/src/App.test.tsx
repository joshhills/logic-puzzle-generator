
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('App Integration', () => {
    it('renders Step 2 inputs correctly after structure confirmation', () => {
        render(<App />);

        // 1. Check Step 1 is active
        expect(screen.getByText('1. Structure')).toBeInTheDocument();

        // 2. Click "Next" to go to Step 2
        // Find button that says "Continue".
        const nextBtn = screen.getByText('Continue');
        fireEvent.click(nextBtn);

        // 3. Check Step 2 (Goal) is active / populated
        // We know "Puzzle Objective" should be visible
        expect(screen.getByText('Puzzle Objective')).toBeInTheDocument();

        // 4. VERIFY REGRESSIONS (Inputs that were lost previously)
        // Puzzle Title
        expect(screen.getByText('Puzzle Title (Optional)')).toBeInTheDocument();
        // Target Clue Count slider
        expect(screen.getByText(/Target Clue Count/i)).toBeInTheDocument();
        // Specific Goal toggle
        expect(screen.getByText('Define Specific Goal')).toBeInTheDocument();
    });
});
