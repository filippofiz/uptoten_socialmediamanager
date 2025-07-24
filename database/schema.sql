-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Social accounts table
CREATE TABLE social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin')),
  account_name TEXT NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hashtags TEXT[],
  image_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  published_time TIMESTAMP WITH TIME ZONE,
  platforms TEXT[] NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  theme TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Post results table
CREATE TABLE post_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  url TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  engagement JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Content templates table
CREATE TABLE content_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  caption_template TEXT NOT NULL,
  hashtag_sets JSONB,
  image_style TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Scheduling rules table
CREATE TABLE scheduling_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platforms TEXT[] NOT NULL,
  posting_times JSONB NOT NULL,
  frequency TEXT CHECK (frequency IN ('hourly', 'daily', 'weekly', 'custom')),
  themes TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Analytics table
CREATE TABLE analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, platform, date)
);

-- User settings table
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  notifications JSONB DEFAULT '{"email": true, "push": false}',
  ai_settings JSONB DEFAULT '{"auto_generate": true, "quality": "high", "style": "professional"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Schedule settings table
CREATE TABLE schedule_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platforms TEXT[] DEFAULT '{"facebook","instagram","twitter","linkedin"}',
  frequency_hours INTEGER DEFAULT 4,
  active_hours_start TEXT DEFAULT '08:00',
  active_hours_end TEXT DEFAULT '22:00',
  themes TEXT[] DEFAULT '{"tips_studio","motivazionale","spiegazioni_semplici"}',
  competitor_analysis BOOLEAN DEFAULT true,
  ai_debate_enabled BOOLEAN DEFAULT true,
  auto_publish BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Uploaded assets table
CREATE TABLE uploaded_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  type TEXT CHECK (type IN ('logo', 'background', 'template', 'overlay')),
  url TEXT NOT NULL,
  dimensions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- AI debate results table
CREATE TABLE ai_debate_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  consensus_score INTEGER,
  improvements TEXT[],
  iterations INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Competitor insights table
CREATE TABLE competitor_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  trending_topics TEXT[],
  best_posting_times TEXT[],
  popular_hashtags TEXT[],
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(platform, date)
);

-- Auto post errors table
CREATE TABLE auto_post_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own social accounts" ON social_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own posts" ON posts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own post results" ON post_results
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM posts WHERE posts.id = post_results.post_id));

CREATE POLICY "Users can manage own templates" ON content_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own scheduling rules" ON scheduling_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analytics" ON analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_time ON posts(scheduled_time);
CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX idx_analytics_user_date ON analytics(user_id, date);