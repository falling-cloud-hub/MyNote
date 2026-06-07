import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import './Settings.css'

export default function Settings({ isOpen, onClose, deepseekKey, onDeepseekKeyChange }) {
  const { user } = useAuth()
  const [keyInput, setKeyInput] = useState(deepseekKey || '')
  const [tokens, setTokens] = useState([])
  const [newTokenName, setNewTokenName] = useState('')
  const [showApiDocs, setShowApiDocs] = useState(false)

  useEffect(() => {
    setKeyInput(deepseekKey || '')
    if (isOpen) loadTokens()
  }, [deepseekKey, isOpen])

  const loadTokens = async () => {
    const { data } = await supabase.from('api_tokens').select('*').order('created_at', { ascending: false })
    if (data) setTokens(data)
  }

  const saveKey = () => {
    onDeepseekKeyChange(keyInput.trim())
    localStorage.setItem('mynote_deepseek_key', keyInput.trim())
  }

  const generateToken = async () => {
    const token = crypto.randomUUID()
    const { error } = await supabase.from('api_tokens').insert({
      user_id: user.id,
      name: newTokenName.trim() || '默认令牌',
      token,
    })
    if (!error) {
      setNewTokenName('')
      loadTokens()
    }
  }

  const revokeToken = async (id) => {
    await supabase.from('api_tokens').delete().eq('id', id)
    loadTokens()
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

  return (
    <div className={`settings-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ 设置</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* AI 配置 */}
          <div className="settings-section">
            <h3>🤖 AI 助手 (DeepSeek)</h3>
            <p className="settings-desc">接入后 AI 可查找笔记、回答问题、联网搜索。</p>
            <label className="settings-label">
              DeepSeek API Key
              <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="sk-..." className="settings-input" />
            </label>
            <p className="settings-hint">
              在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com</a> 免费获取
            </p>
            <button className="settings-save-btn" onClick={saveKey}>💾 保存</button>
          </div>

          <div className="settings-divider" />

          {/* API Token */}
          <div className="settings-section">
            <h3>🔑 API 访问令牌</h3>
            <p className="settings-desc">
              生成令牌后，外部 AI Agent 可通过 Supabase API 直接操作你的笔记。
            </p>

            <div className="token-list">
              {tokens.map(t => (
                <div key={t.id} className="token-row">
                  <div className="token-info">
                    <span className="token-name">{t.name}</span>
                    <span className="token-value" title={t.token}>{t.token.slice(0, 16)}...</span>
                    <span className="token-date">{new Date(t.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <button className="token-revoke" onClick={() => revokeToken(t.id)}>吊销</button>
                </div>
              ))}
              {tokens.length === 0 && <p className="settings-hint">暂无令牌</p>}
            </div>

            <div className="token-create">
              <input value={newTokenName} onChange={e => setNewTokenName(e.target.value)} placeholder="令牌名称（可选）" className="settings-input small" />
              <button className="settings-save-btn" onClick={generateToken}>生成新令牌</button>
            </div>

            <button className="api-docs-toggle" onClick={() => setShowApiDocs(!showApiDocs)}>
              📖 {showApiDocs ? '收起' : '查看'} API 使用文档
            </button>

            {showApiDocs && (
              <div className="api-docs">
                <h4>外部 Agent 使用方法</h4>
                <p>将以下信息提供给外部 AI Agent：</p>
                <pre className="api-code">{`# 连接信息
SUPABASE_URL = "${supabaseUrl}"
SUPABASE_ANON_KEY = "${supabaseKey}"
API_TOKEN = "你的令牌完整值"

# 使用 Supabase SDK 访问
# 1. 用 token 获取 user_id
# 2. 以该 user_id 查询/操作 notes 表

# 示例：查询所有笔记
curl "${supabaseUrl}/rest/v1/notes?select=*" \\
  -H "apikey: ${supabaseKey}" \\
  -H "Authorization: Bearer ${supabaseKey}" \\
  -H "x-api-token: YOUR_TOKEN"

# Agent 可执行的操作：
# - 读取笔记：GET /rest/v1/notes
# - 创建笔记：POST /rest/v1/notes
# - 更新笔记：PATCH /rest/v1/notes?id=eq.xxx
# - 删除笔记：DELETE /rest/v1/notes?id=eq.xxx
# - 管理文件夹：/rest/v1/folders
# - 管理标签：/rest/v1/tags, /rest/v1/note_tags`}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
