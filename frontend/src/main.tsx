import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, FileUp, LogOut, MessageSquare, Plus, RefreshCw, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { api, ChatMessage, Conversation, DocumentChunk, DocumentItem, User } from './api'
import './styles.css'

function Auth({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      localStorage.setItem('token', result.access_token); onAuthenticated(result.user)
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return <main className="auth"><section className="auth-brand"><BookOpen size={34}/><h1>企业知识库</h1><p>模型保持正常能力，知识库作为可靠的补充信息来源。</p></section><form className="auth-form" onSubmit={submit}><h2>{mode === 'login' ? '登录系统' : '创建账号'}</h2><label>用户名<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} required/></label><label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required/></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? '处理中...' : mode === 'login' ? '登录' : '注册'}</button><button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '没有账号？注册' : '已有账号？登录'}</button><p className="hint">管理员初始账号：admin / admin123456</p></form></main>
}

function Sources({ sources }: { sources: ChatMessage['sources'] }) {
  if (!sources?.length) return null
  return <details className="sources"><summary>知识库依据（{sources.length} 条）</summary>{sources.map((source, index) => <article key={index}><b>{source.document}</b><span>{source.location} · 匹配度 {Math.round((source.score || 0) * 100)}%</span><p>{source.content}</p></article>)}</details>
}

function Chat({ user, onAdmin }: { user: User; onAdmin: () => void }) {
  const [items, setItems] = useState<Conversation[]>([]), [active, setActive] = useState<number>(), [messages, setMessages] = useState<ChatMessage[]>([]), [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const load = async () => { const data = await api.conversations(); setItems(data); if (!active && data[0]) setActive(data[0].id) }
  useEffect(() => { load().catch(err => setError(err.message)) }, [])
  useEffect(() => { if (active) api.conversation(active).then(data => setMessages(data.messages)).catch(err => setError(err.message)) }, [active])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  async function create() { try { const item = await api.createConversation(); setItems(value => [item, ...value]); setActive(item.id); setMessages([]) } catch (err) { setError((err as Error).message) } }
  async function send(event: React.FormEvent) { event.preventDefault(); if (!question.trim() || !active || busy) return; const text = question.trim(); setQuestion(''); setBusy(true); setError(''); setMessages(value => [...value, { id: Date.now(), role: 'user', content: text, sources: [], has_general_supplement: false, created_at: new Date().toISOString() }]); try { const result = await api.ask(active, text); setMessages(value => [...value, { id: Date.now() + 1, role: 'assistant', content: result.answer, sources: result.sources, has_general_supplement: result.has_general_supplement, created_at: new Date().toISOString() }]); load() } catch (err) { setError((err as Error).message) } finally { setBusy(false) } }
  async function remove(id: number, event: React.MouseEvent) { event.stopPropagation(); if (!confirm('删除这段会话吗？')) return; await api.deleteConversation(id); if (id === active) { setActive(undefined); setMessages([]) }; load() }
  return <div className="app"><aside><div className="logo"><BookOpen/> 企业知识库</div><button className="new-chat" onClick={create}><Plus/> 新建对话</button><nav>{items.map(item => <button className={item.id === active ? 'active' : ''} key={item.id} onClick={() => setActive(item.id)}><MessageSquare/><span>{item.title}</span><Trash2 className="delete" size={15} onClick={event => remove(item.id, event)}/></button>)}</nav><div className="aside-bottom">{user.role === 'admin' && <button onClick={onAdmin}><ShieldCheck/> 知识库管理</button>}<button onClick={() => { localStorage.removeItem('token'); location.reload() }}><LogOut/> 退出登录</button></div></aside><main className="chat"><header><div><h2>{items.find(item => item.id === active)?.title || '新对话'}</h2><p>模型会正常回答；已上传资料会作为补充信息并显示来源。</p></div><span className="user">{user.username}</span></header>{error && <p className="banner error">{error}</p>}<section className="messages">{!active ? <div className="empty"><BookOpen size={36}/><h3>开始一个新对话</h3><p>你可以问常识问题，也可以根据已上传资料提问。</p></div> : messages.length === 0 ? <div className="empty"><MessageSquare size={36}/><h3>开始提问</h3><p>知识库资料会作为模型回答的补充信息。</p></div> : messages.map(message => <div key={message.id} className={`message ${message.role}`}><div className="bubble">{message.content}{message.role === 'assistant' && <Sources sources={message.sources}/>}</div></div>)}{busy && <div className="message assistant"><div className="bubble loading">正在检索资料并生成回答...</div></div>}<div ref={bottom}/></section><form className="composer" onSubmit={send}><textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder={active ? '输入问题，按 Enter 发送' : '请先新建对话'} disabled={!active || busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }}/><button className="primary icon" disabled={!active || busy} title="发送"><Send size={19}/></button></form></main></div>
}

