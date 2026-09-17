CREATE TABLE auth_rate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_rate_events_lookup
    ON auth_rate_events (key_hash, event_type, created_at DESC);
