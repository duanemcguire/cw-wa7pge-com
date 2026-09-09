// CW WA7PGE — Screen Wake Lock
//
// Holds the display awake for the duration of a practice session so the phone's
// Auto-Lock doesn't kill playback mid-session. Without this the only workaround
// is setting Auto-Lock to Never, which then stays set for the rest of the day
// and drains the battery long after practice is over.
//
// Scope is the SESSION, not the individual transmission. Copy practice has gaps
// — between callsigns, while you're reading back what you copied — and a lock
// that released in every gap would let the screen time out anyway.
//
// Support: Safari 16.4+, and iOS 18.4+ for home-screen PWAs (Apple shipped the
// API in 16.4 but it did nothing in standalone mode until 18.4). Everywhere
// else it's been available for years. Where it's missing this is a silent no-op
// and the old Auto-Lock behaviour applies.

const CWWakeLock = (() => {
    let sentinel = null;     // the live WakeLockSentinel, if we hold one
    let wanted = false;      // does a session want the screen awake right now?
    let acquiring = false;   // a request() is in flight

    async function acquire() {
        if (!('wakeLock' in navigator)) return;
        if (sentinel || acquiring) return;
        // The request rejects outright if the document isn't visible.
        if (document.visibilityState !== 'visible') return;

        acquiring = true;
        try {
            const lock = await navigator.wakeLock.request('screen');

            // Stop may have been pressed while we were awaiting. If we kept
            // this lock the screen would stay lit forever with nothing playing
            // — the exact failure this module exists to prevent.
            if (!wanted) {
                lock.release().catch(() => {});
                return;
            }

            sentinel = lock;

            // iOS drops the lock on its own when the app goes to the
            // background. The sentinel stays non-null but is dead, so clear it
            // or the visibilitychange handler below sees a lock we don't have.
            lock.addEventListener('release', () => {
                if (sentinel === lock) sentinel = null;
            });
        } catch (err) {
            // Not fatal — practice still works, the screen just sleeps.
            console.log('Wake lock request failed:', err);
        } finally {
            acquiring = false;
        }
    }

    // Call this synchronously from the Play click handler. acquire() runs up to
    // its first await in the same task, so navigator.wakeLock.request() is
    // invoked while the user gesture is still active — Safari cares about this.
    // Deliberately not awaited for the same reason.
    function request() {
        wanted = true;
        acquire();
    }

    function release() {
        wanted = false;
        const lock = sentinel;
        sentinel = null;
        if (lock) lock.release().catch(() => {});
    }

    // Coming back to the foreground after iOS auto-released: take it again.
    document.addEventListener('visibilitychange', () => {
        if (wanted && document.visibilityState === 'visible') acquire();
    });

    // Navigating away ends the session whether or not Stop was pressed.
    window.addEventListener('pagehide', release);

    return { request, release };
})();