function Admin({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<DocumentItem[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<DocumentItem | null>(null), [chunks, setChunks] = useState<DocumentChunk[]>([])
  const file = useRef<HTMLInputElement>(null)
  const load = () => api.documents().then(setDocs).catch(err => setError(err.message))
  useEffect(() => { load() }, [])
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const selectedFile = event.target.files?.[0]; if (!selectedFile) return; setBusy(true); try { await api.upload(selectedFile); await load() } catch (err) { setError((err as Error).message) } finally { setBusy(false); if (file.current) file.current.value = '' } }
  async function action(fn: () => Promise<unknown>) { setBusy(true); try { await fn(); await load() } catch (err) { setError((err as Error).message) } finally { setBusy(false) } }
  async function viewChunks(doc: DocumentItem) { setSelected(doc); setChunks([]); try { setChunks(await api.chunks(doc.id)) } catch (err) { setError((err as Error).message) } }
  return <main className="admin"><header><div><h1>知识库管理</h1><p>查看上传资料、处理状态以及系统实际检索的分段内容。</p></div><button onClick={onBack}>返回问答</button></header>{error && <p className="banner error">{error}</p>}<section className="upload"><FileUp size={28}/><div><b>上传知识资料</b><p>支持 PDF、Word（.docx）、TXT，单个文件不超过 20 MB。</p></div><input ref={file} type="file" accept=".pdf,.docx,.txt" onChange={upload} disabled={busy}/></section><div className="toolbar"><h2>资料列表</h2><button disabled={busy} onClick={() => action(api.rebuild)}><RefreshCw size={16}/> 重建全部索引</button></div><section className="documents">{docs.length === 0 ? <p className="empty-row">还没有上传资料。</p> : docs.map(doc => <article key={doc.id}><div><b>{doc.original_name}</b><p>{(doc.file_size / 1024).toFixed(1)} KB · {new Date(doc.uploaded_at).toLocaleString()}</p>{doc.error_message && <p className="error">{doc.error_message}</p>}</div><span className={`status ${doc.status}`}>{doc.status === 'ready' ? `${doc.chunk_count} 个片段` : doc.status === 'processing' ? '处理中' : '处理失败'}</span><button disabled={busy || doc.status !== 'ready'} onClick={() => viewChunks(doc)}>查看分段</button><button disabled={busy} title="重新处理" onClick={() => action(() => api.reprocess(doc.id))}><RefreshCw size={16}/></button><button disabled={busy} className="danger" title="删除资料" onClick={() => { if (confirm(`删除 ${doc.original_name} 吗？`)) action(() => api.deleteDocument(doc.id)) }}><Trash2 size={16}/></button></article>)}</section>{selected && <section className="chunk-panel"><div className="toolbar"><h2>{selected.original_name} 的分段（{chunks.length}）</h2><button onClick={() => setSelected(null)}>关闭</button></div>{chunks.length === 0 ? <p className="empty-row">正在读取分段，或该资料尚未完成处理。</p> : chunks.map(chunk => <article key={chunk.index}><b>第 {chunk.index} 段 · {chunk.location}</b><p>{chunk.content}</p></article>)}</section>}</main>
}

function App() {
  const [user, setUser] = useState<User | null>(null), [admin, setAdmin] = useState(false)
  useEffect(() => { localStorage.removeItem('token') }, [])
  if (!user) return <Auth onAuthenticated={setUser}/>
  return admin ? <Admin onBack={() => setAdmin(false)}/> : <Chat user={user} onAdmin={() => setAdmin(true)}/>
}

createRoot(document.getElementById('root')!).render(<App/>)
