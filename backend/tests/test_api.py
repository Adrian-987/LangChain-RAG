import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Conversation, Message, User
from app.security import create_access_token, hash_password, verify_password


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine)

        def test_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = test_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.engine.dispose()

    def add_user(self, username: str, role: str = "user", password: str = "old-password") -> User:
        db = self.session_factory()
        user = User(username=username, role=role, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        db.close()
        return user

    @staticmethod
    def auth(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user)}"}

    def test_change_password_requires_current_password_and_updates_login(self) -> None:
        user = self.add_user("password_user")

        wrong = self.client.post(
            "/api/auth/change-password",
            headers=self.auth(user),
            json={"current_password": "wrong-password", "new_password": "new-password", "confirm_password": "new-password"},
        )
        self.assertEqual(wrong.status_code, 400)

        changed = self.client.post(
            "/api/auth/change-password",
            headers=self.auth(user),
            json={"current_password": "old-password", "new_password": "new-password", "confirm_password": "new-password"},
        )
        self.assertEqual(changed.status_code, 200)

        db = self.session_factory()
        updated = db.get(User, user.id)
        self.assertIsNotNone(updated)
        self.assertTrue(verify_password("new-password", updated.password_hash))
        db.close()

        old_login = self.client.post("/api/auth/login", json={"username": user.username, "password": "old-password"})
        new_login = self.client.post("/api/auth/login", json={"username": user.username, "password": "new-password"})
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)

    def test_user_overview_is_admin_only(self) -> None:
        admin = self.add_user("overview_admin", role="admin")
        regular = self.add_user("overview_user")

        forbidden = self.client.get("/api/admin/users", headers=self.auth(regular))
        allowed = self.client.get("/api/admin/users", headers=self.auth(admin))

        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.json()["total"], 2)
        self.assertEqual({item["username"] for item in allowed.json()["users"]}, {"overview_admin", "overview_user"})

    def test_regenerate_replaces_owned_assistant_message_only(self) -> None:
        owner = self.add_user("conversation_owner")
        other = self.add_user("conversation_other")
        db = self.session_factory()
        conversation = Conversation(title="测试会话", user_id=owner.id)
        db.add(conversation)
        db.commit()
        question = Message(conversation_id=conversation.id, role="user", content="如何清洗羊毛衫？")
        answer = Message(conversation_id=conversation.id, role="assistant", content="旧回答")
        db.add_all([question, answer])
        db.commit()
        conversation_id, question_id, answer_id = conversation.id, question.id, answer.id
        db.close()

        with patch("app.main.ask_knowledge_base", return_value=("**新回答：**\n\n- 手洗", [{"document": "资料.txt", "location": "全文", "content": "手洗", "score": 0.9}], False, 20)):
            updated = self.client.post(
                f"/api/conversations/{conversation_id}/messages/{answer_id}/regenerate",
                headers=self.auth(owner),
            )

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["id"], answer_id)
        self.assertEqual(updated.json()["content"], "**新回答：**\n\n- 手洗")

        forbidden = self.client.post(
            f"/api/conversations/{conversation_id}/messages/{answer_id}/regenerate",
            headers=self.auth(other),
        )
        invalid_role = self.client.post(
            f"/api/conversations/{conversation_id}/messages/{question_id}/regenerate",
            headers=self.auth(owner),
        )
        self.assertEqual(forbidden.status_code, 404)
        self.assertEqual(invalid_role.status_code, 400)


if __name__ == "__main__":
    unittest.main()
