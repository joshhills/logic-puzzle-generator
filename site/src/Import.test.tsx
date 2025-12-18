
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('JSON Import', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows error alert when importing invalid JSON file', async () => {
        render(<App />);

        const mockClick = vi.fn();

        let capturedInput: any = null;
        const originalCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'input') {
                capturedInput = el;
                vi.spyOn(el, 'click').mockImplementation(mockClick);
            }
            return el;
        });

        fireEvent.click(screen.getByText('Import'));

        const invalidFile = new File(['{ invalid json: '], 'invalid.json', { type: 'application/json' });

        Object.defineProperty(capturedInput, 'files', {
            value: [invalidFile],
            writable: false
        });

        const evt = { target: { files: [invalidFile] } };
        capturedInput.onchange(evt);

        await waitFor(() => {
            expect(screen.getByText('Failed to parse JSON file.')).toBeInTheDocument();
        });
    });

    it('shows error alert when importing JSON with mismatch version', async () => {
        render(<App />);

        let capturedInput: any = null;
        const originalCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'input') {
                capturedInput = el;
                vi.spyOn(el, 'click').mockImplementation(() => { });
            }
            return el;
        });

        fireEvent.click(screen.getByText('Import'));

        const validBadVersion = JSON.stringify({ version: 999, config: {} });
        const file = new File([validBadVersion], 'bad_version.json', { type: 'application/json' });

        Object.defineProperty(capturedInput, 'files', {
            value: [file],
            writable: false
        });

        const evt = { target: { files: [file] } };
        capturedInput.onchange(evt);

        await waitFor(() => {
            expect(screen.getByText('Version mismatch or invalid file.')).toBeInTheDocument();
        });
    });

    it('successfully loads valid JSON', async () => {
        render(<App />);

        let capturedInput: any = null;
        const originalCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'input') {
                capturedInput = el;
                vi.spyOn(el, 'click').mockImplementation(() => { });
            }
            return el;
        });

        fireEvent.click(screen.getByText('Import'));

        const validData = JSON.stringify({
            version: 1, // Matches DATA_VERSION in App.tsx
            config: {
                numCats: 5,
                numItems: 5,
                targetClueCount: 10
            },
            puzzle: null
        });
        const file = new File([validData], 'save.json', { type: 'application/json' });

        Object.defineProperty(capturedInput, 'files', {
            value: [file],
            writable: false
        });

        const evt = { target: { files: [file] } };
        capturedInput.onchange(evt);

        await waitFor(() => {
            expect(screen.getByText('Puzzle loaded successfully!')).toBeInTheDocument();
        });
    });
});
