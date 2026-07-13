import json
import logging
from datetime import datetime
from pathlib import Path
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db, SessionLocal
from .models import Conversation, KnowledgeDocument, Message, User
from .rag import ask_knowledge_base, delete_document_vectors, get_document_chunks, index_document, rebuild_vector_store, save_uploaded_file
from .schemas import AdminUserListOut, AskRequest, AskResponse, ChangePasswordRequest, ChunkOut, ConversationCreate, ConversationDetail, ConversationOut, ConversationRename, DocumentOut, LoginRequest, MessageOut, RegisterRequest, TokenOut, UserOut
from .security import create_access_token, get_current_user, hash_password, require_admin, verify_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter_by(username="admin").first():
            db.add(User(username="admin", password_hash=hash_password("admin123456"), role="admin"))
            db.commit()
            logging.info("已创建初始管理员 admin")
    finally:
        db.close()


def _conversation_or_404(db: Session, conversation_id: int, user: User) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(404, detail="未找到此会话")
    return conversation


def _message_out(message: Message) -> MessageOut:
    return MessageOut(id=message.id, role=message.role, content=message.content, sources=json.loads(message.sources_json), has_general_supplement=message.has_general_supplement, created_at=message.created_at)


@app.get("/api/health")
def health():
    return {"status": "ok", "model_configured": bool(settings.dashscope_api_key)}


@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(409, detail="用户名已存在")
    user = User(username=payload.username, password_hash=hash_password(payload.password), role="user")
    db.add(user); db.commit(); db.refresh(user)
    return TokenOut(access_token=create_access_token(user), user=user)


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, detail="用户名或密码错误")
    return TokenOut(access_token=create_access_token(user), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.post("/api/auth/change-password")
def change_password(payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, detail="原密码不正确")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, detail="两次输入的新密码不一致")
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(400, detail="新密码不能与原密码相同")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "密码修改成功，请重新登录"}


@app.get("/api/admin/users", response_model=AdminUserListOut)
def admin_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return AdminUserListOut(total=len(users), users=users)


@app.get("/api/conversations", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Conversation).filter_by(user_id=user.id).order_by(Conversation.updated_at.desc()).all()


