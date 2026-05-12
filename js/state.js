export const state = {
    currentUser:   null,
    currentFilter: 'open',
    searchQuery:   '',
    expandedRepos: new Set(),
    allPRs:        [],
    mergedPRs:     [],
    closedPRs:     [],
};

export const PAGE_SIZE = 10;
