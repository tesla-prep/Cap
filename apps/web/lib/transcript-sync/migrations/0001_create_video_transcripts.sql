CREATE TABLE IF NOT EXISTS video_transcripts (
	id bigserial PRIMARY KEY,
	video_id varchar(32) NOT NULL,
	organization_id varchar(32) NOT NULL,
	owner_id varchar(32) NOT NULL,
	variant varchar(64) NOT NULL DEFAULT 'default',
	video_name text,
	raw_vtt text,
	plain_text text,
	cues jsonb NOT NULL DEFAULT '[]'::jsonb,
	status varchar(32) NOT NULL DEFAULT 'SYNCED',
	source_transcription_status varchar(32),
	source_created_at timestamptz,
	source_updated_at timestamptz,
	first_synced_at timestamptz,
	synced_at timestamptz,
	last_attempted_at timestamptz NOT NULL DEFAULT now(),
	error_count integer NOT NULL DEFAULT 0,
	last_error text,
	last_error_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT video_transcripts_status_check CHECK (status IN ('SYNCED', 'ERROR')),
	CONSTRAINT video_transcripts_synced_content_check CHECK (
		status <> 'SYNCED'
		OR (raw_vtt IS NOT NULL AND plain_text IS NOT NULL)
	),
	CONSTRAINT video_transcripts_video_variant_unique UNIQUE (video_id, variant)
);

CREATE INDEX IF NOT EXISTS video_transcripts_organization_synced_idx
	ON video_transcripts (organization_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS video_transcripts_status_attempted_idx
	ON video_transcripts (status, last_attempted_at DESC);