@app.post("/api/conversations", response_model=ConversationOut)
def create_conversation(payload: ConversationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = Conversation(title=payload.title, user_id=user.id)
    db.add(conversation); db.commit(); db.refresh(conversation)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _conversation_or_404(db, conversation_id, user)
    return ConversationDetail(id=conversation.id, title=conversation.title, created_at=conversation.created_at, updated_at=conversation.updated_at, messages=[_message_out(m) for m in conversation.messages])


@app.patch("/api/conversations/{conversation_id}", response_model=ConversationOut)
def rename_conversation(conversation_id: int, payload: ConversationRename, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _conversation_or_404(db, conversation_id, user)
    conversation.title = payload.title; db.commit(); db.refresh(conversation)
    return conversation


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_conversation_or_404(db, conversation_id, user)); db.commit()
    return {"message": "会话已删除"}


@app.post("/api/conversations/{conversation_id}/ask", response_model=AskResponse)
def ask(conversation_id: int, payload: AskRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _conversation_or_404(db, conversation_id, user)
    history = [(message.role, message.content) for message in conversation.messages]
    user_message = Message(conversation_id=conversation.id, role="user", content=payload.question)
    db.add(user_message); db.commit()
    answer, sources, supplement, response_ms = ask_knowledge_base(payload.question, history)
    assistant_message = Message(conversation_id=conversation.id, role="assistant", content=answer, sources_json=json.dumps(sources, ensure_ascii=False), has_general_supplement=supplement)
    db.add(assistant_message)
    conversation.updated_at = datetime.utcnow()
    if conversation.title == "新对话": conversation.title = payload.question[:30]
    db.commit()
    db.refresh(assistant_message)
    return AskResponse(message_id=assistant_message.id, answer=answer, sources=sources, has_general_supplement=supplement, response_ms=response_ms)


@app.post("/api/conversations/{conversation_id}/messages/{message_id}/regenerate", response_model=MessageOut)
def regenerate_answer(conversation_id: int, message_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _conversation_or_404(db, conversation_id, user)
    messages = list(conversation.messages)
    target_index = next((index for index, message in enumerate(messages) if message.id == message_id), None)
    if target_index is None:
        raise HTTPException(404, detail="未找到这条回答")
    target = messages[target_index]
    if target.role != "assistant":
        raise HTTPException(400, detail="只能重新生成 AI 回答")
    question_index = next((index for index in range(target_index - 1, -1, -1) if messages[index].role == "user"), None)
    if question_index is None:
        raise HTTPException(400, detail="未找到这条回答对应的问题")
    question = messages[question_index].content
    history = [(message.role, message.content) for message in messages[:question_index]]
    answer, sources, supplement, _ = ask_knowledge_base(question, history)
    target.content = answer
    target.sources_json = json.dumps(sources, ensure_ascii=False)
    target.has_general_supplement = supplement
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(target)
    return _message_out(target)


def _process_document(document_id: int, path: str, name: str) -> None:
    db = SessionLocal()
    document = db.get(KnowledgeDocument, document_id)
    try:
        count = index_document(Path(path), document_id, name)
        document.status, document.chunk_count, document.error_message = "ready", count, None
    except Exception as exc:
        logging.exception("资料处理失败")
        document.status, document.error_message = "failed", str(exc)
    finally:
        db.commit(); db.close()


@app.get("/api/documents", response_model=list[DocumentOut])
def list_documents(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(KnowledgeDocument).order_by(KnowledgeDocument.uploaded_at.desc()).all()


@app.get("/api/documents/{document_id}/chunks", response_model=list[ChunkOut])
def document_chunks(document_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not db.get(KnowledgeDocument, document_id):
        raise HTTPException(404, detail="资料不存在")
    try:
        return get_document_chunks(document_id)
    except Exception as exc:
        raise HTTPException(503, detail=f"暂时无法读取资料片段：{exc}")


@app.post("/api/documents", response_model=DocumentOut)
async def upload_document(background: BackgroundTasks, file: UploadFile = File(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    path, stored_name, size = await save_uploaded_file(file)
    document = KnowledgeDocument(original_name=file.filename or stored_name, stored_name=stored_name, file_size=size)
    db.add(document); db.commit(); db.refresh(document)
    background.add_task(_process_document, document.id, str(path), document.original_name)
    return document


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    document = db.get(KnowledgeDocument, document_id)
    if not document: raise HTTPException(404, detail="资料不存在")
    delete_document_vectors(document.id)
    (settings.upload_dir / document.stored_name).unlink(missing_ok=True)
    db.delete(document); db.commit()
    return {"message": "资料已删除"}


@app.post("/api/documents/{document_id}/reprocess")
def reprocess_document(document_id: int, background: BackgroundTasks, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    document = db.get(KnowledgeDocument, document_id)
    if not document: raise HTTPException(404, detail="资料不存在")
    document.status, document.error_message = "processing", None; db.commit()
    background.add_task(_process_document, document.id, str(settings.upload_dir / document.stored_name), document.original_name)
    return {"message": "正在重新处理资料"}


@app.post("/api/documents/rebuild")
def rebuild(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    docs = db.query(KnowledgeDocument).all()
    statuses = rebuild_vector_store([(doc.id, settings.upload_dir / doc.stored_name, doc.original_name) for doc in docs])
    for doc in docs:
        status, count, error = statuses[doc.id]
        doc.status, doc.chunk_count, doc.error_message = status, count, error
    db.commit()
    return {"message": "知识库索引已重建", "count": len(docs)}


if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/")
def web_app():
    if not (FRONTEND_DIST / "index.html").exists():
        raise HTTPException(503, detail="前端尚未构建。请运行 start.bat。")
    return FileResponse(FRONTEND_DIST / "index.html")


@app.get("/{path:path}")
def web_app_routes(path: str):
    if (FRONTEND_DIST / "index.html").exists():
        return FileResponse(FRONTEND_DIST / "index.html")
    raise HTTPException(404, detail="页面不存在")
