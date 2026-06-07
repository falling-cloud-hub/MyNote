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
  const [noteTags, setNoteTags] = useState([]) // 当前笔记的标签
  const [showTagPicker, setShowTagPicker] = useState(false)
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
    // 清除旧的保存定时器
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [note?.id])

  // 加载笔记的标签
  const loadNoteTags = async (noteId) => {
    const { data } = await supabase
      .from('note_tags')
      .select('tag_id, tags(name)')
      .eq('note_id', noteId)
    if (data) {
      setNoteTags(data.map(d => ({ id: d.tag_id, name: d.tags.name })))
    }
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
        .update({
          title: newTitle || '未命名笔记',
          content: newContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id)

      if (!error) {
        setSaved(true)
        onNoteChange({ ...note, title: newTitle, content: newContent })
        onDataChange()
      }
      setSaving(false)
    }, 800)
  }, [note, onDataChange, onNoteChange])

  const handleTitleChange = (e) => {
    const val = e.target.value
    setTitle(val)
    autoSave(val, content)
  }

  const handleContentChange = (val) => {
    setContent(val || '')
    autoSave(title, val || '')
  }

  // 文件夹切换
  const handleFolderChange = async (e) => {
    const folderId = e.target.value || null
    await supabase
      .from('notes')
      .update({ folder_id: folderId })
      .eq('id', note.id)
    onNoteChange({ ...note, folder_id: folderId })
    onDataChange()
  }

  // 标签操作
  const addTag = async (tagId) => {
    if (!note) return
    const { error } = await supabase
      .from('note_tags')
      .insert({ note_id: note.id, tag_id: tagId })
    if (!error) {
      loadNoteTags(note.id)
      onDataChange()
    }
    setShowTagPicker(false)
  }

  const removeTag = async (tagId) => {
    if (!note) return
    await supabase
      .from('note_tags')
      .delete()
      .eq('note_id', note.id)
      .eq('tag_id', tagId)
    loadNoteTags(note.id)
    onDataChange()
  }

  const unusedTags = tags.filter(t => !noteTags.find(nt => nt.id === t.id))

  // 未选中笔记
  if (!note) {
    return (
      <main className="editor-area empty-editor">
        <div className="empty-state">
          <span className="empty-icon">📒</span>
          <h2>选择一个笔记</h2>
          <p>从左侧列表选择笔记开始编辑，或点击「+ 新建笔记」</p>
        </div>
      </main>
    )
  }

  // 保存状态指示
  const saveStatus = saving ? '⏳ 保存中...' : saved ? '✅ 已保存' : '📝 未保存'

  return (
    <main className="editor-area">
      {/* 工具栏 */}
      <div className="editor-toolbar">
        <input
          className="title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="笔记标题..."
        />

        <div className="toolbar-actions">
          {/* 文件夹选择 */}
          <select
            className="folder-select"
            value={note.folder_id || ''}
            onChange={handleFolderChange}
          >
            <option value="">📁 无文件夹</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>

          {/* 保存状态 */}
          <span className="save-status">{saveStatus}</span>
        </div>
      </div>

      {/* 标签栏 */}
      <div className="tag-bar">
        {noteTags.map(tag => (
          <span key={tag.id} className="note-tag">
            # {tag.name}
            <button onClick={() => removeTag(tag.id)}>×</button>
          </span>
        ))}
        <button
          className="add-tag-btn"
          onClick={() => setShowTagPicker(!showTagPicker)}
        >
          + 标签
        </button>

        {showTagPicker && unusedTags.length > 0 && (
          <div className="tag-picker">
            {unusedTags.map(tag => (
              <div key={tag.id} className="tag-picker-item" onClick={() => addTag(tag.id)}>
                # {tag.name}
              </div>
            ))}
          </div>
        )}
        {showTagPicker && unusedTags.length === 0 && (
          <div className="tag-picker">
            <div className="tag-picker-empty">没有更多标签</div>
          </div>
        )}
      </div>

      {/* Markdown 编辑器 */}
      <div className="md-editor-wrapper" data-color-mode="dark">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          height="100%"
          preview="live"
          visibleDragbar={false}
        />
      </div>
    </main>
  )
}
