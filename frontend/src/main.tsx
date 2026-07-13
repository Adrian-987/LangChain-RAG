import { FormEvent, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowRight, BookOpen, Check, ChevronDown, Copy, Database, Eye, EyeOff,
  FileText, FileUp, Layers3, LockKeyhole, LogOut, Menu, MessageSquare,
  MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Send, ShieldCheck,
  Sparkles, Trash2, UserRound, UsersRound, X, Zap,
} from 'lucide-react'
import { api, ChatMessage, Conversation, DocumentChunk, DocumentItem, User, UserOverview } from './api'
import './styles.css'

type View = 'chat' | 'documents' | 'profile' | 'users'

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN')

function Auth({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      localStorage.setItem('token', result.access_token)
      onAuthenticated(result.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page">
    <section className="auth-visual">
      <div className="tech-orbit orbit-one"/><div className="tech-orbit orbit-two"/>
      <div className="brand-emblem"><BookOpen size={76}/></div>
      <h1>企业知识库</h1>
      <p>让企业资料沉淀为可靠、可追溯的智能答案</p>
      <div className="feature-grid">
        <div><ShieldCheck/><b>安全可靠</b><span>账号权限隔离</span></div>
        <div><Layers3/><b>知识沉淀</b><span>资料结构化管理</span></div>
        <div><Zap/><b>高效智能</b><span>快速检索与回答</span></div>
        <div><UsersRound/><b>协作共享</b><span>多人独立使用</span></div>
      </div>
      <div className="auth-wave"/>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-title"><h2>{mode === 'login' ? '登录系统' : '创建账号'}</h2><p>{mode === 'login' ? '欢迎使用企业知识库平台' : '注册后即可开始知识问答'}</p></div>
        <label>用户名<div className="input-shell"><UserRound/><input value={username} onChange={event => setUsername(event.target.value)} placeholder="请输入用户名" minLength={3} required/></div></label>
        <label>密码<div className="input-shell"><LockKeyhole/><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="请输入密码" minLength={6} required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="显示或隐藏密码">{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
        {error && <p className="form-error">{error}</p>}
        <button className="gradient-button auth-submit" disabled={busy}>{busy ? '处理中...' : mode === 'login' ? '登录' : '注册'}<ArrowRight/></button>
        <div className="auth-switch"><span>{mode === 'login' ? '没有账号？' : '已有账号？'}</span><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? '立即注册' : '返回登录'}</button></div>
      </form>
    </section>
  </main>
}

function Sources({ sources }: { sources: ChatMessage['sources'] }) {
  if (!sources?.length) return null
  return <details className="sources">
    <summary><Database size={17}/>知识库依据（{sources.length} 条）<ChevronDown size={16}/></summary>
    <div className="source-list">{sources.map((source, index) => <article key={`${source.document}-${index}`}>
      <div className="source-heading"><FileText size={16}/><b>{source.document}</b><span>匹配度 {Math.round((source.score ?? 0) * 100)}%</span></div>
      <small>{source.location}</small><p>{source.content}</p>
    </article>)}</div>
  </details>
}

type SidebarProps = {
  user: User; view: View; conversations: Conversation[]; active?: number; mobileOpen: boolean
  onClose: () => void; onView: (view: View) => void; onSelect: (id: number) => void
  onCreate: () => void; onRename: (item: Conversation) => void; onDelete: (id: number) => void; onLogout: () => void
}

function Sidebar(props: SidebarProps) {
  return <>
    {props.mobileOpen && <button className="sidebar-backdrop" onClick={props.onClose} aria-label="关闭菜单"/>}
    <aside className={`sidebar ${props.mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo"><span><BookOpen/></span><b>企业知识库</b><button className="mobile-close" onClick={props.onClose}><X/></button></div>
      <button className="new-chat" onClick={props.onCreate}><Plus/>新建对话</button>
      <div className="conversation-list">
        {props.conversations.map(item => <div className={`conversation-item ${props.view === 'chat' && item.id === props.active ? 'active' : ''}`} key={item.id}>
          <button className="conversation-main" onClick={() => props.onSelect(item.id)}><MessageSquare/><span>{item.title}</span></button>
          <details className="item-menu"><summary title="更多操作"><MoreHorizontal/></summary><div><button onClick={() => props.onRename(item)}><Pencil/>重命名</button><button className="danger-text" onClick={() => props.onDelete(item.id)}><Trash2/>删除</button></div></details>
        </div>)}
      </div>
      <nav className="sidebar-nav">
        {props.user.role === 'admin' && <button className={props.view === 'documents' ? 'active' : ''} onClick={() => props.onView('documents')}><ShieldCheck/>知识库管理</button>}
        {props.user.role === 'admin' && <button className={props.view === 'users' ? 'active' : ''} onClick={() => props.onView('users')}><UsersRound/>用户管理</button>}
        <button className={props.view === 'profile' ? 'active' : ''} onClick={() => props.onView('profile')}><UserRound/>个人中心</button>
        <button onClick={props.onLogout}><LogOut/>退出登录</button>
      </nav>
    </aside>
  </>
}

function Topbar({ user, view, title, onMenu, onView, onLogout }: { user: User; view: View; title: string; onMenu: () => void; onView: (view: View) => void; onLogout: () => void }) {
  const descriptions: Record<View, string> = {
    chat: '模型会汇编回答，知识库资料将作为补充信息并显示来源。',
    documents: '上传、检查并维护用于问答的企业资料。',
    profile: '查看个人资料并维护账号安全。',
    users: '查看系统当前用户与角色信息。',
  }
  return <header className="topbar">
    <button className="mobile-menu" onClick={onMenu}><Menu/></button>
    <div><h1>{title}</h1><p>{descriptions[view]}</p></div>
    <details className="user-menu"><summary><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><b>{user.username}</b><ChevronDown/></summary><div><button onClick={() => onView('profile')}><UserRound/>个人中心</button><button onClick={onLogout}><LogOut/>退出登录</button></div></details>
  </header>
}

function ChatView({ active, messages, setMessages, onCreate, onRefresh }: { active?: number; messages: ChatMessage[]; setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>; onCreate: () => void; onRefresh: () => Promise<void> }) {
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState<number>()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number>()
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!question.trim() || !active || busy) return
    const text = question.trim()
    setQuestion(''); setBusy(true); setError('')
    setMessages(value => [...value, { id: -Date.now(), role: 'user', content: text, sources: [], has_general_supplement: false, created_at: new Date().toISOString() }])
    try {
      const result = await api.ask(active, text)
      setMessages(value => [...value, { id: result.message_id, role: 'assistant', content: result.answer, sources: result.sources, has_general_supplement: result.has_general_supplement, created_at: new Date().toISOString() }])
      await onRefresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  async function copyAnswer(message: ChatMessage) {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); window.setTimeout(() => setCopied(undefined), 1600) }
    catch { setError('复制失败，请手动选择文字复制。') }
  }
  async function regenerate(message: ChatMessage) {
    if (!active || busy || regenerating) return
    setRegenerating(message.id); setError('')
    try { const updated = await api.regenerate(active, message.id); setMessages(value => value.map(item => item.id === message.id ? updated : item)) }
    catch (err) { setError((err as Error).message) } finally { setRegenerating(undefined) }
  }

  if (!active) return <div className="chat-empty"><div className="empty-illustration"><MessageSquare/><Sparkles/></div><h2>开始一段新对话</h2><p>可以询问通用问题，也可以结合企业知识库资料进行问答。</p><button className="gradient-button" onClick={onCreate}><Plus/>新建对话</button></div>
  return <div className="chat-layout">
    {error && <p className="notice error-notice">{error}</p>}
    <section className="messages">
      {messages.length === 0 ? <div className="chat-empty"><div className="empty-illustration"><MessageSquare/><Sparkles/></div><h2>开始提问</h2><p>知识库资料会作为模型回答的补充信息。</p></div> : messages.map(message => <article className={`message ${message.role}`} key={message.id}>
        {message.role === 'assistant' && <div className="assistant-avatar"><BookOpen/></div>}
        <div className="message-body">
          {message.role === 'assistant' ? <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : <p>{message.content}</p>}
          {message.role === 'assistant' && <><Sources sources={message.sources}/><div className="answer-actions"><button onClick={() => copyAnswer(message)} title="复制全文">{copied === message.id ? <Check/> : <Copy/>}{copied === message.id ? '已复制' : '复制全文'}</button><button onClick={() => regenerate(message)} disabled={Boolean(regenerating) || busy} title="重新生成答案"><RotateCcw className={regenerating === message.id ? 'spin' : ''}/>{regenerating === message.id ? '生成中' : '重新生成'}</button></div></>}
        </div>
      </article>)}
      {busy && <article className="message assistant"><div className="assistant-avatar"><BookOpen/></div><div className="message-body loading"><span/><span/><span/>正在检索资料并生成回答</div></article>}
      <div ref={bottom}/>
    </section>
    <form className="composer" onSubmit={send}><div className="composer-shell"><textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="输入问题，按 Enter 发送" disabled={busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }}/><button className="send-button" disabled={busy || !question.trim()} title="发送"><Send/></button></div><small>Enter 发送，Shift + Enter 换行</small></form>
  </div>
}

function DocumentsView() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DocumentItem | null>(null)
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const file = useRef<HTMLInputElement>(null)
  const load = () => api.documents().then(setDocs).catch(err => setError(err.message))
  useEffect(() => { load() }, [])

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    setBusy(true); setError('')
    try { await api.upload(selectedFile); await load() } catch (err) { setError((err as Error).message) } finally { setBusy(false); if (file.current) file.current.value = '' }
  }
  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await fn(); await load() } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function viewChunks(doc: DocumentItem) {
    setSelected(doc); setChunks([]); setError('')
    try { setChunks(await api.chunks(doc.id)) } catch (err) { setError((err as Error).message) }
  }

  return <div className="page-content">
    {error && <p className="notice error-notice">{error}</p>}
    <section className="upload-card"><div className="upload-icon"><FileUp/></div><div><h2>上传知识资料</h2><p>支持 PDF、Word（.docx）和 TXT，单个文件不超过 20 MB。</p></div><label className="gradient-button">选择文件<input ref={file} type="file" accept=".pdf,.docx,.txt" onChange={upload} disabled={busy}/></label></section>
    <section className="panel-card"><div className="panel-heading"><div><h2>资料列表</h2><p>共 {docs.length} 份资料</p></div><button className="secondary-button" disabled={busy} onClick={() => action(api.rebuild)}><RefreshCw/>重建全部索引</button></div>
      <div className="document-list">{docs.length === 0 ? <div className="empty-row">还没有上传资料。</div> : docs.map(doc => <article key={doc.id}><div className="document-icon"><FileText/></div><div className="document-info"><b>{doc.original_name}</b><p>{(doc.file_size / 1024).toFixed(1)} KB · {formatDate(doc.uploaded_at)}</p>{doc.error_message && <small className="danger-text">{doc.error_message}</small>}</div><span className={`status ${doc.status}`}>{doc.status === 'ready' ? `${doc.chunk_count} 个片段` : doc.status === 'processing' ? '处理中' : '处理失败'}</span><div className="document-actions"><button disabled={busy || doc.status !== 'ready'} onClick={() => viewChunks(doc)}>查看分段</button><button title="重新处理" disabled={busy} onClick={() => action(() => api.reprocess(doc.id))}><RefreshCw/></button><button className="danger-text" title="删除资料" disabled={busy} onClick={() => { if (confirm(`删除 ${doc.original_name} 吗？`)) action(() => api.deleteDocument(doc.id)) }}><Trash2/></button></div></article>)}</div>
    </section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="chunk-modal" onClick={event => event.stopPropagation()}><div className="panel-heading"><div><h2>{selected.original_name}</h2><p>索引分段共 {chunks.length} 条</p></div><button className="icon-button" onClick={() => setSelected(null)}><X/></button></div><div className="chunk-list">{chunks.length === 0 ? <div className="empty-row">正在读取分段，或资料尚未完成处理。</div> : chunks.map(chunk => <article key={chunk.index}><b>第 {chunk.index} 段 · {chunk.location}</b><p>{chunk.content}</p></article>)}</div></section></div>}
  </div>
}

function ProfileView({ user, onUsers, onLogout }: { user: User; onUsers: () => void; onLogout: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [total, setTotal] = useState<number>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user.role === 'admin') api.users().then(result => setTotal(result.total)).catch(() => undefined) }, [user.role])

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    if (newPassword !== confirmPassword) { setError('两次输入的新密码不一致'); setBusy(false); return }
    try { const result = await api.changePassword(currentPassword, newPassword, confirmPassword); setMessage(result.message); window.setTimeout(onLogout, 900) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return <div className="page-content profile-grid">
    <section className="profile-card"><div className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</div><h2>{user.username}</h2><span className="role-badge">{user.role === 'admin' ? '管理员' : '普通用户'}</span><dl><div><dt>用户名</dt><dd>{user.username}</dd></div><div><dt>账号角色</dt><dd>{user.role === 'admin' ? '管理员' : '普通用户'}</dd></div><div><dt>注册时间</dt><dd>{formatDate(user.created_at)}</dd></div></dl>{user.role === 'admin' && <button className="user-overview-card" onClick={onUsers}><UsersRound/><span><b>{total ?? '—'} 位用户</b><small>查看系统用户概览</small></span><ArrowRight/></button>}</section>
    <form className="panel-card password-card" onSubmit={changePassword}><div className="panel-heading"><div><h2>修改密码</h2><p>定期更新密码可以更好地保护账号。</p></div><LockKeyhole/></div><label>原密码<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} minLength={6} required placeholder="请输入当前密码"/></label><label>新密码<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={6} required placeholder="至少 6 个字符"/></label><label>确认新密码<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={6} required placeholder="再次输入新密码"/></label>{error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}<button className="gradient-button" disabled={busy}>{busy ? '正在修改...' : '确认修改密码'}</button></form>
  </div>
}

function UsersView() {
  const [overview, setOverview] = useState<UserOverview>()
  const [error, setError] = useState('')
  useEffect(() => { api.users().then(setOverview).catch(err => setError(err.message)) }, [])
  return <div className="page-content">
    {error && <p className="notice error-notice">{error}</p>}
    <section className="stats-card"><div><span><UsersRound/></span><p>当前用户总数</p><strong>{overview?.total ?? '—'}</strong></div><p>此页面仅用于查看账号信息，不会修改或删除任何用户。</p></section>
    <section className="panel-card"><div className="panel-heading"><div><h2>用户列表</h2><p>用户名、角色与注册时间</p></div></div><div className="user-table"><div className="table-head"><span>用户</span><span>角色</span><span>注册时间</span></div>{overview?.users.map(item => <article key={item.id}><span className="table-user"><i>{item.username.slice(0, 1).toUpperCase()}</i><b>{item.username}</b></span><span><em className={`role-badge ${item.role}`}>{item.role === 'admin' ? '管理员' : '普通用户'}</em></span><span>{formatDate(item.created_at)}</span></article>)}</div></section>
  </div>
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>('chat')
  const [items, setItems] = useState<Conversation[]>([])
  const [active, setActive] = useState<number>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const loadConversations = async () => {
    const data = await api.conversations()
    setItems(data)
    setActive(current => current ?? data[0]?.id)
  }
  useEffect(() => { loadConversations().catch(err => setError(err.message)) }, [])
  useEffect(() => { if (active) api.conversation(active).then(data => setMessages(data.messages)).catch(err => setError(err.message)); else setMessages([]) }, [active])

  async function createConversation() {
    try { const item = await api.createConversation(); setItems(value => [item, ...value]); setActive(item.id); setMessages([]); setView('chat'); setMobileOpen(false) }
    catch (err) { setError((err as Error).message) }
  }
  async function renameConversation(item: Conversation) {
    const title = prompt('请输入新的会话名称', item.title)?.trim()
    if (!title || title === item.title) return
    try { await api.renameConversation(item.id, title); await loadConversations() } catch (err) { setError((err as Error).message) }
  }
  async function deleteConversation(id: number) {
    if (!confirm('删除这段会话吗？此操作无法撤销。')) return
    try { await api.deleteConversation(id); if (id === active) setActive(undefined); await loadConversations() } catch (err) { setError((err as Error).message) }
  }
  function selectConversation(id: number) { setActive(id); setView('chat'); setMobileOpen(false) }
  function changeView(next: View) { setView(next); setMobileOpen(false) }

  const title = view === 'chat' ? items.find(item => item.id === active)?.title || '新对话' : view === 'documents' ? '知识库管理' : view === 'users' ? '用户管理' : '个人中心'
  return <div className="workspace">
    <Sidebar user={user} view={view} conversations={items} active={active} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onView={changeView} onSelect={selectConversation} onCreate={createConversation} onRename={renameConversation} onDelete={deleteConversation} onLogout={onLogout}/>
    <main className="main-panel"><Topbar user={user} view={view} title={title} onMenu={() => setMobileOpen(true)} onView={changeView} onLogout={onLogout}/>{error && <p className="notice error-notice workspace-error">{error}</p>}{view === 'chat' && <ChatView active={active} messages={messages} setMessages={setMessages} onCreate={createConversation} onRefresh={loadConversations}/>} {view === 'documents' && <DocumentsView/>}{view === 'profile' && <ProfileView user={user} onUsers={() => changeView('users')} onLogout={onLogout}/>} {view === 'users' && user.role === 'admin' && <UsersView/>}</main>
  </div>
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => { localStorage.removeItem('token') }, [])
  function logout() { localStorage.removeItem('token'); setUser(null) }
  return user ? <Workspace user={user} onLogout={logout}/> : <Auth onAuthenticated={setUser}/>
}

createRoot(document.getElementById('root')!).render(<App/>)
