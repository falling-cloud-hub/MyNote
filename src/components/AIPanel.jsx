import { useState, useRef, useEffect } from 'react'
import './AIPanel.css'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'
const SEARCH_API = 'https://api.duckduckgo.com/?q={query}&format=json&no_html=1'

export default function AIPanel({ notes, deepseekKey, isOpen, onToggle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const messagesEnd = useRef(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 构建笔记上下文
  const buildContext = () => {
    if (!notes || notes.length === 0) return ''
    const summaries = notes.slice(0, 30).map((n, i) =>
      `${i + 1}. 《${n.title || '未命名'}》(${n.id.slice(0, 8)}) — ${(n.content || '').slice(0, 80)}...`
    )
    return `\n用户共有 ${notes.length} 篇笔记，最近 30 篇：\n${summaries.join('\n')}`
  }

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || thinking) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)

    try {
      let searchContext = ''
      if (webSearch) {
        try {
          const searchRes = await fetch(SEARCH_API.replace('{query}', encodeURIComponent(userMsg.content)))
          const searchData = await searchRes.json()
          const results = (searchData.Results || searchData.results || []).slice(0, 5)
          if (results.length > 0) {
            searchContext = '\n\n[联网搜索结果]\n' + results.map((r, i) => `${i + 1}. ${r.Text || r.snippet || ''} (来源: ${r.FirstURL || r.url || ''})`).join('\n')
          }
        } catch (e) {
          console.warn('搜索失败:', e)
        }
      }

      const contextText = buildContext()
      const systemPrompt = `你是 MyNote 的 AI 助手。你可以访问用户的所有笔记。${contextText}\n\n规则：\n1. 优先用笔记内容回答用户问题\n2. 用户问"我写过什么关于XX的"时，从笔记中查找\n3. 回答简洁友好，用中文${searchContext ? '\n4. 以下联网搜索结果可供参考:\n' + searchContext : ''}`

      const res = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10),
            userMsg,
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `API 错误 ${res.status}`)
      }

      const data = await res.json()
      const aiMsg = { role: 'assistant', content: data.choices[0].message.content }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ 出错了：${err.message}`, error: true }])
    } finally {
      setThinking(false)
    }
  }

  const clearChat = () => setMessages([])

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        className={`ai-fab ${isOpen ? 'hidden' : ''}`}
        onClick={onToggle}
        title="AI 助手"
      >
        <span className="ai-fab-icon">✨</span>
      </button>

      {/* 聊天面板 */}
      <div className={`ai-panel ${isOpen ? 'open' : ''}`}>
        <div className="ai-panel-header">
          <h3>✨ AI 助手</h3>
          <div className="ai-panel-actions">
            <button
              className={`ai-web-btn ${webSearch ? 'active' : ''}`}
              onClick={() => setWebSearch(!webSearch)}
              title="联网搜索"
            >
              🌐
            </button>
            <button className="ai-clear-btn" onClick={clearChat} title="清空对话">
              🗑️
            </button>
            <button className="ai-close-btn" onClick={onToggle}>✕</button>
          </div>
        </div>

        <div className="ai-messages">
          {!deepseekKey && (
            <div className="ai-hint">
              ⚙️ 请在设置中填入 DeepSeek API Key 后使用
            </div>
          )}
          {deepseekKey && messages.length === 0 && (
            <div className="ai-welcome">
              <p>👋 你好！我是你的笔记助手。</p>
              <p>你可以问我：</p>
              <ul>
                <li>"我写过什么关于 React 的笔记？"</li>
                <li>"帮我总结所有笔记的要点"</li>
                <li>"最近一篇笔记是什么时候写的？"</li>
                {webSearch && <li>🌐 联网搜索已开启</li>}
              </ul>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role} ${msg.error ? 'error' : ''}`}>
              <div className="ai-message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="ai-message-content">{msg.content}</div>
            </div>
          ))}
          {thinking && (
            <div className="ai-message assistant">
              <div className="ai-message-avatar">🤖</div>
              <div className="ai-message-content">
                <span className="ai-typing">思考中<span className="dots">...</span></span>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <div className="ai-input-area">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={webSearch ? '输入问题（联网搜索已开启）...' : '向 AI 提问...'}
            disabled={!deepseekKey}
            className="ai-input"
          />
          <button
            className="ai-send-btn"
            onClick={sendMessage}
            disabled={!deepseekKey || thinking || !input.trim()}
          >
            ➤
          </button>
        </div>
      </div>
    </>
  )
}
