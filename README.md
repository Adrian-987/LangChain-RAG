# 企业知识库 RAG

这是一个本机运行的多用户知识库问答系统，使用 LangChain、FastAPI、React、SQLite 和 Chroma，不需要 Docker。

## 启动

1. 在项目根目录双击 `start.bat`。
2. 首次运行会创建 `backend/.env`。打开它，将新生成的百炼 Key 填到 `DASHSCOPE_API_KEY=` 后面。
3. 浏览器会自动打开 `http://127.0.0.1:8000`。

保存了 `backend/.env` 中的模型配置后，双击 `restart.bat` 让后端读取新配置。

管理员初始账号为 `admin`，密码为 `admin123456`。登录后可进入“知识库管理”上传 PDF、Word（.docx）或 TXT 文件。

## 安全说明

- `.env`、上传文件、数据库和向量数据均不会被 Git 提交。
- 已在聊天中暴露过的 API Key 必须在百炼控制台删除并重新生成。
- 上线到公网前必须修改 `SECRET_KEY` 和管理员初始密码。
