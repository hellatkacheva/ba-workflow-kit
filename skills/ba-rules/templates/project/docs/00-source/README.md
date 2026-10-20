# 00-source — inputs

Read-only. Only the `ingest-confluence` skill writes here (new snapshots, regenerated working sources). All other steps only read.

| File | What it is | Source | Version |
|---|---|---|---|
<!-- rows added by ingest-confluence -->

## Source keys

Used in every reference as `[KEY · Section]`.

| Key | Meaning | Heading in the source |
|---|---|---|
<!-- rows added by ingest-confluence -->

## Snapshots

`confluence/<pageId>/v<N>/` — the page exactly as fetched (`page.html`, `page.md`, `meta.json`, `children/`). Never edited; a new version gets a new folder.

## Known missing inputs

<!-- e.g. files referenced in the source but not available; attachments to put into inbox/ -->
