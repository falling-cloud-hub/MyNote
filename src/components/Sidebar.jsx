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
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [checkedNotes, setCheckedNotes] = useState(new Set())
  const [nestedFolderLimit, setNestedFolderLimit] = useState(false)

  // === 笔记操作 ===
  const createNote = async (folderId = null) => {
    const { data, error } = await supabase
      .from('notes').insert({ title: '未命名笔记', content: '', folder_id: folderId, user_id: user.id })
      .select().single()
    if (!error && data) { onDataChange(); onSelectNote(data) }
  }

  const deleteCheckedNotes = async () => {
    if (checkedNotes.size === 0) return
    for (const id of checkedNotes) await supabase.from('notes').delete().eq('id', id)
    if (activeNote && checkedNotes.has(activeNote.id)) onSelectNote(null)
    setCheckedNotes(new Set()); setDeleteMode(false); setDeleteConfirm(null)
    onDataChange()
  }

  const toggleCheckNote = (noteId) => {
    setCheckedNotes(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId)
      return next
    })
  }

  // === 文件夹操作 ===
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    if (folderParentId) {
      const parentFolder = folders.find(f => f.id === folderParentId)
      if (parentFolder?.parent_id) {
        setNestedFolderLimit(true); setTimeout(() => setNestedFolderLimit(false), 3000); return
      }
    }
    const { error } = await supabase.from('folders').insert({
      name: newFolderName.trim(), parent_id: folderParentId, user_id: user.id,
    })
    if (!error) { setNewFolderName(''); setShowNewFolder(false); setFolderParentId(null); onDataChange() }
  }

  const deleteFolder = async (folderId) => {
    await supabase.from('folders').delete().eq('id', folderId)
    if (activeFolder === folderId) onSelectFolder(null)
    setDeleteConfirm(null); onDataChange()
  }

  const toggleFolderExpand = (id) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // === 标签操作 ===
  const createTag = async () => {
    if (!newTagName.trim()) return
    const { error } = await supabase.from('tags').insert({ name: newTagName.trim(), user_id: user.id })
    if (!error) { setNewTagName(''); setShowNewTag(false); onDataChange() }
  }

  const deleteTag = async (tagId) => {
    await supabase.from('tags').delete().eq('id', tagId)
    if (activeTag === tagId) onSelectTag(null)
    setDeleteConfirm(null); onDataChange()
  }

  // === 构建文件夹树 + 笔记映射 ===
  const rootFolders = folders.filter(f => !f.parent_id)
  const childFolders = (pid) => folders.filter(f => f.parent_id === pid)
  const folderNotesMap = {}
  notes.forEach(n => {
    if (n.folder_id) {
      if (!folderNotesMap[n.folder_id]) folderNotesMap[n.folder_id] = []
      folderNotesMap[n.folder_id].push(n)
    }
  })
  const unassignedNotes = notes.filter(n => !n.folder_id)

  // 渲染笔记行
  const renderNoteRow = (note, indent = 0) => (
    <div
      key={note.id}
      className={`sidebar-item note-item ${activeNote?.id === note.id ? 'active' : ''} ${deleteMode ? 'delete-mode-item' : ''}`}
      style={{ paddingLeft: `${16 + indent * 14}px` }}
      onClick={() => deleteMode ? toggleCheckNote(note.id) : onSelectNote(note)}
    >
      {deleteMode && (
        <input type="checkbox" checked={checkedNotes.has(note.id)} onChange={() => toggleCheckNote(note.id)} className="note-checkbox" />
      )}
      <span className="note-icon">📄</span>
      <span className="note-title">{note.title || '未命名'}</span>
      <span className="note-date">{new Date(note.updated_at).toLocaleDateString('zh-CN')}</span>
    </div>
  )

  // 渲染文件夹（递归）
  const renderFolder = (folder, depth = 0) => {
    const children = childFolders(folder.id)
    const isExpanded = expandedFolders.has(folder.id)
    const folderNotes = folderNotesMap[folder.id] || []
    const hasContent = children.length > 0 || folderNotes.length > 0

    return (
      <div key={folder.id}>
        <div
          className={`folder-item ${activeFolder === folder.id ? 'active' : ''}`}
          style={{ paddingLeft: `${14 + depth * 14}px` }}
        >
          <span className="folder-arrow" onClick={() => toggleFolderExpand(folder.id)}>
            {hasContent ? (isExpanded ? '▼' : '▶') : '  '}
          </span>
          <span className="folder-icon" onClick={() => toggleFolderExpand(folder.id)}>📁</span>
          <span className="folder-name" onClick={() => toggleFolderExpand(folder.id)}>
            {folder.name}
            <span className="note-count">{folderNotes.length}</span>
          </span>
          <button className="folder-add-note" onClick={(e) => { e.stopPropagation(); createNote(folder.id) }} title="在此文件夹中新建笔记">+📄</button>
          <button className="folder-delete" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'folder', id: folder.id, name: folder.name }) }}>🗑️</button>
        </div>
        {/* 展开时显示子文件夹 + 笔记 */}
        {isExpanded && (
          <div className="folder-children">
            {folderNotes.map(n => renderNoteRow(n, depth + 1))}
            {children.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? '展开' : '折叠'}>
        {collapsed ? '☰' : '✕'}
      </button>

      {/* 顶部操作栏 */}
      <div className="sidebar-top-actions">
        <button className="new-note-btn" onClick={() => { if (deleteMode) setDeleteMode(false); createNote(null) }}>+ 新建笔记</button>
        <button className={`delete-mode-btn ${deleteMode ? 'active' : ''}`}
          onClick={() => { setDeleteMode(!deleteMode); if (deleteMode) setCheckedNotes(new Set()) }}>
          🗑️
        </button>
      </div>

      {nestedFolderLimit && <div className="limit-warning">⚠️ 最多嵌套一层子文件夹</div>}

      {deleteMode && checkedNotes.size > 0 && (
        <div className="delete-bar">
          <span>已选 {checkedNotes.size} 篇</span>
          <button className="delete-execute-btn" onClick={() => setDeleteConfirm({ type: 'batch_notes', name: `${checkedNotes.size} 篇笔记` })}>删除选中</button>
        </div>
      )}

      {/* 所有笔记（未分类） */}
      <div className="sidebar-section">
        <div className={`sidebar-item section-title ${!activeFolder && !activeTag ? 'active' : ''}`}
          onClick={() => { onSelectFolder(null); onSelectTag(null) }}>
          📄 所有笔记
        </div>
        <div className="note-list">
          {unassignedNotes.map(n => renderNoteRow(n, 0))}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* 文件夹 */}
      <div className="sidebar-section">
        <div className="section-header">
          <span>📁 文件夹</span>
          <button className="add-btn" onClick={() => { setFolderParentId(null); setShowNewFolder(!showNewFolder) }}>+</button>
        </div>
        {showNewFolder && (
          <div className="new-item-form">
            <input autoFocus placeholder="文件夹名称" value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()} />
            <div className="form-actions">
              <button onClick={createFolder}>创建</button>
              <button onClick={() => setShowNewFolder(false)}>取消</button>
            </div>
          </div>
        )}
        <div className="folder-tree">
          {rootFolders.map(folder => renderFolder(folder))}
          {rootFolders.length === 0 && <div className="empty-hint">暂无文件夹</div>}
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
            <input autoFocus placeholder="标签名称" value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTag()} />
            <div className="form-actions">
              <button onClick={createTag}>创建</button>
              <button onClick={() => setShowNewTag(false)}>取消</button>
            </div>
          </div>
        )}
        <div className="tag-list">
          {tags.map(tag => (
            <div key={tag.id} className={`tag-item ${activeTag === tag.id ? 'active' : ''}`}
              onClick={() => onSelectTag(tag.id)}>
              <span># {tag.name}<span className="note-count">{(tagNoteMap?.[tag.id]?.size) || 0}</span></span>
              <button className="tag-delete" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'tag', id: tag.id, name: tag.name }) }}>×</button>
            </div>
          ))}
          {tags.length === 0 && <div className="empty-hint">暂无标签</div>}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p>确定删除「{deleteConfirm.name}」？</p>
            <p className="modal-warning">此操作不可撤销</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => {
                if (deleteConfirm.type === 'folder') deleteFolder(deleteConfirm.id)
                else if (deleteConfirm.type === 'tag') deleteTag(deleteConfirm.id)
                else if (deleteConfirm.type === 'batch_notes') deleteCheckedNotes()
              }}>删除</button>
              <button onClick={() => setDeleteConfirm(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
