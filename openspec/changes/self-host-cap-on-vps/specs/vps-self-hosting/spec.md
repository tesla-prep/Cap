## ADDED Requirements

### Requirement: VPS deployment target

The deployment process SHALL support installing and operating Cap on the VPS reachable through SSH key authentication as `vlad@204.12.163.253`.

#### Scenario: Operator connects to the server

- **WHEN** the operator runs `ssh -i ~/.ssh/id_ed25519 vlad@204.12.163.253`
- **THEN** the operator can access the deployment host used for Cap self-hosting tasks

### Requirement: Public Cap domain

The deployment SHALL use `https://cap.cirqlecirqle.com` as the public Cap origin.

#### Scenario: Public URL is configured

- **WHEN** the deployment environment is prepared
- **THEN** Cap Web receives `https://cap.cirqlecirqle.com` as its public URL and authentication callback origin

### Requirement: Compose-managed Cap services

The deployment SHALL run Cap Web, media-server, MySQL, and MinIO as Compose-managed services with persistent data volumes.

#### Scenario: Services start successfully

- **WHEN** the operator starts the deployment stack
- **THEN** Cap Web, media-server, MySQL, MinIO, and transcript Postgres report healthy status or a documented equivalent readiness signal

### Requirement: Production environment configuration

The deployment SHALL require production values for public web URL, database credentials, encryption key, session secret, media-server webhook secret, MinIO credentials, transcript Postgres credentials, and transcription provider key.

#### Scenario: Required values are configured

- **WHEN** the deployment environment file is prepared
- **THEN** it contains non-default secrets and public URLs suitable for the VPS deployment

### Requirement: MinIO storage selection

The deployment SHALL use the Compose-managed MinIO service as the initial object storage target.

#### Scenario: MinIO bucket is configured

- **WHEN** production storage credentials are created
- **THEN** Cap storage environment values point to the MinIO bucket exposed through the Cap domain and internal Docker network

### Requirement: Public routing and storage access

The deployment SHALL expose Cap Web and object storage through URLs that are reachable by browsers, the desktop client, and the media-server workflow.

#### Scenario: Video playback can read stored media

- **WHEN** a recorded video is uploaded and opened from the Cap share page
- **THEN** the browser can retrieve the video media and related assets from the configured object storage endpoint

### Requirement: Deployment verification

The deployment SHALL include a repeatable verification procedure for web health, media-server health, database migrations, login flow, object storage access, upload, playback, and transcription.

#### Scenario: Operator validates a fresh deployment

- **WHEN** the operator follows the verification procedure after starting the stack
- **THEN** the operator can confirm that Cap is ready for team use before onboarding users

### Requirement: Backup and restore readiness

The deployment SHALL define backup and restore procedures for both MySQL data and object storage data.

#### Scenario: Operator prepares recovery coverage

- **WHEN** production deployment is completed
- **THEN** the operator has documented commands or automation for backing up and restoring database records and stored video/transcript objects
