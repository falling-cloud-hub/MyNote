import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import Sidebar from './Sidebar'
import Editor from './Editor'
import AIPanel from './AIPanel'
import Settings from './Settings'
import './Dashboard.css'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [notes, setNotes] = useState([])
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [noteTags, setNoteTags] = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeTag, setActiveTag] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('mynote_deepseek_key') || '')

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    const [notesRes, foldersRes, tagsRes, noteTagsRes] = await Promise.all([
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      supabase.from('folders').select('*').order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('note_tags').select('*'),
    ])
    if (notesRes.data) setNotes(notesRes.data)
    if (foldersRes.data) setFolders(foldersRes.data)
    if (tagsRes.data) setTags(tagsRes.data)
    if (noteTagsRes.data) setNoteTags(noteTagsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // 实时订阅笔记变更
  useEffect(() => {
    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  // 获取每个标签关联的笔记ID集合
  const tagNoteMap = {}
  noteTags.forEach(nt => {
    if (!tagNoteMap[nt.tag_id]) tagNoteMap[nt.tag_id] = new Set()
    tagNoteMap[nt.tag_id].add(nt.note_id)
  })

  // 筛选笔记
  const filteredNotes = notes.filter(note => {
    if (activeFolder) return note.folder_id === activeFolder
    if (activeTag) return tagNoteMap[activeTag]?.has(note.id) ?? false
    return true
  })

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            ☰
          </button>
          <h1 className="logo">
            <img src="/logo.svg" alt="MyNote" className="logo-icon" />
          </h1>
        </div>
        <div className="header-right">
          <button className="toolbar-btn" onClick={() => setSettingsOpen(true)} title="设置">
            ⚙️
          </button>
          {user && (
            <div className="user-info">
              <img src={user.user_metadata?.avatar_url} alt="" className="avatar" />
              <span className="username">{user.user_metadata?.user_name || user.email}</span>
            </div>
          )}
          <button className="logout-btn" onClick={signOut}>登出</button>
        </div>
      </header>
      <div className="dashboard-body">
        <Sidebar
          notes={filteredNotes}
          folders={folders}
          tags={tags}
          tagNoteMap={tagNoteMap}
          activeNote={activeNote}
          activeFolder={activeFolder}
          activeTag={activeTag}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSelectNote={(note) => { setActiveNote(note); setActiveFolder(null); setActiveTag(null) }}
          onSelectFolder={(id) => { setActiveFolder(id); setActiveNote(null); setActiveTag(null) }}
          onSelectTag={(id) => { setActiveTag(id); setActiveNote(null); setActiveFolder(null) }}
          onDataChange={loadData}
        />
        <Editor
          note={activeNote}
          folders={folders}
          tags={tags}
          onDataChange={loadData}
          onNoteChange={setActiveNote}
        />
      </div>

      {/* AI 面板 */}
      <AIPanel
        notes={notes}
        deepseekKey={deepseekKey}
        isOpen={aiOpen}
        onToggle={() => setAiOpen(!aiOpen)}
      />

      {/* 设置面板 */}
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        deepseekKey={deepseekKey}
        onDeepseekKeyChange={setDeepseekKey}
      />
    </div>
  )
}
