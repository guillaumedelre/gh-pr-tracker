const prSnapshot = new Map();

export function requestNotifications() {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(updateNotifBtn);
}

export function updateNotifBtn() {
    const btn = document.getElementById('notif-btn');
    if (!btn || !('Notification' in window)) return;
    const granted = Notification.permission === 'granted';
    btn.textContent = granted ? '🔔' : '🔕';
    btn.title = granted ? 'Notifications enabled' : 'Enable notifications';
}

export function notify(title, body, url) {
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, { body });
    n.onclick = () => { window.open(url, '_blank'); n.close(); };
}

export function detectChanges(prs) {
    prs.forEach(pr => {
        const ci     = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null;
        const review = pr.reviewDecision ?? null;
        const prev   = prSnapshot.get(pr.url);

        if (prev) {
            if (prev.ci !== ci) {
                if (ci === 'SUCCESS')                   notify('CI passed', pr.title, pr.url);
                if (ci === 'FAILURE' || ci === 'ERROR') notify('CI failed', pr.title, pr.url);
            }
            if (prev.review !== review) {
                if (review === 'APPROVED')              notify('PR approved', pr.title, pr.url);
                if (review === 'CHANGES_REQUESTED')     notify('Changes requested', pr.title, pr.url);
            }
        }

        prSnapshot.set(pr.url, { ci, review });
    });
}
