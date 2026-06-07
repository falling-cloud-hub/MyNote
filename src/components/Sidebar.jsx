import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import './Sidebar.css'

export default function Sidebar({
  notes,
  folders,
  tags,
  tagNoteMap,
  activeNote,
  activeFolder,
  activeTag,
  collapsed,
  onToggle,
  onSelectNote,
  onSelectFolder,
  onSelectTag,
  onDataChange,
}) {
  const { user } = useAuth()
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showNewTag, setShowNewTag] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [folderParentId, setFolderParentId] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { type, id, name }
  const [deleteMode, setDeleteMode] = useState(false)
  const [checkedNotes, setCheckedNotes] = useState(new Set())
  const [nestedFolderLimit, setNestedFolderLimit] = useState(false)

  // ===== 笔记操作 =====
  const createNote = async (folderId = null) => {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: '未命名笔记',
        content: '',
        folder_id: folderId,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      onDataChange()
      onSelectNote(data)
    }
  }

  const deleteNote = async (noteId) => {
    await supabase.from('notes').delete().eq('id', noteId)
    if (activeNote?.id === noteId) onSelectNote(null)
    onDataChange()
  }

  // 批量删除选中笔记
  const deleteCheckedNotes = async () => {
    if (checkedNotes.size === 0) return
    for (const id of checkedNotes) {
      await supabase.from('notes').delete().eq('id', id)
    }
    if (activeNote && checkedNotes.has(activeNote.id)) onSelectNote(null)
    setCheckedNotes(new Set())
    setDeleteMode(false)
    setDeleteConfirm(null)
    onDataChange()
  }

  const toggleCheckNote = (noteId) => {
    setCheckedNotes(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  // ===== 文件夹操作 =====
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    // 检查嵌套深度：如果选中的父文件夹本身已有父文件夹，拒绝
    if (folderParentId) {
      const parentFolder = folders.find(f => f.id === folderParentId)
      if (parentFolder?.parent_id) {
        setNestedFolderLimit(true)
        setTimeout(() => setNestedFolderLimit(false), 3000)
        return
      }
    }
    const { error } = await supabase
      .from('folders')
      .insert({
        name: newFolderName.trim(),
        parent_id: folderParentId,
        user_id: user.id,
      })
    if (!error) {
      setNewFolderName('')
      setShowNewFolder(false)
      setFolderParentId(null)
      onDataChange()
    }
  }

  const deleteFolder = async (folderId) => {
    await supabase.from('folders').delete().eq('id', folderId)
    if (activeFolder === folderId) onSelectFolder(null)
    setDeleteConfirm(null)
    onDataChange()
  }

  const toggleFolder = (id) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ===== 标签操作 =====
  const createTag = async () => {
    if (!newTagName.trim()) return
    const { error } = await supabase
      .from('tags')
      .insert({
        name: newTagName.trim(),
        user_id: user.id,
      })
    if (!error) {
      setNewTagName('')
      setShowNewTag(false)
      onDataChange()
    }
  }

  const deleteTag = async (tagId) => {
    await supabase.from('tags').delete().eq('id', tagId)
    if (activeTag === tagId) onSelectTag(null)
    setDeleteConfirm(null)
    onDataChange()
  }

  // ===== 构建文件夹树 =====
  const rootFolders = folders.filter(f => !f.parent_id)
  const childFolders = (parentId) => folders.filter(f => f.parent_id === parentId)

  const renderFolder = (folder, depth = 0) => {
    const children = childFolders(folder.id)
    const isExpanded = expandedFolders.has(folder.id)
    const isActive = activeFolder === folder.id
    const noteCount = notes.filter(n => n.folder_id === folder.id).length

    return (
      <div key={folder.id}>
        <div
          className={`folder-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
        >
          <span className="folder-arrow" onClick={() => toggleFolder(folder.id)}>
            {children.length > 0 ? (isExpanded ? '▼' : '▶') : '  '}
          </span>
          <span className="folder-icon">📁</span>
          <span className="folder-name" onClick={() => onSelectFolder(folder.id)}>
            {folder.name}
            <span className="note-count">{noteCount}</span>
          </span>
          <button
            className="folder-delete"
            title="删除文件夹"
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'folder', id: folder.id, name: folder.name }) }}
          >
            🗑️
          </button>
        </div>
        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
      </div>
    )
  }

  // 当前文件夹下的笔记
  const folderNotes = notes.filter(n => !n.folder_id && !activeFolder)
  const displayNotes = activeFolder
    ? notes.filter(n => n.folder_id === activeFolder)
    : notes.filter(n => !n.folder_id)

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* 折叠/展开按钮 */}
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? '展开侧边栏' : '折叠侧边栏'}>
        {collapsed ? '☰' : '✕'}
      </button>
      {/* 顶部操作栏 */}
      <div className="sidebar-top-actions">
        <button className="new-note-btn" onClick={() => { if (deleteMode) setDeleteMode(false); createNote(activeFolder) }}>
          + 新建笔记
        </button>
        <button
          className={`delete-mode-btn ${deleteMode ? 'active' : ''}`}
          onClick={() => { setDeleteMode(!deleteMode); if (deleteMode) setCheckedNotes(new Set()) }}
          title={deleteMode ? '退出删除模式' : '删除笔记'}
        >
          🗑️
        </button>
      </div>

      {/* 嵌套限制提示 */}
      {nestedFolderLimit && (
        <div className="limit-warning">⚠️ 最多嵌套一层子文件夹</div>
      )}

      {/* 删除模式操作栏 */}
      {deleteMode && checkedNotes.size > 0 && (
        <div className="delete-bar">
          <span>已选 {checkedNotes.size} 篇</span>
          <button className="delete-execute-btn" onClick={() => setDeleteConfirm({ type: 'batch_notes', name: `${checkedNotes.size} 篇笔记` })}>
            删除选中
          </button>
        </div>
      )}

      {/* 笔记列表 */}
      <div className="sidebar-section">
        <div
          className={`sidebar-item all-notes ${!activeFolder && !activeTag ? 'active' : ''}`}
          onClick={() => { onSelectFolder(null); onSelectTag(null) }}
        >
          📄 所有笔记
        </div>
        <div className="note-list">
          {displayNotes.map(note => (
            <div
              key={note.id}
              className={`sidebar-item note-item ${activeNote?.id === note.id ? 'active' : ''} ${deleteMode ? 'delete-mode-item' : ''}`}
              onClick={() => deleteMode ? toggleCheckNote(note.id) : onSelectNote(note)}
            >
              {deleteMode && (
                <input
                  type="checkbox"
                  checked={checkedNotes.has(note.id)}
                  onChange={() => toggleCheckNote(note.id)}
                  className="note-checkbox"
                />
              )}
              <span className="note-title">{note.title || '未命名'}</span>
              <span className="note-date">
                {new Date(note.updated_at).toLocaleDateString('zh-CN')}
              </span>
              {!deleteMode && (
                <button
                  className="note-delete"
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                  title="删除笔记"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* 文件夹 */}
      <div className="sidebar-section">
        <div className="section-header">
          <span>📁 文件夹</span>
          <button className="add-btn" onClick={() => setShowNewFolder(!showNewFolder)}>+</button>
        </div>

        {showNewFolder && (
          <div className="new-item-form">
            <input
              autoFocus
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
            />
            <div className="form-actions">
              <button onClick={createFolder}>创建</button>
              <button onClick={() => setShowNewFolder(false)}>取消</button>
            </div>
          </div>
        )}

        <div className="folder-tree">
          {rootFolders.map(folder => renderFolder(folder))}
          {rootFolders.length === 0 && (
            <div className="empty-hint">暂无文件夹</div>
          )}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* 标签 */}
      <div className="sidebar-section">
        <div className="section-header">
          <span>🏷️ 标签</span>
          <button className="add-btn" onClick={() => setShowNewTag(!showNewTag)}>+</button>
        </div>

        {showNewTag && (
          <div className="new-item-form">
            <input
              autoFocus
              placeholder="标签名称"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTag()}
            />
            <div className="form-actions">
              <button onClick={createTag}>创建</button>
              <button onClick={() => setShowNewTag(false)}>取消</button>
            </div>
          </div>
        )}

        <div className="tag-list">
          {tags.map(tag => (
            <div
              key={tag.id}
              className={`tag-item ${activeTag === tag.id ? 'active' : ''}`}
              onClick={() => onSelectTag(tag.id)}
            >
              <span># {tag.name}
                <span className="note-count">{(tagNoteMap?.[tag.id]?.size) || 0}</span>
              </span>
              <button
                className="tag-delete"
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'tag', id: tag.id, name: tag.name }) }}
              >
                ×
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <div className="empty-hint">暂无标签</div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p>确定删除「{deleteConfirm.name}」？</p>
            <p className="modal-warning">此操作不可撤销</p>
            <div className="modal-actions">
              <button
                className="btn-danger"
                onClick={() => {
                  if (deleteConfirm.type === 'folder') deleteFolder(deleteConfirm.id)
                  else if (deleteConfirm.type === 'tag') deleteTag(deleteConfirm.id)
                  else if (deleteConfirm.type === 'batch_notes') deleteCheckedNotes()
                }}
              >
                删除
              </button>
              <button onClick={() => setDeleteConfirm(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
