## Context

The repository already supports self-hosting with Docker Compose. The stack includes Cap Web, media-server, MySQL, MinIO, health checks, persistent volumes, database migrations on startup, and S3-compatible storage configuration.

Cap transcription currently depends on `DEEPGRAM_API_KEY`. Transcription is triggered from the web app when video status is requested and no transcription status exists. Completed transcripts are saved as WebVTT objects at `{ownerId}/{videoId}/transcription.vtt`, while MySQL stores `videos.transcriptionStatus = "COMPLETE"`. Team visibility is modeled separately through `shared_videos` for organization-level sharing and `space_videos` for specific team spaces.

The target deployment is a VPS reachable with:

```bash
ssh -i ~/.ssh/id_ed25519 vlad@204.12.163.253
```

The public Cap URL is `https://cap.cirqlecirqle.com`; the compose deployment derives `WEB_URL` and `NEXTAUTH_URL` from that origin. The first transcript backfill will target the new organization created during self-host onboarding. The transcript sync destination is a separate Postgres database named `cap_transcripts`, not Cap's primary MySQL database.

## Goals / Non-Goals

**Goals:**

- Deploy Cap on the VPS using the existing Docker Compose architecture.
- Configure production-grade secrets, public URLs, persistent volumes, and S3-compatible storage.
- Enable automatic transcription by configuring Deepgram and media-server access.
- Add an automated transcript sync path that stores transcripts for every video in the organization in a separate Postgres database without requiring a user to open each video page.
- Provide a deploy, verify, backup, and rollback plan that an operator can repeat.

**Non-Goals:**

- Replacing Deepgram with a local speech-to-text engine.
- Rewriting the recording, media processing, or existing transcription workflow.
- Migrating historical videos from another product beyond a transcript backfill for videos already in Cap.
- Building a full admin UI for transcript sync management in the first implementation.

## Decisions

1. Use Docker Compose on the VPS as the deployment unit.

   The repository already ships a compose topology that matches the required services and is CI-smoke-tested for self-hosting. Alternatives considered were a manual Node/MySQL/MinIO install and Kubernetes. Manual install adds operational drift, while Kubernetes is unnecessary for a single VPS deployment.

2. Use on-host MinIO for the first production deployment.

   MinIO is selected because it works with the repository's existing Compose topology, keeps the first deployment self-contained, and avoids introducing external bucket credentials before the product is validated. Video growth should be monitored; Cloudflare R2 or another S3-compatible provider remains a later migration path if VPS disk growth becomes the limiting factor.

3. Add backend automation for transcript readiness instead of relying on page views.

   Current transcription can start lazily when status is requested. The sync requirement is automatic, so a server-side sweeper should find ready videos, trigger missing transcription when safe, and sync completed transcript objects into the database.

4. Store both raw WebVTT and normalized transcript data in a separate Postgres database.

   Raw VTT preserves the source artifact exactly as Cap generated it at sync time. Normalized plain text and cue data make downstream querying easier without reparsing VTT on every read. Use Postgres database `cap_transcripts`, role `cap_transcripts_app`, and a generated password stored only in deployment secrets. A separate Postgres database avoids coupling downstream transcript consumers to Cap's MySQL schema and matches the existing server database direction.

5. Sync every video in the organization by `videos.orgId`.

   The desired scope is every video in the newly created organization, so the primary discovery filter should use `videos.orgId`. During initial onboarding, record the created organization ID into `TRANSCRIPT_SYNC_ORG_ID` before running backfill. The sharing tables remain useful for future narrower scopes, but they are not the default for this change.

6. Keep transcript sync idempotent.

   The target table should be unique by video ID and transcript variant. The normal sweeper should skip already synced transcript records so edited VTT files do not automatically overwrite downstream data. A future manual force-resync can be added if operators need it, but it is out of scope for the first pass.

## Risks / Trade-offs

- [Risk] VPS host is under-provisioned for media processing and uploads → Mitigation: start with conservative concurrency, monitor CPU/RAM/disk, and move object storage or MySQL off-host if usage grows.
- [Risk] Public storage endpoint or TLS is misconfigured, breaking playback and media-server access → Mitigation: verify `CAP_URL`, `S3_PUBLIC_URL`, MinIO proxy routing, and media-server health before onboarding users.
- [Risk] Transcription never starts for videos nobody opens → Mitigation: add the backend sweeper to queue transcription for completed uploads with null `transcriptionStatus`.
- [Risk] Transcript sync diverges from later manual transcript edits → Mitigation: treat the first successful sync as the downstream record and do not automatically re-sync edited VTT files.
- [Risk] Deepgram outage or missing API key blocks transcripts → Mitigation: surface sync/transcription error states, retry with backoff, and keep video upload/playback independent.
- [Risk] Backups miss one data store → Mitigation: back up MySQL, MinIO object data, and the separate Postgres transcript database, then test restore on a separate path.

## Migration Plan

1. Prepare the VPS with Docker, Compose, firewall rules, persistent storage directories, DNS for `cap.cirqlecirqle.com`, and TLS termination.
2. Copy or check out the repository deployment files on the VPS.
3. Create production environment values for secrets, `CAP_URL=https://cap.cirqlecirqle.com`, local bind ports, MySQL, MinIO, media-server webhook secret, Resend if needed, Deepgram, and Postgres `cap_transcripts`.
4. Start the stack and verify web health, media-server health, migrations, login, object upload, video playback, and transcription.
5. Complete first-user onboarding, create the new organization, and capture the organization ID as `TRANSCRIPT_SYNC_ORG_ID`.
6. Deploy the separate Postgres transcript sync schema and background job.
7. Run a limited backfill for the new organization, verify target database rows, then expand to all videos in the organization.
8. Document backup and rollback commands before opening the deployment to team usage.

Rollback for deployment is to stop the new compose stack and restore the prior MySQL data and object storage configuration from backup. Rollback for transcript sync is to disable the scheduled job while preserving synced Postgres records for audit or cleanup.

## Open Questions

- None. Deployment-time secret values still need to be generated and stored, but provider, bucket, database name, role name, domain, and sync scope are decided.
