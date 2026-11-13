# Small GitHub deliveries

User preference recorded 2026-11-13: split security and performance work into small, recoverable activities. Limit GitHub upload sizes. Carry this workflow into future sessions.

## Resume before doing new work

1. Read `AGENTS.md`, this file and `docs/performance-security-review.md`.
2. Inspect the current remote branch head, open PRs and local changes. Previously completed work may already be on GitHub even when the chat stopped.
3. Recover verified commits and existing Git blobs. Do not redo a completed audit or upload a source archive again when its blob already exists.
4. Choose one concern. Aim for at most 10 hand-edited source/test files per activity. Split further when dependencies permit.
5. Run its relevant tests, commit it and record the commit SHA and next action. Finish the combined test/build checks before marking a PR ready.

## Why earlier sessions failed

Earlier attempts encountered missing CLI authentication and a 16 MiB connector request ceiling. A roughly 12 MB gzip archive expands to roughly 16 MB when base64 encoded, before JSON overhead. The build also duplicates source files under compatibility and versioned release paths. Sending those contents repeatedly adds avoidable upload work.

The audit subsequently reached GitHub in PR #33 at `a7763023207cbbe1ec261d70efd42be83807ddef`. Its runtime source, build, source archive and packaging fix are available there. Recover that work rather than assuming it is lost. The new `fix/audit-small-batches` branch preserves it in focused commits and adds the transfer planner. The older branch remains a recovery point.

## Request budgets

- Hard cap: **1,048,576 bytes per GitHub connector request**, measured after JSON serialization and UTF-8 or base64 encoding. This is a project limit, not a claim about GitHub's own maximum.
- Upload one unique missing blob per call. Reuse its SHA for every duplicate path.
- Create trees with at most **100 entries per request**, also within the byte cap. Apply successive tree batches to the tree returned by the previous call.
- Reference existing blob SHAs instead of embedding file contents in tree calls.
- If an individual missing blob exceeds the cap, stop before upload. Prepare a different delivery mechanism or artifact layout as a separate activity. Splitting a file across blob calls does not create one valid Git blob. Do not remove required source or license material to make a request fit.
- Keep images, maps and vendor bundles out of an unrelated source change. Do not rebuild vendor dependencies unless their inputs changed.

Use the offline planner before transferring a committed change:

```sh
node .github/scripts/plan-github-transfer.mjs \
  --repository mmmbeer/interactive-map \
  --base <verified-remote-head> \
  --head HEAD \
  --available-ref <another-verified-remote-commit> \
  --output /tmp/atlas-transfer-plan.json
```

Omit `--available-ref` when no other verified remote commit is relevant. Repeat it when needed. Verify those remote commits and their trees first. The planner uses local Git objects and does not establish that an object exists remotely. It writes SHA references and sizes, never blob contents or credentials. Exit code 1 means at least one missing blob is oversized or the inputs are invalid. The planner performs no upload.

The cap also applies to calls made outside the planner. Keep commit messages and PR bodies concise. Avoid printing whole trees, archives, patches or tool registries into chat. Print the summary and inspect only relevant files.

## Checkpoint and release order

The recovered audit is divided as follows. Source-only checkpoints are recovery commits on a work branch. They intentionally precede the matching distribution. Do not merge or publish an intermediate checkpoint. The final PR must contain the matching build and pass the unchanged CI distribution check.

| Chunk | Scope | Validation |
| --- | --- | --- |
| 1 | Import dimensions, complexity, asset paths, reference depth, validation reuse and spatial index bounds | `node --test tests/security-imports.test.mjs` |
| 2 | Bounded JSON, shared requests, independent cancellation and isolated map cache | `node --test tests/request-safety.test.mjs` |
| 3 | Canvas memory ceilings, hover reuse and frame-batched rendering | `node --test tests/render-budgets.test.mjs` |
| 4 | Deferred importer and upload loading, cancellable directory search worker | `node --test tests/startup-search.test.mjs` |
| 5 | Reproducible corresponding-source archive packaging | `node --test tests/source-packaging.test.mjs` |
| 6 | Transfer limits, workflow record and matching distribution | Planner tests, full `npm test`, `npm run build`, repeat-build byte comparison |

The first five remote checkpoint commits are `736e7542ae168d600cef42070509993cb4f30352`, `f6737df83188a8f4a0dc669c3f6eb605393eb2a3`, `8715f2d4b15a3eb69e88794cd1f4fb2dec2dfe27`, `96e5d5a7d32324ed74dd3065849c37177914bea7` and `c1f6f4578d1198e89727b735447409930fee1c59`, in table order. Each returned tree matched its local tree exactly. The largest request in those five checkpoints was 3,373 bytes.

Runtime source and packaging remain identical to PR #33. The existing combined performance test is separated into the three focused test files above without dropping its cases. The 1 MiB planner adds its own tests. Operational workflow files live outside the corresponding-source archive inputs so documenting progress does not trigger an unrelated archive upload.

For each remote update, save the returned tree and commit SHA before the next mutation. Verify the branch after updating it. On a timeout, read the remote state before retrying. Never force-push an unknown head. Publish the final work branch only after the full tree matches the locally verified release. Preserve the original branch until the replacement is verified.

## Follow-up activities

The recovered audit fixes the high-impact issues. Keep the remaining medium and lower-impact work separate, in this order. The review contains the evidence and limitations.

| Activity | Scope | Completion check |
| --- | --- | --- |
| PDF export | Move document generation to a worker and reduce simultaneous buffers | Cancellation, representative large export, matching PDF links and entries |
| Label identity | Resolve names without generating unused narrative content | Released name/content snapshots unchanged |
| Import wizard | Worker survey conversion and cached source grouping | Cancellation and latest-input preview behavior |
| Local storage | Metadata store and immutable originals | IndexedDB migration, restore and backup tests |
| Routing | Debounce and replace pending routes | Latest route wins, graph cache reuse |
| Connected content | Option freshness and batched storage writes | Offline fallback and concurrent request tests |
| UI refreshes | One editor preview path and append-only pagination | Editor and directory behavior checks |
| CSP | Add an explicit form-action restriction | Form workflows and production response headers |

Do not combine these into another audit-sized push. One activity gets one focused implementation and validation cycle. Build and commit the matching distribution for each mergeable change. Use temporary source checkpoints only when needed for recovery.
