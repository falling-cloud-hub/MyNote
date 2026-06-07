-- ============================================
-- MyNote v2 升级 SQL
-- 在 Supabase SQL Editor 中运行（追加到已有表之后）
-- ============================================

-- 6. API Token 表（外部 Agent 访问用）
CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '默认令牌',
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- RLS：用户只能管理自己的 token
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_tokens_self" ON api_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 外部 Agent 验证函数：用 token 查找对应 user_id
CREATE OR REPLACE FUNCTION get_user_by_token(token_input TEXT)
RETURNS UUID AS $$
  SELECT user_id FROM api_tokens WHERE token = token_input;
$$ LANGUAGE sql SECURITY DEFINER;

-- 更新 token 最后使用时间
CREATE OR REPLACE FUNCTION touch_token(token_input TEXT)
RETURNS VOID AS $$
  UPDATE api_tokens SET last_used_at = now() WHERE token = token_input;
$$ LANGUAGE sql SECURITY DEFINER;
