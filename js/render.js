import { esc, relTime } from './utils.js';
import { state, PAGE_SIZE } from './state.js';

export const STATE_META = {
    open:   { label: 'Open',   badgeClass: 'badge-review' },
    closed: { label: 'Closed', badgeClass: 'badge-draft'  },
    merged: { label: 'Merged', badgeClass: 'badge-merged' },
};

export const REVIEW_META = {
    draft:             { label: 'Draft',             badgeClass: 'badge-draft'    },
    review_required:   { label: 'In review',         badgeClass: 'badge-review'   },
    changes_requested: { label: 'Changes requested', badgeClass: 'badge-changes'  },
    approved:          { label: 'Approved',          badgeClass: 'badge-approved' },
};

function getStatus(pr) {
    if (pr._merged) return 'merged';
    if (pr._closed) return 'closed';
    return 'open';
}

function getReviewDecision(pr) {
    if (pr.isDraft) return 'draft';
    switch (pr.reviewDecision) {
        case 'APPROVED':          return 'approved';
        case 'CHANGES_REQUESTED': return 'changes_requested';
        default:                  return 'review_required';
    }
}

function ciInfo(pr) {
    const s = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;
    switch (s) {
        case 'SUCCESS': return { cls: 'ci-success', label: 'CI ✓' };
        case 'FAILURE':
        case 'ERROR':   return { cls: 'ci-failure', label: 'CI ✗' };
        case 'PENDING': return { cls: 'ci-pending', label: 'CI…'  };
        default:        return { cls: 'ci-none',    label: ''      };
    }
}

export function updateStats() {
    const hiddenNamespaces = window.PR_TRACKER_CONFIG?.hiddenNamespaces ?? [];
    const isVisible = pr => !hiddenNamespaces.includes(pr.repository.nameWithOwner.split('/')[0]);

    const visibleOpen   = state.allPRs.filter(isVisible);
    const visibleClosed = state.closedPRs.filter(isVisible);
    const visibleMerged = state.mergedPRs.filter(isVisible);

    const counts = { draft: 0, review_required: 0, changes_requested: 0, approved: 0 };
    visibleOpen.forEach(pr => counts[getReviewDecision(pr)]++);

    document.getElementById('stat-total').textContent    = visibleOpen.length;
    document.getElementById('stat-draft').textContent    = counts.draft;
    document.getElementById('stat-review').textContent   = counts.review_required + counts.changes_requested + counts.approved;
    document.getElementById('stat-changes').textContent  = counts.changes_requested;
    document.getElementById('stat-approved').textContent = counts.approved;
    document.getElementById('stat-closed').textContent   = visibleClosed.length;
    document.getElementById('stat-merged').textContent   = visibleMerged.length;

    document.getElementById('fc-open').textContent   = visibleOpen.length;
    document.getElementById('fc-closed').textContent = visibleClosed.length;
    document.getElementById('fc-merged').textContent = visibleMerged.length;
}

