-- Create bank_config table
CREATE TABLE bank_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    clabe TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT clabe_length_check CHECK (length(clabe) = 18)
);

-- RLS Policies
ALTER TABLE bank_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access only to active configuration
CREATE POLICY "Public read access to active bank config"
    ON bank_config
    FOR SELECT
    TO public
    USING (active = true);

-- Enable updated_at trigger (assuming the trigger function update_modified_column exists from auth migration)
CREATE TRIGGER update_bank_config_modtime
    BEFORE UPDATE ON bank_config
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Insert a dummy bank configuration so the frontend doesn't crash empty
INSERT INTO bank_config (bank_name, account_holder, clabe, active)
VALUES ('BBVA Bancomer', 'Restaurante Edén', '012345678912345678', true);
