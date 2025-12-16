
import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('App Component', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Check for main structures
        expect(screen.getByText('Structure')).toBeInTheDocument();
        expect(screen.getByText('Goal')).toBeInTheDocument();
    });
});
