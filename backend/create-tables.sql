-- Create schedule_settings table for company context and settings
CREATE TABLE IF NOT EXISTS schedule_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Company Context
  company_name TEXT NOT NULL,
  company_industry TEXT,
  company_description TEXT,
  target_audience TEXT,
  brand_voice TEXT,
  business_goals TEXT,
  -- Scheduler Settings
  platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram', 'twitter', 'linkedin'],
  frequency_hours INTEGER DEFAULT 4,
  active_hours_start TIME DEFAULT '08:00',
  active_hours_end TIME DEFAULT '22:00',
  is_active BOOLEAN DEFAULT false,
  auto_publish BOOLEAN DEFAULT false,
  -- Content Settings
  themes TEXT[] DEFAULT ARRAY['tips_studio', 'motivazionale', 'spiegazioni_semplici'],
  competitor_analysis BOOLEAN DEFAULT true,
  ai_debate_enabled BOOLEAN DEFAULT false,
  -- Default Settings
  default_tone TEXT DEFAULT 'professional',
  default_hashtags TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  hashtags TEXT,
  platform TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,
  scheduled_time TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, scheduled, published, failed
  published_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create generated_content table for AI history
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  tone TEXT,
  platforms TEXT[],
  content JSONB,
  hashtags TEXT,
  ai_debate_used BOOLEAN DEFAULT false,
  debate_transcript JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create brand_assets table
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'logo', 'template'
  platform TEXT, -- for templates: 'facebook', 'instagram', etc.
  file_url TEXT NOT NULL,
  file_path TEXT,
  is_active BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create composition_settings table
CREATE TABLE IF NOT EXISTS composition_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_apply_logo BOOLEAN DEFAULT true,
  auto_apply_template BOOLEAN DEFAULT true,
  logo_position TEXT DEFAULT 'bottom-right',
  logo_size INTEGER DEFAULT 150,
  overlay_opacity NUMERIC DEFAULT 0.9,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create generated_images table
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES generated_content(id),
  platform TEXT,
  ai_image_url TEXT,
  composed_image_url TEXT,
  has_brand_assets BOOLEAN DEFAULT false,
  size JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_debates table
CREATE TABLE IF NOT EXISTS ai_debates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES generated_content(id),
  topic TEXT NOT NULL,
  platforms TEXT[],
  tone TEXT,
  debate_history JSONB,
  final_content TEXT,
  consensus_reached BOOLEAN DEFAULT false,
  rounds INTEGER,
  insights TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  platform TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'likes', 'comments', 'shares', 'clicks', 'reach'
  value INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_time ON posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_generated_content_topic ON generated_content(topic);
CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON brand_assets(type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_post_id ON performance_metrics(post_id);

-- Add triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schedule_settings_updated_at BEFORE UPDATE ON schedule_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_composition_settings_updated_at BEFORE UPDATE ON composition_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings if not exists
INSERT INTO schedule_settings (
  company_name,
  company_industry,
  company_description,
  target_audience,
  brand_voice,
  business_goals
) 
SELECT 
  'Up to Ten',
  'Educazione, Ripetizioni Scientifiche, Formazione STEM',
  'Up to Ten è il centro di eccellenza per le ripetizioni a Milano di Matematica, Fisica, Informatica e tutte le materie scientifiche per medie, liceo e università.',
  'Studenti delle scuole medie, liceo e università, genitori che cercano supporto scolastico di qualità',
  'Professionale ma amichevole, innovativo, orientato ai risultati, empatico con le difficoltà degli studenti',
  'Aumentare le iscrizioni ai corsi, posizionarsi come leader nelle ripetizioni scientifiche a Milano'
WHERE NOT EXISTS (SELECT 1 FROM schedule_settings LIMIT 1);

-- Insert default composition settings if not exists  
INSERT INTO composition_settings (
  auto_apply_logo,
  auto_apply_template,
  logo_position,
  logo_size,
  overlay_opacity
)
SELECT true, true, 'bottom-right', 150, 0.9
WHERE NOT EXISTS (SELECT 1 FROM composition_settings LIMIT 1);