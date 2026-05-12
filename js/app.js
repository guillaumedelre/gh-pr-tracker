import { state } from './state.js';
import { fetchUser, fetchPRs, fetchMergedPRs, fetchClosedPRs } from './api.js';
import { updateStats, renderPRs } from './render.js';
import { detectChanges, updateNotifBtn, requestNotifications } from './notifications.js';

// ── Data ──────────────────────────────────────────────────────────────
async function loadData() {
    state.currentPage = 1;
    setLoading(true);
    hideError();

    try {
        const [user, prs, merged, closed] = await Promise.all([
            fetchUser(), fetchPRs(), fetchMergedPRs(), fetchClosedPRs(),
        ]);

        state.currentUser = user;
        document.getElementById('user-avatar').src = user.avatar_url;
        document.getElementById('user-login').textContent = '@' + user.login;

        detectChanges(prs);
        state.allPRs    = prs;
        state.mergedPRs = merged;
        state.closedPRs = closed;
        updateStats();
        renderPRs();
        document.getElementById('last-refresh').textContent =
            'Updated at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    } catch (e) {
        showError(e.message);
    }

    setLoading(false);
}

// ── Filter / Search ───────────────────────────────────────────────────
function setFilter(f, btn) {
    state.currentFilter = f;
    state.currentPage   = 1;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPRs();
}

function setSearch(q) {
    state.searchQuery = q;
    state.currentPage = 1;
    renderPRs();
}

function showMore() {
    state.currentPage++;
    renderPRs();
}

// ── UI state ──────────────────────────────────────────────────────────
function setLoading(v) {
    document.getElementById('loading').classList.toggle('hidden', !v);
    document.getElementById('pr-list').classList.toggle('hidden', v);
    const btn = document.getElementById('refresh-btn');
    btn.disabled    = v;
    btn.textContent = v ? '⟳ Loading…' : '⟳ Refresh';
}

function showError(msg) {
    const el = document.getElementById('global-error');
    document.getElementById('global-error-msg').textContent = msg;
    el.classList.remove('hidden');
    document.getElementById('pr-list').classList.add('hidden');
}

function hideError() {
    document.getElementById('global-error').classList.add('hidden');
}

// ── Expose for HTML inline handlers ──────────────────────────────────
window.loadData            = loadData;
window.setFilter           = setFilter;
window.setSearch           = setSearch;
window.showMore            = showMore;
window.requestNotifications = requestNotifications;

// ── Boot ──────────────────────────────────────────────────────────────
(function init() {
    const year = new Date().getFullYear();
    document.getElementById('label-merged-year').textContent   = `Merged (${year})`;
    document.getElementById('filter-merged-label').textContent = `Merged (${year})`;
    document.getElementById('label-closed-year').textContent   = `Closed (${year})`;
    document.getElementById('filter-closed-label').textContent = `Closed (${year})`;

    updateNotifBtn();

    const refreshInterval = (window.PR_TRACKER_CONFIG?.refreshInterval ?? 300) * 1000;
    setInterval(loadData, refreshInterval);

    loadData();
})();
