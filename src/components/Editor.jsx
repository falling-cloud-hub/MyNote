import { useState, useEffect, useRef, useCallback } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import './Editor.css'

export default function Editor({ note, folders, tags, onDataChange, onNoteChange }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [noteTags, setNoteTags] = useState([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [viewMode, setViewMode] = useState('live') // 'edit' | 'live' | 'preview'
  const fileInputRef = useRef(null)
  const saveTimer = useRef(null)
  const noteIdRef = useRef(null)

  // 切换笔记时同步状态
  useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setContent(note.content || '')
      setSaved(true)
      noteIdRef.current = note.id
      loadNoteTags(note.id)
    } else {
      setTitle('')
      setContent('')
      setNoteTags([])
      noteIdRef.current = null
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [note?.id])

  const loadNoteTags = async (noteId) => {
    const { data } = await supabase
      .from('note_tags')
      .select('tag_id, tags(name)')
      .eq('note_id', noteId)
    if (data) setNoteTags(data.map(d => ({ id: d.tag_id, name: d.tags.name })))
  }

  // 自动保存（防抖）
  const autoSave = useCallback((newTitle, newContent) => {
    if (!note) return
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const { error } = await supabase
        .from('notes')
        .update({ title: newTitle || '未命名笔记', content: newContent, updated_at: new Date().toISOString() })
        .eq('id', note.id)
      if (!error) {
        setSaved(true)
        onNoteChange({ ...note, title: newTitle, content: newContent })
        onDataChange()
      }
      setSaving(false)
    }, 800)
  }, [note, onDataChange, onNoteChange])

  const handleTitleChange = (e) => { setTitle(e.target.value); autoSave(e.target.value, content) }
  const handleContentChange = (val) => { setContent(val || ''); autoSave(title, val || '') }

  const handleFolderChange = async (e) => {
    const folderId = e.target.value || null
    await supabase.from('notes').update({ folder_id: folderId }).eq('id', note.id)
    onNoteChange({ ...note, folder_id: folderId })
    onDataChange()
  }

  // ===== 标签 =====
  const addTag = async (tagId) => {
    if (!note) return
    const { error } = await supabase.from('note_tags').insert({ note_id: note.id, tag_id: tagId })
    if (!error) { loadNoteTags(note.id); onDataChange() }
    setShowTagPicker(false)
  }
  const removeTag = async (tagId) => {
    if (!note) return
    await supabase.from('note_tags').delete().eq('note_id', note.id).eq('tag_id', tagId)
    loadNoteTags(note.id); onDataChange()
  }
  const unusedTags = tags.filter(t => !noteTags.find(nt => nt.id === t.id))

  // ===== 导入 .md 文件 =====
  const importMd = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target.result
      const fileName = file.name.replace(/\.md$/i, '')
      const { data, error } = await supabase
        .from('notes')
        .insert({ title: fileName, content: text, user_id: user.id })
        .select().single()
      if (!error && data) { onDataChange(); onNoteChange(data) }
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  // ===== 导出 .md 文件 =====
  const exportMd = () => {
    if (!note) return
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || '未命名笔记'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ===== 插入图片 =====
  const insertImage = () => {
    if (!imageUrl.trim()) { setShowImageInput(false); return }
    const mdImage = `![图片](${imageUrl.trim()})`
    setContent(prev => prev + '\n' + mdImage + '\n')
    autoSave(title, content + '\n' + mdImage + '\n')
    setImageUrl('')
    setShowImageInput(false)
  }

  // 监听剪贴板粘贴图片
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (ev) => {
          const base64 = ev.target.result
          const mdImage = `![图片](${base64})`
          setContent(prev => prev + '\n' + mdImage + '\n')
          autoSave(title, content + '\n' + mdImage + '\n')
        }
        reader.readAsDataURL(blob)
        break
      }
    }
  }, [content, title, autoSave])

  // 未选中笔记
  if (!note) {
    return (
      <main className="editor-area empty-editor" onPaste={handlePaste}>
        <div className="empty-state">
          <span className="empty-icon">📒</span>
          <h2>选择一个笔记</h2>
          <p>从左侧列表选择笔记开始编辑，或点击「+ 新建笔记」</p>
        </div>
      </main>
    )
  }

  const saveStatus = saving ? '⏳ 保存中...' : saved ? '✅ 已保存' : '📝 未保存'

  return (
    <main className="editor-area" onPaste={handlePaste}>
      {/* 视图模式切换行 */}
      <div className="view-mode-bar">
        <button className={`view-mode-btn ${viewMode === 'edit' ? 'active' : ''}`} onClick={() => setViewMode('edit')}>
          ✏️ 编辑
        </button>
        <button className={`view-mode-btn ${viewMode === 'live' ? 'active' : ''}`} onClick={() => setViewMode('live')}>
          📑 分屏
        </button>
        <button className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}>
          👁️ 预览
        </button>
      </div>

      {/* 工具栏 */}
      <div className="editor-toolbar">
        <input className="title-input" value={title} onChange={handleTitleChange} placeholder="笔记标题..." />

        <div className="toolbar-actions">
          {/* 导入 */}
          <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="导入 .md 文件">
            <span className="btn-icon">📥</span> 导入
          </button>
          <input ref={fileInputRef} type="file" accept=".md,.markdown" onChange={importMd} hidden />

          {/* 导出 */}
          <button className="toolbar-btn" onClick={exportMd} title="导出为 .md 文件">
            <span className="btn-icon">📤</span> 导出
          </button>

          {/* 插入图片 */}
          <button className="toolbar-btn" onClick={() => setShowImageInput(!showImageInput)} title="插入图片">
            <span className="btn-icon">🖼️</span> 图片
          </button>

          {/* 文件夹选择 */}
          <select className="folder-select" value={note.folder_id || ''} onChange={handleFolderChange}>
            <option value="">📁 无文件夹</option>
            {folders.map(f => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
          </select>

          <span className="save-status">{saveStatus}</span>
        </div>
      </div>

      {/* 图片 URL 输入弹窗 */}
      {showImageInput && (
        <div className="image-input-bar">
          <input
            autoFocus
            placeholder="输入图片 URL，或直接 Ctrl+V 粘贴图片..."
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') insertImage(); if (e.key === 'Escape') setShowImageInput(false) }}
            className="image-url-input"
          />
          <button className="toolbar-btn" onClick={insertImage}>插入</button>
          <button className="toolbar-btn" onClick={() => setShowImageInput(false)}>取消</button>
        </div>
      )}

      {/* 标签栏 */}
      <div className="tag-bar">
        {noteTags.map(tag => (
          <span key={tag.id} className="note-tag"># {tag.name}<button onClick={() => removeTag(tag.id)}>×</button></span>
        ))}
        <button className="add-tag-btn" onClick={() => setShowTagPicker(!showTagPicker)}>+ 标签</button>
        {showTagPicker && unusedTags.length > 0 && (
          <div className="tag-picker">
            {unusedTags.map(tag => (
              <div key={tag.id} className="tag-picker-item" onClick={() => addTag(tag.id)}># {tag.name}</div>
            ))}
          </div>
        )}
        {showTagPicker && unusedTags.length === 0 && (
          <div className="tag-picker"><div className="tag-picker-empty">没有更多标签</div></div>
        )}
      </div>

      {/* Markdown 编辑器 */}
      <div className="md-editor-wrapper" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          height="100%"
          preview={viewMode}
          visibleDragbar={false}
          hideToolbar={false}
        />
      </div>
    </main>
  )
}
