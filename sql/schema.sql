-- ============================================
-- MyNote 数据库表结构 + 安全策略
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 用户资料表（由 Supabase Auth 自动关联）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'full_name', 'Anonymous'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. 文件夹表（支持嵌套）
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 笔记表
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '未命名笔记',
  content TEXT DEFAULT '',
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at 自动更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. 标签表
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, user_id)
);

-- 5. 笔记-标签关联表
CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- ============================================
-- 行级安全策略 (RLS) — 用户只能看到自己的数据
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

-- profiles: 用户可读所有 profile，但只能改自己的
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- folders: 用户只能操作自己的文件夹
CREATE POLICY "folders_all" ON folders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notes: 用户只能操作自己的笔记
CREATE POLICY "notes_all" ON notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tags: 用户只能操作自己的标签
CREATE POLICY "tags_all" ON tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- note_tags: 通过关联的 note 来控制权限
CREATE POLICY "note_tags_select" ON note_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "note_tags_insert" ON note_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "note_tags_delete" ON note_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- ============================================
-- 实时订阅（可选，启用 Supabase Realtime）
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE folders;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
