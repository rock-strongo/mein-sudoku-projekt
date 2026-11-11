// Board rendering and user interaction.

const boardElement = document.getElementById('board');
const messageElement = document.getElementById('message');
const resetButton = document.getElementById('reset');
const newPuzzleButton = document.getElementById('new-puzzle');
const hintButton = document.getElementById('hint');
const difficultySelect = document.getElementById('difficulty');
const styleSelect = document.getElementById('style');
const timerElement = document.getElementById('timer');
const pointsElement = document.getElementById('points');

let currentPlayer = null;
let grid = createGrid();
let hints = createHintGrid();
let selectedCell = null;
const cells = [];

// ---- Timer ----
// The timer is 'idle' until the first input, then 'running', and 'stopped' once the puzzle is solved.

let timerState = 'idle';
let timerStartTime = 0;
let timerElapsed = 0;
let timerInterval = null;

// Elapsed milliseconds, based on the actual time that has passed.
function getElapsedTime() {
    return timerState === 'running' ? Date.now() - timerStartTime : timerElapsed;
}

// Formats milliseconds as mm:ss, or h:mm:ss from one hour onwards.
function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function renderTimer() {
    timerElement.textContent = formatTime(getElapsedTime());
}

// Starts the timer with the first input in the current puzzle.
function startTimer() {
    if (timerState !== 'idle') return;
    timerState = 'running';
    timerStartTime = Date.now();
    timerInterval = setInterval(renderTimer, 250);
}

// Stops the timer and keeps the elapsed time visible.
function stopTimer() {
    if (timerState === 'running') timerElapsed = Date.now() - timerStartTime;
    if (timerState !== 'idle') timerState = 'stopped';
    clearInterval(timerInterval);
    renderTimer();
}

// Resets the timer to 00:00; it starts again with the next input.
function resetTimer() {
    clearInterval(timerInterval);
    timerState = 'idle';
    timerElapsed = 0;
    renderTimer();
}

// ---- Points ----

const BASE_POINTS = { easy: 1000, medium: 2000, hard: 3000 };
const POINTS_PER_HINT = 100;

let totalPoints = 0;
let puzzleScored = false;   // true once the current puzzle has earned points
let wasSolved = false;      // true while the board shows a solved puzzle
let solvedMessage = '';

function renderPoints() {
    pointsElement.textContent = String(totalPoints);
}

function countHints() {
    return hints.flat().filter(Boolean).length;
}

// Points for the solved puzzle: base points minus time and hint penalties, at least 0.
function calculatePoints() {
    const seconds = Math.floor(getElapsedTime() / 1000);
    return Math.max(0, BASE_POINTS[puzzleDifficulty] - seconds - countHints() * POINTS_PER_HINT);
}

// Awards points once per puzzle and returns the success message.
function handleSolved() {
    const time = formatTime(getElapsedTime());
    if (puzzleScored) {
        return `Congratulations! You solved the Sudoku in ${time}. This puzzle has already earned points, so no further points are awarded.`;
    }
    const points = calculatePoints();
    puzzleScored = true;
    totalPoints = Math.min(totalPoints + points, Number.MAX_SAFE_INTEGER);
    savePlayerPoints(currentPlayer, totalPoints);
    renderPoints();
    return `Congratulations! You solved the Sudoku in ${time} and earned ${points} points.`;
}

// Returns a 9x9 array of booleans: true where a number was inserted by a hint.
function createHintGrid() {
    return Array.from({ length: 9 }, () => Array(9).fill(false));
}

function buildBoard() {
    for (let row = 0; row < 9; row++) {
        cells[row] = [];
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('input');
            cell.type = 'text';
            cell.inputMode = 'numeric';
            cell.maxLength = 1;
            cell.className = 'cell';
            cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);

            if (col === 2 || col === 5) cell.classList.add('block-right');
            if (row === 2 || row === 5) cell.classList.add('block-bottom');

            cell.addEventListener('input', () => handleInput(row, col));
            cell.addEventListener('focus', () => { selectedCell = { row, col }; });
            cell.addEventListener('blur', event => {
                // Keep the selection when focus moves to the hint button.
                if (event.relatedTarget !== hintButton) selectedCell = null;
            });

            cells[row][col] = cell;
            boardElement.appendChild(cell);
        }
    }
}

// Marks predefined numbers and numbers inserted by hints as not editable.
function applyCellStates() {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const given = isGiven(row, col);
            const hint = hints[row][col];
            const cell = cells[row][col];
            cell.readOnly = given || hint;
            cell.tabIndex = given || hint ? -1 : 0;
            cell.classList.toggle('given', given);
            cell.classList.toggle('hint', hint);
        }
    }
}

// Accepts only the digits 1-9; anything else clears the cell.
function handleInput(row, col) {
    const cell = cells[row][col];
    const digit = cell.value.replace(/[^1-9]/g, '').slice(-1);
    cell.value = digit;
    grid[row][col] = digit ? Number(digit) : 0;
    if (digit) startTimer();
    update();
}

// Fills the selected empty cell, or a random empty cell, with its correct number.
function giveHint() {
    let target = selectedCell;

    if (!target || grid[target.row][target.col] !== 0) {
        const emptyCells = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) emptyCells.push({ row, col });
            }
        }
        if (emptyCells.length === 0) return;
        target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    grid[target.row][target.col] = getSolutionValue(target.row, target.col);
    hints[target.row][target.col] = true;
    startTimer();
    applyCellStates();
    update();
}

// Refreshes the cell values, conflict highlighting and success message.
function update() {
    const conflicts = findConflicts(grid);

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const value = grid[row][col];
            cells[row][col].value = value === 0 ? '' : String(value);
            cells[row][col].classList.toggle('conflict', conflicts[row][col]);
        }
    }

    if (isSolved(grid)) {
        if (!wasSolved) {
            wasSolved = true;
            stopTimer();
            solvedMessage = handleSolved();
        }
        messageElement.textContent = solvedMessage;
    } else {
        wasSolved = false;
        messageElement.textContent = '';
    }
}

function resetGame() {
    grid = createGrid();
    hints = createHintGrid();
    wasSolved = false;
    resetTimer();
    applyCellStates();
    update();
}

// After a player has been selected: select the player's difficulty level, style and total score and reset the puzzle.
function startGame(playerName) {
    currentPlayer = playerName;
    totalPoints = loadPlayerPoints(playerName);
    renderPoints();
    difficultySelect.value = loadPlayerDifficulty(playerName);
    styleSelect.value = loadPlayerStyle(playerName);
    applyStyle(styleSelect.value);
    resetGame();
}

resetButton.addEventListener('click', resetGame);

difficultySelect.addEventListener('change', () => {
    if (isValidDifficulty(difficultySelect.value)) {
        savePlayerDifficulty(currentPlayer, difficultySelect.value);
    }
});

styleSelect.addEventListener('change', () => {
    if (isValidStyle(styleSelect.value)) {
        applyStyle(styleSelect.value);
        savePlayerStyle(currentPlayer, styleSelect.value);
    }
});

newPuzzleButton.addEventListener('click', () => {
    generatePuzzle(difficultySelect.value);
    puzzleScored = false;
    resetGame();
});

// The timer stops while the player selection is open.
document.getElementById('switch-player').addEventListener('click', stopTimer);

// Prevent the button from taking focus on click, so the selected cell stays selected.
hintButton.addEventListener('mousedown', event => event.preventDefault());
hintButton.addEventListener('click', giveHint);

buildBoard();
applyCellStates();
update();

initPlayerUI(startGame);
