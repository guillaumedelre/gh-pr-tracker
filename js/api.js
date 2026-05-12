const GH_GRAPHQL = '/api/graphql';
const GH_REST    = '/api/rest';

function assertOk(r) {
    if (r.status === 401) throw new Error('Invalid or expired GitHub token. Update secrets/gh_token and restart the container.');
    if (r.status === 403) throw new Error('GitHub token lacks required permissions (Pull requests: read + Metadata: read).');
    if (!r.ok) throw new Error(`Unexpected HTTP ${r.status} from GitHub API.`);
}

function assertGql(data) {
    if (!data.errors) return;
    const err = data.errors[0];
    if (err.type === 'INSUFFICIENT_SCOPES') throw new Error('GitHub token lacks required permissions (Pull requests: read + Metadata: read).');
    throw new Error(err.message);
}

export async function fetchUser() {
    const r = await fetch(`${GH_REST}/user`);
    assertOk(r);
    return r.json();
}

export async function fetchPRs() {
    const query = `
        query($after: String) {
          search(query: "is:pr is:open author:@me sort:updated-desc", type: ISSUE, first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              ... on PullRequest {
                number title url createdAt updatedAt isDraft reviewDecision additions deletions
                repository { nameWithOwner url owner { avatarUrl } }
                reviews(last: 20) { nodes { state author { login avatarUrl } submittedAt } }
                reviewRequests(first: 5) { nodes { requestedReviewer { ... on User { login avatarUrl } } } }
                commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
                comments { totalCount }
                labels(first: 5) { nodes { name color } }
              }
            }
          }
        }
    `;
    return graphqlPaginate(query, nodes => nodes);
}

export async function fetchMergedPRs() {
    const year  = new Date().getFullYear();
    const query = `
        query($after: String) {
          search(query: "is:pr is:merged author:@me merged:>${year}-01-01 sort:updated-desc", type: ISSUE, first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              ... on PullRequest {
                number title url createdAt updatedAt mergedAt isDraft reviewDecision additions deletions
                repository { nameWithOwner url owner { avatarUrl } }
                reviews(last: 20) { nodes { state author { login avatarUrl } submittedAt } }
                commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
                comments { totalCount }
                labels(first: 5) { nodes { name color } }
              }
            }
          }
        }
    `;
    return graphqlPaginate(query, nodes => nodes.map(pr => ({ ...pr, _merged: true })));
}

export async function fetchClosedPRs() {
    const year  = new Date().getFullYear();
    const query = `
        query($after: String) {
          search(query: "is:pr is:closed is:unmerged author:@me closed:>${year}-01-01 sort:updated-desc", type: ISSUE, first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              ... on PullRequest {
                number title url createdAt updatedAt closedAt isDraft reviewDecision additions deletions
                repository { nameWithOwner url owner { avatarUrl } }
                commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
                comments { totalCount }
                labels(first: 5) { nodes { name color } }
              }
            }
          }
        }
    `;
    return graphqlPaginate(query, nodes => nodes.map(pr => ({ ...pr, _closed: true })));
}

async function graphqlPaginate(query, transform) {
    let results = [];
    let cursor  = null;

    do {
        const r = await fetch(GH_GRAPHQL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { after: cursor } }),
        });

        assertOk(r);
        const data = await r.json();
        assertGql(data);

        const search = data.data.search;
        results = results.concat(transform(search.nodes));
        cursor  = search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null;

    } while (cursor);

    return results;
}
