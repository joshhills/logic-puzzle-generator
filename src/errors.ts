/**
 * Base error class for Logic Puzzle Generator library.
 */
export class LogicPuzzleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LogicPuzzleError';
    }
}

/**
 * Thrown when the provided configuration is invalid (e.g., duplicate IDs, mismatched sizes).
 */
export class ConfigurationError extends LogicPuzzleError {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}
