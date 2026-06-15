## Why

Cap needs to run on a user-controlled VPS so recordings, workspace metadata, and transcript storage remain under the operator's infrastructure. The deployment should also support the main business workflow: automatically collecting transcripts from videos shared into the team workspace and persisting them into a database for downstream use.

## What Changes

- Define a production self-hosting plan for deploying Cap on the VPS accessible as `vlad@204.12.163.253` with SSH key authentication and `https://cap.cirqlecirqle.com` as the public Cap URL.
- Configure the self-hosted stack around Docker Compose services for Cap Web, media processing, MySQL, and on-host MinIO object storage.
- Document required production environment values, secrets, public URLs, storage endpoints, and AI provider credentials needed for transcription.
- Add an automated transcript sync capability that detects completed transcriptions for every video in the new self-hosted organization, reads the generated WebVTT transcript object, and stores raw and normalized transcript data in a separate Postgres database named `cap_transcripts`.
- Add operational guidance for initial deployment, verification, backup, retry, and backfill of existing videos.

## Capabilities

### New Capabilities

- `vps-self-hosting`: Deploy and operate Cap on a dedicated VPS using Docker Compose, production environment variables, persistent storage, TLS-ready public URLs, and health checks.
- `workspace-transcript-sync`: Automatically discover completed transcripts for every video in the newly created self-hosted organization and persist transcript records to `cap_transcripts` in an idempotent, retryable process.

### Modified Capabilities

None.

## Impact

- Affected systems: Docker Compose deployment, Cap Web, media-server, MySQL, MinIO object storage, DNS/TLS proxy, transcript workflow, and a separate Postgres transcript database.
- Affected configuration: `WEB_URL`, `NEXTAUTH_URL`, storage endpoints, database credentials, encryption/session secrets, media-server webhook secret, email settings, and `DEEPGRAM_API_KEY`.
- Affected code areas for implementation: web server background jobs or cron routes, database schema for stored transcripts, transcript object retrieval through existing storage access, and workspace filtering using `shared_videos` and `space_videos`.
- External dependencies: VPS SSH access, Docker, DNS records for `cap.cirqlecirqle.com`, TLS termination, Deepgram for transcription, Postgres database `cap_transcripts`, and backup storage for MySQL/Object data/Postgres transcript data.
