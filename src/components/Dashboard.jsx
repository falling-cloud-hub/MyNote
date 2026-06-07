import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import Sidebar from './Sidebar'
import Editor from './Editor'
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
  const [loading, setLoading] = useState(true)

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

  // 获取每个标签关联的笔记ID集合（用于计数和筛选）
  const tagNoteMap = {}
  noteTags.forEach(nt => {
    if (!tagNoteMap[nt.tag_id]) tagNoteMap[nt.tag_id] = new Set()
    tagNoteMap[nt.tag_id].add(nt.note_id)
  })

  // 筛选笔记
  const filteredNotes = notes.filter(note => {
    if (activeFolder) {
      return note.folder_id === activeFolder
    }
    if (activeTag) {
      return tagNoteMap[activeTag]?.has(note.id) ?? false
    }
    return true
  })

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="logo">📝 MyNote</h1>
        <div className="header-right">
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
    </div>
  )
}
