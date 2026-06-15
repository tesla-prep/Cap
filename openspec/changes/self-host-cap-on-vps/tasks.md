## 1. Deployment Runbook

- [x] 1.1 Add a VPS self-hosting runbook that starts from `ssh -i ~/.ssh/id_ed25519 vlad@204.12.163.253`
- [x] 1.2 Document required VPS packages, firewall ports, DNS record for `cap.cirqlecirqle.com`, TLS termination, and persistent storage paths
- [x] 1.3 Document production environment variables, secret generation commands, `CAP_URL=https://cap.cirqlecirqle.com`, MinIO credentials, Postgres database `cap_transcripts`, and required non-default values
- [x] 1.4 Document startup, health check, login, upload, playback, transcription, backup, restore, and rollback procedures
- [x] 1.5 Document how to capture the newly created self-host organization ID into `TRANSCRIPT_SYNC_ORG_ID`

## 2. Deployment Configuration

- [x] 2.1 Verify the existing Compose topology covers Cap Web, media-server, MySQL, MinIO, volumes, and health checks for the VPS runbook
- [x] 2.2 Add or update a production-safe environment example for the VPS deployment using on-host MinIO as the initial object storage option
- [x] 2.3 Include Deepgram, email, MinIO credentials, media-server webhook, transcript Postgres database, and public URL configuration in the deployment example
- [x] 2.4 Add verification commands for web health, media-server health, database migration status, MinIO bucket access, and container status

## 3. Transcript Sync Postgres Data Model

- [x] 3.1 Add separate Postgres connection configuration for transcript persistence with database `cap_transcripts` and role `cap_transcripts_app`
- [x] 3.2 Add Postgres schema for synced transcript records with video ID, organization ID, raw VTT, plain text, cues JSON, status, timestamps, and error metadata
- [x] 3.3 Add uniqueness constraints that make transcript persistence idempotent per video and transcript variant
- [x] 3.4 Add migration artifacts for the transcript sync Postgres schema
- [x] 3.5 Add typed helpers for reading and writing transcript sync records

## 4. Transcript Sync Core

- [x] 4.1 Implement organization-wide video discovery through `videos.orgId = TRANSCRIPT_SYNC_ORG_ID`
- [x] 4.2 Skip videos with active upload or processing rows when deciding whether to trigger transcription
- [x] 4.3 Queue the existing transcription workflow for eligible organization videos with null transcription status
- [x] 4.4 Retrieve completed transcript VTT objects through the existing storage access abstraction
- [x] 4.5 Parse WebVTT into normalized plain text and timestamped cue records
- [x] 4.6 Insert missing transcript sync records without creating duplicates across repeated sync runs
- [x] 4.7 Skip already synced transcript records during normal scheduled runs so edited VTT files do not overwrite Postgres data
- [x] 4.8 Record recoverable sync errors for retry without blocking video playback or workspace access

## 5. Automation and Backfill

- [x] 5.1 Add a scheduled or manually callable backend entrypoint for transcript sync sweeps
- [x] 5.2 Add configuration for selecting the organization ID to sync through `TRANSCRIPT_SYNC_ORG_ID`
- [x] 5.3 Add a controlled backfill path for existing organization videos
- [x] 5.4 Add retry behavior for transcript reads and persistence failures
- [x] 5.5 Add operational logging that identifies scanned, queued, synced, skipped, and failed videos

## 6. Verification

- [x] 6.1 Add unit tests for VTT normalization and transcript record upsert behavior
- [x] 6.2 Add tests for organization discovery filters across `videos.orgId`, active uploads, completed transcriptions, and already synced transcript records
- [x] 6.3 Add tests or a smoke checklist for missing Deepgram key, missing transcript object, and retryable storage failures
- [x] 6.4 Run scoped formatter and checks for touched TypeScript, JSON, Markdown, and database files
- [x] 6.5 Validate the OpenSpec change before implementation is considered complete
