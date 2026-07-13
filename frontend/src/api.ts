// The FastAPI server also serves the built web app, so API calls stay on one origin.
const API = '/api'
export type User = { id:number; username:string; role:'admin'|'user' }
export type Conversation = { id:number; title:string; created_at:string; updated_at:string }
export type Source = { document:string; location:string; content:string; score?:number }
export type ChatMessage = { id:number; role:'user'|'assistant'; content:string; sources:Source[]; has_general_supplement:boolean; created_at:string }
export type DocumentItem = { id:number; original_name:string; status:string; error_message:string|null; chunk_count:number; file_size:number; uploaded_at:string }
export type DocumentChunk = { index:number; location:string; content:string }

function headers(json = true) { const token=localStorage.getItem('token'); return { ...(json?{'Content-Type':'application/json'}:{}), ...(token?{Authorization:`Bearer ${token}`}:{}) } }
async function request<T>(path:string, options:RequestInit = {}):Promise<T> { const r=await fetch(`${API}${path}`, {...options, headers:{...headers(!(options.body instanceof FormData)), ...(options.headers||{})}}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.detail || '请求失败'); return data }
export const api = {
  login:(username:string,password:string)=>request<{access_token:string;user:User}>('/auth/login',{method:'POST',body:JSON.stringify({username,password})}),
  register:(username:string,password:string)=>request<{access_token:string;user:User}>('/auth/register',{method:'POST',body:JSON.stringify({username,password})}),
  me:()=>request<User>('/auth/me'),
  conversations:()=>request<Conversation[]>('/conversations'),
  createConversation:(title='新对话')=>request<Conversation>('/conversations',{method:'POST',body:JSON.stringify({title})}),
  conversation:(id:number)=>request<Conversation & {messages:ChatMessage[]}>(`/conversations/${id}`),
  renameConversation:(id:number,title:string)=>request<Conversation>(`/conversations/${id}`,{method:'PATCH',body:JSON.stringify({title})}),
  deleteConversation:(id:number)=>request(`/conversations/${id}`,{method:'DELETE'}),
  ask:(id:number,question:string)=>request<{answer:string;sources:Source[];has_general_supplement:boolean;response_ms:number}>(`/conversations/${id}/ask`,{method:'POST',body:JSON.stringify({question})}),
  documents:()=>request<DocumentItem[]>('/documents'),
  chunks:(id:number)=>request<DocumentChunk[]>(`/documents/${id}/chunks`),
  upload:(file:File)=>{const f=new FormData();f.append('file',file);return request<DocumentItem>('/documents',{method:'POST',body:f})},
  deleteDocument:(id:number)=>request(`/documents/${id}`,{method:'DELETE'}),
  reprocess:(id:number)=>request(`/documents/${id}/reprocess`,{method:'POST'}),
  rebuild:()=>request<{message:string;count:number}>('/documents/rebuild',{method:'POST'}),
}