export function renderPRs() {
    const source = state.currentFilter === 'merged' ? state.mergedPRs
                 : state.currentFilter === 'closed' ? state.closedPRs
                 : state.allPRs;

    const hiddenNamespaces = window.PR_TRACKER_CONFIG?.hiddenNamespaces ?? [];
    const q = state.searchQuery.toLowerCase().trim();

    const filtered = source.filter(pr => {
        const owner = pr.repository.nameWithOwner.split('/')[0];
        if (hiddenNamespaces.includes(owner)) return false;
        if (!q) return true;
        return pr.repository.nameWithOwner.toLowerCase().includes(q)
            || pr.title.toLowerCase().includes(q)
            || (pr.labels?.nodes || []).some(l => l.name.toLowerCase().includes(q));
    });

    const list  = document.getElementById('pr-list');
    const empty = document.getElementById('empty-state');

    if (filtered.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    const byRepo = new Map();
    filtered.forEach(pr => {
        const key = pr.repository.nameWithOwner;
        if (!byRepo.has(key)) byRepo.set(key, { url: pr.repository.url, avatarUrl: pr.repository.owner.avatarUrl, prs: [] });
        byRepo.get(key).prs.push(pr);
    });

    const allEntries     = [...byRepo.entries()];
    const visibleEntries = allEntries.slice(0, state.currentPage * PAGE_SIZE);
    const remaining      = allEntries.length - visibleEntries.length;

    list.innerHTML = visibleEntries.map(([repo, data]) => `
        <div class="repo-group">
            <div class="repo-header">
                <img src="${esc(data.avatarUrl)}" style="width:18px;height:18px;border-radius:4px;flex-shrink:0" alt="">
                <a href="${esc(data.url)}" target="_blank" rel="noopener">${esc(repo)}</a>
                <span class="repo-count">${data.prs.length} PR${data.prs.length > 1 ? 's' : ''}</span>
            </div>
            ${data.prs.map(renderCard).join('')}
        </div>
    `).join('');

    if (remaining > 0) {
        list.insertAdjacentHTML('beforeend', `
            <div style="text-align:center;padding:1.5rem 0">
                <button class="btn" onclick="showMore()">Show ${Math.min(PAGE_SIZE, remaining)} more repo${Math.min(PAGE_SIZE, remaining) > 1 ? 's' : ''} (${remaining} remaining)</button>
            </div>
        `);
    }
}

function renderCard(pr) {
    const state_ = getStatus(pr);
    const ci     = ciInfo(pr);

    const primaryBadge = state_ === 'open'
        ? (() => { const m = REVIEW_META[getReviewDecision(pr)]; return `<span class="badge ${m.badgeClass}">${m.label}</span>`; })()
        : (() => { const m = STATE_META[state_];                 return `<span class="badge ${m.badgeClass}">${m.label}</span>`; })();

    const reviewerMap = new Map();
    (pr.reviews?.nodes || []).forEach(r => {
        const existing = reviewerMap.get(r.author.login);
        if (!existing || new Date(r.submittedAt) > new Date(existing.submittedAt)) {
            reviewerMap.set(r.author.login, r);
        }
    });

    const avatars = [...reviewerMap.values()].slice(0, 5).map(r => {
        const color = { APPROVED: 'var(--green)', CHANGES_REQUESTED: 'var(--red)', COMMENTED: 'var(--text-muted)' }[r.state] || 'var(--border)';
        return `<img class="avatar" src="${esc(r.author.avatarUrl)}" title="${esc(r.author.login)} (${r.state})" style="outline:2px solid ${color}">`;
    }).join('');

    const requestedReviewers = (pr.reviewRequests?.nodes || [])
        .filter(n => n.requestedReviewer?.login)
        .filter(n => !reviewerMap.has(n.requestedReviewer.login))
        .slice(0, 3)
        .map(n => `<img class="avatar" src="${esc(n.requestedReviewer.avatarUrl)}" title="${esc(n.requestedReviewer.login)} (requested)" style="opacity:.5;outline:2px solid var(--border)">`)
        .join('');

    const labels = (pr.labels?.nodes || []).map(l =>
        `<span style="background:#${esc(l.color)}22;color:#${esc(l.color)};border:1px solid #${esc(l.color)}44;padding:.1rem .4rem;border-radius:10px;font-size:.65rem;">${esc(l.name)}</span>`
    ).join('');

    return `
        <a href="${esc(pr.url)}" target="_blank" rel="noopener" class="pr-card">
            <div class="pr-status">
                ${primaryBadge}
                ${ci.label ? `<span class="ci-badge"><span class="ci-dot ${ci.cls}"></span>${ci.label}</span>` : ''}
            </div>
            <div class="pr-body">
                <div class="title">${esc(pr.title)}</div>
                <div class="pr-meta">
                    <span style="color:var(--text-muted)">#${pr.number}</span>
                    <span>${pr._merged ? 'merged' : pr._closed ? 'closed' : 'updated'} ${relTime(pr._merged ? pr.mergedAt : pr._closed ? pr.closedAt : pr.updatedAt)}</span>
                    <span class="diff-plus">+${pr.additions}</span>
                    <span class="diff-minus">-${pr.deletions}</span>
                    ${pr.comments.totalCount > 0 ? `<span>💬 ${pr.comments.totalCount}</span>` : ''}
                    ${labels}
                </div>
            </div>
            <div class="pr-right">
                ${(avatars || requestedReviewers) ? `<div class="avatar-stack">${avatars}${requestedReviewers}</div>` : ''}
            </div>
        </a>
    `;
}
