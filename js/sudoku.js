// Sudoku puzzle data, generation and rule validation (no DOM access).

// The predefined puzzle shown on page load. 0 marks an empty cell.
const PREDEFINED_PUZZLE = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

// The puzzle currently being played and its (unique) solution.
let puzzle = PREDEFINED_PUZZLE;
let solution = solve(PREDEFINED_PUZZLE);

// Returns a fresh copy of the current puzzle grid.
function createGrid() {
    return puzzle.map(row => row.slice());
}

function isGiven(row, col) {
    return puzzle[row][col] !== 0;
}

function getSolutionValue(row, col) {
    return solution[row][col];
}

// Returns a 9x9 array of booleans: true where a cell's value
// is duplicated in its row, column or 3x3 block.
function findConflicts(grid) {
    const conflicts = grid.map(row => row.map(() => false));

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const value = grid[row][col];
            if (value === 0) continue;

            const blockRow = Math.floor(row / 3) * 3;
            const blockCol = Math.floor(col / 3) * 3;

            for (let i = 0; i < 9; i++) {
                const sameRow = i !== col && grid[row][i] === value;
                const sameCol = i !== row && grid[i][col] === value;
                const r = blockRow + Math.floor(i / 3);
                const c = blockCol + (i % 3);
                const sameBlock = (r !== row || c !== col) && grid[r][c] === value;

                if (sameRow || sameCol || sameBlock) {
                    conflicts[row][col] = true;
                    break;
                }
            }
        }
    }

    return conflicts;
}

// The puzzle is solved when every cell is filled and no rule is violated.
function isSolved(grid) {
    const filled = grid.every(row => row.every(value => value !== 0));
    const noConflicts = findConflicts(grid).every(row => row.every(c => !c));
    return filled && noConflicts;
}

// --- Puzzle generation ---

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// True if value can be placed at (row, col) without breaking a rule.
function canPlace(grid, row, col, value) {
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;

    for (let i = 0; i < 9; i++) {
        if (grid[row][i] === value || grid[i][col] === value) return false;
        if (grid[blockRow + Math.floor(i / 3)][blockCol + (i % 3)] === value) return false;
    }
    return true;
}

// Fills all empty cells with a random valid solution (backtracking).
function fillGrid(grid) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] !== 0) continue;

            for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                if (canPlace(grid, row, col, value)) {
                    grid[row][col] = value;
                    if (fillGrid(grid)) return true;
                }
            }
            grid[row][col] = 0;
            return false;
        }
    }
    return true;
}

// Returns the solution of a puzzle with exactly one solution.
function solve(grid) {
    const solved = grid.map(row => row.slice());
    fillGrid(solved);
    return solved;
}

// Counts the solutions of a grid, stopping early once limit is reached.
function countSolutions(grid, limit) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] !== 0) continue;

            let count = 0;
            for (let value = 1; value <= 9 && count < limit; value++) {
                if (canPlace(grid, row, col, value)) {
                    grid[row][col] = value;
                    count += countSolutions(grid, limit - count);
                }
            }
            grid[row][col] = 0;
            return count;
        }
    }
    return 1;
}

// Range of given numbers for each difficulty level.
const DIFFICULTY_LEVELS = {
    easy: { min: 36, max: 40 },
    medium: { min: 30, max: 35 },
    hard: { min: 26, max: 29 }
};
const DEFAULT_DIFFICULTY = 'medium';

// Difficulty level of the current puzzle; the predefined puzzle counts as the default level.
let puzzleDifficulty = DEFAULT_DIFFICULTY;

function isValidDifficulty(level) {
    return typeof level === 'string' && Object.hasOwn(DIFFICULTY_LEVELS, level);
}

// Creates a new puzzle with exactly one solution and the number of given
// numbers defined for the difficulty level, and makes it the current puzzle.
function generatePuzzle(difficulty) {
    const { min, max } = DIFFICULTY_LEVELS[difficulty];
    const targetGivens = min + Math.floor(Math.random() * (max - min + 1));

    while (true) {
        const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
        fillGrid(grid);
        const solved = grid.map(row => row.slice());

        let givens = 81;
        const positions = shuffle([...Array(81).keys()]);

        // Remove numbers one by one, keeping only removals that leave a unique solution.
        for (const pos of positions) {
            if (givens === targetGivens) break;

            const row = Math.floor(pos / 9);
            const col = pos % 9;
            const value = grid[row][col];
            grid[row][col] = 0;

            if (countSolutions(grid, 2) === 1) {
                givens--;
            } else {
                grid[row][col] = value;
            }
        }

        // Retry in the rare case the target could not be reached.
        if (givens === targetGivens) {
            puzzle = grid;
            solution = solved;
            puzzleDifficulty = difficulty;
            return;
        }
    }
}
