// Persists form select values per route in localStorage.
// Keys: "cw:form:<pathname>:<elementId>"
const FormState = (() => {
    const route = window.location.pathname;

    function _key(id) { return 'cw:form:' + route + ':' + id; }

    function save(id) {
        const el = document.getElementById(id);
        if (el) localStorage.setItem(_key(id), el.value);
    }

    function get(id) { return localStorage.getItem(_key(id)); }

    // Sets select value if the saved option exists. Returns true on success.
    function restore(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        const saved = get(id);
        if (saved === null) return false;
        if ([...el.options].some(o => o.value === saved)) {
            el.value = saved;
            return true;
        }
        return false;
    }

    // Attach change listeners that auto-save each listed element by id.
    function autoSave(ids) {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => save(id));
        }
    }

    // Builds a share URL from { urlParam: elementId } and copies it to clipboard.
    function share(paramMap, buttonEl) {
        const url = new URL(window.location.pathname, window.location.origin);
        for (const [param, id] of Object.entries(paramMap)) {
            const el = document.getElementById(id);
            if (el && el.value) url.searchParams.set(param, el.value);
        }
        const urlStr = url.toString();
        navigator.clipboard.writeText(urlStr).then(() => {
            const orig = buttonEl.innerHTML;
            buttonEl.innerHTML = '&#10003;';
            setTimeout(() => { buttonEl.innerHTML = orig; }, 1500);
        }).catch(() => window.prompt('Copy this link:', urlStr));
    }

    return { save, get, restore, autoSave, share };
})();
