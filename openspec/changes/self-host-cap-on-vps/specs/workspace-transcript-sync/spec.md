## ADDED Requirements

### Requirement: Organization transcript discovery

The system SHALL discover every video that belongs to the new self-hosted organization and has completed transcription.

#### Scenario: Completed organization video is eligible

- **WHEN** a video has `videos.orgId` equal to the captured `TRANSCRIPT_SYNC_ORG_ID` and has `videos.transcriptionStatus` set to `COMPLETE`
- **THEN** the transcript sync process treats the video as eligible for persistence

### Requirement: Safe transcription triggering

The system SHALL trigger transcription for eligible organization videos that have no transcription status only after upload or processing is no longer active.

#### Scenario: Ready organization video has no transcription status

- **WHEN** an organization video has no active `video_uploads` row and `videos.transcriptionStatus` is null
- **THEN** the system queues the existing transcription workflow for that video

### Requirement: Transcript object retrieval

The system SHALL retrieve the generated transcript through the existing storage access abstraction using the key `{ownerId}/{videoId}/transcription.vtt`.

#### Scenario: Transcript object exists

- **WHEN** an eligible video has a transcript object at the expected key
- **THEN** the system reads the WebVTT content without requiring a public unauthenticated object URL

### Requirement: Separate Postgres transcript storage

The system SHALL persist transcript data into a separate Postgres database rather than Cap's primary MySQL database.

#### Scenario: Transcript database is configured

- **WHEN** transcript sync runs
- **THEN** it writes transcript records to Postgres database `cap_transcripts` using a dedicated application role

### Requirement: Organization ID capture

The system SHALL use the organization ID created during self-host onboarding as the initial transcript backfill scope.

#### Scenario: New organization is created

- **WHEN** the self-hosted deployment completes first-user organization setup
- **THEN** the operator records that organization ID as `TRANSCRIPT_SYNC_ORG_ID` before running transcript backfill

### Requirement: Transcript normalization

The system SHALL persist the raw WebVTT transcript and normalized transcript content suitable for downstream database queries.

#### Scenario: WebVTT transcript is synced

- **WHEN** the sync process reads a WebVTT transcript
- **THEN** it stores the raw VTT, normalized plain text, and timestamped cue data for the video

### Requirement: Idempotent persistence

The system SHALL persist transcript records idempotently so repeated sync runs do not create duplicates or automatically overwrite already synced transcript content.

#### Scenario: Transcript is synced twice

- **WHEN** the same video transcript is processed more than once
- **THEN** the Postgres database contains one transcript record for that video and variant and preserves the previously synced content

### Requirement: Edited transcript re-sync policy

The system SHALL NOT automatically re-sync edited transcript VTT files after a transcript has already been synced successfully.

#### Scenario: Transcript is edited after sync

- **WHEN** a transcript VTT file is edited after the first successful sync
- **THEN** the transcript sync process does not overwrite the existing Postgres transcript record during normal scheduled runs

### Requirement: Failure tracking and retry

The system SHALL track transcript sync failures and retry recoverable errors without blocking video playback or workspace access.

#### Scenario: Transcript object is temporarily unavailable

- **WHEN** an eligible video reports `COMPLETE` but the transcript object cannot be read
- **THEN** the system records the sync error and retries the transcript sync later

### Requirement: Backfill support

The system SHALL support a controlled backfill for existing organization videos.

#### Scenario: Operator starts backfill

- **WHEN** the operator runs transcript backfill for the configured organization
- **THEN** the system scans existing eligible videos and persists any missing transcript records
