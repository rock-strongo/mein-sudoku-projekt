// Player management and player selection UI.

const PLAYERS_STORAGE_KEY = 'sudoku_players';
const LAST_PLAYER_STORAGE_KEY = 'sudoku_last_player';
const DIFFICULTIES_STORAGE_KEY = 'sudoku_difficulties';
const STYLES_STORAGE_KEY = 'sudoku_styles';
const POINTS_STORAGE_KEY = 'sudoku_points';

function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
}

// Stored data is untrusted: anything that is not a list of valid names is ignored.
function loadStoredPlayers() {
    try {
        const raw = storageGet(PLAYERS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(p => typeof p === 'string' && validatePlayerName(p).name === p);
    } catch {
        return [];
    }
}

function saveStoredPlayers(players) {
    storageSet(PLAYERS_STORAGE_KEY, JSON.stringify(players));
}

function loadLastPlayerName() {
    return storageGet(LAST_PLAYER_STORAGE_KEY);
}

function saveLastPlayerName(name) {
    storageSet(LAST_PLAYER_STORAGE_KEY, name);
}

// Stored data is untrusted: returns only entries with a valid name and a value accepted by isValid.
function loadStoredSettings(key, isValid) {
    const settings = {};
    try {
        const raw = storageGet(key);
        const parsed = raw ? JSON.parse(raw) : {};
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return settings;
        for (const [name, value] of Object.entries(parsed)) {
            if (validatePlayerName(name).name === name && isValid(value)) {
                settings[name] = value;
            }
        }
    } catch {}
    return settings;
}

// Returns the stored setting of the player, or the default value.
function loadPlayerSetting(key, name, isValid, defaultValue) {
    const settings = loadStoredSettings(key, isValid);
    return Object.hasOwn(settings, name) ? settings[name] : defaultValue;
}

function savePlayerSetting(key, name, value, isValid) {
    const settings = loadStoredSettings(key, isValid);
    settings[name] = value;
    storageSet(key, JSON.stringify(settings));
}

function loadPlayerDifficulty(name) {
    return loadPlayerSetting(DIFFICULTIES_STORAGE_KEY, name, isValidDifficulty, DEFAULT_DIFFICULTY);
}

function savePlayerDifficulty(name, level) {
    savePlayerSetting(DIFFICULTIES_STORAGE_KEY, name, level, isValidDifficulty);
}

function isValidPoints(points) {
    return Number.isSafeInteger(points) && points >= 0;
}

function loadPlayerPoints(name) {
    return loadPlayerSetting(POINTS_STORAGE_KEY, name, isValidPoints, 0);
}

function savePlayerPoints(name, points) {
    savePlayerSetting(POINTS_STORAGE_KEY, name, points, isValidPoints);
}

// Available visual styles. A new style needs an entry here, an option in index.html
// and a block of CSS custom properties in style.css.
const STYLES = ['light', 'dark', 'xmas'];
const DEFAULT_STYLE = 'light';

function isValidStyle(style) {
    return typeof style === 'string' && STYLES.includes(style);
}

function loadPlayerStyle(name) {
    return loadPlayerSetting(STYLES_STORAGE_KEY, name, isValidStyle, DEFAULT_STYLE);
}

function savePlayerStyle(name, style) {
    savePlayerSetting(STYLES_STORAGE_KEY, name, style, isValidStyle);
}

function applyStyle(style) {
    document.documentElement.dataset.style = style;
}

// Returns { valid: true, name } or { valid: false, error }.
function validatePlayerName(raw) {
    const name = raw.trim();
    if (!name) return { valid: false, error: 'Please enter a name.' };
    if (name.length > 20) return { valid: false, error: 'Name must be at most 20 characters.' };
    if (!/^[\p{L}\d]+$/u.test(name)) {
        return { valid: false, error: 'Name may only contain letters and digits, no spaces or special characters.' };
    }
    return { valid: true, name };
}

// Returns the canonical stored name if one matches case-insensitively, else null.
function findStoredPlayer(name) {
    const players = loadStoredPlayers();
    return players.find(p => p.toLowerCase() === name.toLowerCase()) || null;
}

// Stores the player if new; saves as last active. Returns canonical name.
function persistPlayerSelection(name) {
    const existing = findStoredPlayer(name);
    const canonical = existing || name;
    if (!existing) {
        const players = loadStoredPlayers();
        players.push(name);
        saveStoredPlayers(players);
    }
    saveLastPlayerName(canonical);
    return canonical;
}

// ---- UI ----

let _onPlayerConfirmed = null;

function showPlayerDialog(onConfirmed) {
    _onPlayerConfirmed = onConfirmed;

    const playerList = document.getElementById('player-list');
    const knownSection = document.getElementById('known-players-section');
    const noKnownSection = document.getElementById('no-known-players-section');
    const nameInput = document.getElementById('player-name-input');
    const errorEl = document.getElementById('player-error');

    nameInput.value = '';
    errorEl.textContent = '';
    playerList.innerHTML = '';

    const players = loadStoredPlayers();
    const lastPlayer = loadLastPlayerName();

    if (players.length > 0) {
        const ordered = lastPlayer && players.includes(lastPlayer)
            ? [lastPlayer, ...players.filter(p => p !== lastPlayer)]
            : players;

        ordered.forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = name === lastPlayer ? 'player-btn player-btn-last' : 'player-btn';
            btn.textContent = name === lastPlayer ? `${name} (continue)` : name;
            btn.addEventListener('click', () => _confirmPlayer(name));
            playerList.appendChild(btn);
        });

        knownSection.hidden = false;
        noKnownSection.hidden = true;
    } else {
        knownSection.hidden = true;
        noKnownSection.hidden = false;
    }

    // The player selection is always shown in the default style.
    applyStyle(DEFAULT_STYLE);
    document.getElementById('player-overlay').hidden = false;
    document.getElementById('main-game').inert = true;
    nameInput.focus();
}

function _confirmPlayer(name) {
    const canonical = persistPlayerSelection(name);
    document.getElementById('player-overlay').hidden = true;
    document.getElementById('main-game').inert = false;
    document.getElementById('current-player-name').textContent = canonical;
    if (_onPlayerConfirmed) _onPlayerConfirmed(canonical);
}

function initPlayerUI(onConfirmed) {
    const startBtn = document.getElementById('start-game-button');
    const nameInput = document.getElementById('player-name-input');
    const errorEl = document.getElementById('player-error');

    startBtn.addEventListener('click', () => {
        const result = validatePlayerName(nameInput.value);
        if (!result.valid) {
            errorEl.textContent = result.error;
            return;
        }
        errorEl.textContent = '';
        _confirmPlayer(result.name);
    });

    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') startBtn.click();
    });

    nameInput.addEventListener('input', () => {
        errorEl.textContent = '';
    });

    document.getElementById('switch-player').addEventListener('click', () => {
        showPlayerDialog(onConfirmed);
    });

    showPlayerDialog(onConfirmed);
}
