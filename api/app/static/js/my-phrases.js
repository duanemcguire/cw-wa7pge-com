// Local phrase-file storage for the "My Phrases" practice tool.
// Everything lives in the browser; nothing is sent to the server.
// Key: "cw:myphrases:v1" holds every file — ten files of a few hundred short
// lines is far under the ~5MB quota, so there's no reason to shard per file.
const MyPhrases = (() => {
    const KEY = 'cw:myphrases:v1';
    const VERSION = 1;

    const MAX_FILES = 10;
    const MAX_LINES = 2000;
    const MAX_LINE_CHARS = 200;
    const MAX_NAME_CHARS = 40;

    /* ===============================
       CW text normalization

       Built-in phrases are cleaned server side (simplify_cw_line in
       phrases_controller.py) before they ever reach the browser. Local phrases
       never pass through that code, so the same rules have to run here or a
       pasted em-dash or smart quote reaches jscwlib unnormalized. Applied at
       playback time, not on save, so the editor keeps showing what was typed.
    ================================ */

    const YUK = /[{}\[\];:\\|\-_+*&^%$#@!<>]/g;

    function simplifyCwLine(line) {
        line = line.replace(/’/g, "'");
        line = line.replace(/&/g, ' and ');
        line = line.normalize('NFKD').replace(/\p{M}/gu, '');
        return line.replace(YUK, ' ');
    }

    /* ===============================
       Persistence
    ================================ */

    function _read() {
        let raw = null;
        try {
            raw = localStorage.getItem(KEY);
        } catch (e) {
            return { version: VERSION, files: [] };
        }
        if (!raw) return { version: VERSION, files: [] };
        try {
            const store = JSON.parse(raw);
            if (!store || !Array.isArray(store.files)) throw new Error('bad shape');
            return store;
        } catch (e) {
            // Corrupt data shouldn't brick the tool. Start clean but leave the
            // bad value in place so it can still be recovered by hand.
            console.warn('My Phrases: unreadable saved data, starting empty', e);
            return { version: VERSION, files: [] };
        }
    }

    function _write(store) {
        store.version = VERSION;
        try {
            localStorage.setItem(KEY, JSON.stringify(store));
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                throw new Error('Out of browser storage space. Delete a file or trim some phrases, then try again.');
            }
            throw new Error('Could not save: ' + (e && e.message ? e.message : e));
        }
    }

    function _newId() {
        return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    }

    /* ===============================
       Validation
    ================================ */

    // Accepts raw textarea content or an array; returns clean phrase lines.
    function normalizeLines(input) {
        const raw = Array.isArray(input) ? input : String(input == null ? '' : input).split(/\r?\n/);
        const lines = [];
        for (const item of raw) {
            const line = String(item).trim().slice(0, MAX_LINE_CHARS);
            if (line) lines.push(line);
            if (lines.length >= MAX_LINES) break;
        }
        return lines;
    }

    // Returns a cleaned name, or throws with a message fit for display.
    function validateName(name, excludeId) {
        const clean = String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
        if (!clean) throw new Error('Please give the file a name.');
        if (clean.length > MAX_NAME_CHARS) {
            throw new Error('Name is too long (limit ' + MAX_NAME_CHARS + ' characters).');
        }
        const taken = _read().files.some(
            f => f.id !== excludeId && f.name.toLowerCase() === clean.toLowerCase()
        );
        if (taken) throw new Error('You already have a file named "' + clean + '".');
        return clean;
    }

    // "Notes" -> "Notes (2)" -- used by import, which shouldn't fail on a clash.
    function _uniqueName(name, files) {
        const base = String(name).trim().slice(0, MAX_NAME_CHARS) || 'Untitled';
        const exists = n => files.some(f => f.name.toLowerCase() === n.toLowerCase());
        if (!exists(base)) return base;
        for (let i = 2; i < 100; i++) {
            const candidate = base.slice(0, MAX_NAME_CHARS - 4) + ' (' + i + ')';
            if (!exists(candidate)) return candidate;
        }
        return base + ' ' + Date.now();
    }

    /* ===============================
       CRUD
    ================================ */

    function list() {
        return _read().files.map(f => ({
            id: f.id,
            name: f.name,
            lines: Array.isArray(f.lines) ? f.lines.slice() : [],
            updated: f.updated || 0,
        }));
    }

    function get(id) {
        return list().find(f => f.id === id) || null;
    }

    function count() {
        return _read().files.length;
    }

    function create(name, lines) {
        const store = _read();
        if (store.files.length >= MAX_FILES) {
            throw new Error('You already have ' + MAX_FILES + ' phrase files. Delete one to make room.');
        }
        const file = {
            id: _newId(),
            name: validateName(name),
            lines: normalizeLines(lines || []),
            updated: Date.now(),
        };
        store.files.push(file);
        _write(store);
        return file;
    }

    function update(id, changes) {
        const store = _read();
        const file = store.files.find(f => f.id === id);
        if (!file) throw new Error('That phrase file no longer exists.');
        if (changes.name !== undefined) file.name = validateName(changes.name, id);
        if (changes.lines !== undefined) file.lines = normalizeLines(changes.lines);
        file.updated = Date.now();
        _write(store);
        return { id: file.id, name: file.name, lines: file.lines.slice(), updated: file.updated };
    }

    function remove(id) {
        const store = _read();
        const before = store.files.length;
        store.files = store.files.filter(f => f.id !== id);
        if (store.files.length === before) return false;
        _write(store);
        return true;
    }

    /* ===============================
       Export / import

       localStorage is per-browser: clearing site data or moving to another
       device loses everything. This is the only real protection.
    ================================ */

    function exportText() {
        return JSON.stringify({ version: VERSION, exported: new Date().toISOString(), files: _read().files }, null, 2);
    }

    function exportFilename() {
        return 'my-phrases-' + new Date().toISOString().slice(0, 10) + '.json';
    }

    // mode: 'merge' appends what fits, 'replace' discards existing files first.
    // Returns { added, skipped } so the caller can report truncation instead of
    // silently dropping files.
    function importJson(text, mode) {
        let incoming;
        try {
            incoming = JSON.parse(text);
        } catch (e) {
            throw new Error("That doesn't look like a My Phrases export file (invalid JSON).");
        }
        if (!incoming || !Array.isArray(incoming.files)) {
            throw new Error("That doesn't look like a My Phrases export file (no phrase files inside).");
        }

        const store = mode === 'replace' ? { version: VERSION, files: [] } : _read();
        let added = 0;
        let skipped = 0;

        for (const candidate of incoming.files) {
            if (store.files.length >= MAX_FILES) { skipped++; continue; }
            const lines = normalizeLines(candidate && candidate.lines ? candidate.lines : []);
            store.files.push({
                id: _newId(),
                name: _uniqueName(candidate && candidate.name ? candidate.name : 'Untitled', store.files),
                lines: lines,
                updated: Date.now(),
            });
            added++;
        }

        _write(store);
        return { added, skipped };
    }

    return {
        MAX_FILES, MAX_LINES, MAX_LINE_CHARS, MAX_NAME_CHARS,
        list, get, count, create, update, remove,
        normalizeLines, validateName,
        exportText, exportFilename, importJson,
        simplifyCwLine,
    };
})();
