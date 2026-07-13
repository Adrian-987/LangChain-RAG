from datetime import datetime
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=6, max_length=100)


class LoginRequest(RegisterRequest):
    pass


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)
    confirm_password: str = Field(min_length=6, max_length=100)


class AdminUserListOut(BaseModel):
    total: int
    users: list[UserOut]


class ConversationCreate(BaseModel):
    title: str = Field(default="新对话", min_length=1, max_length=100)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SourceOut(BaseModel):
    document: str
    location: str
    content: str
    score: float | None = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: list[SourceOut] = []
    has_general_supplement: bool = False
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class AskResponse(BaseModel):
    message_id: int
    answer: str
    sources: list[SourceOut]
    has_general_supplement: bool
    response_ms: int


class DocumentOut(BaseModel):
    id: int
    original_name: str
    status: str
    error_message: str | None
    chunk_count: int
    file_size: int
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class ChunkOut(BaseModel):
    index: int
    location: str
    content: str
