import unittest

from jose import jwt
from pydantic import ValidationError

from app.config import settings
from app.models import User
from app.schemas import RegisterRequest
from app.security import create_access_token, hash_password, verify_password


class SecurityTests(unittest.TestCase):
    def test_password_hash_round_trip(self) -> None:
        password_hash = hash_password("a-safe-test-password")

        self.assertTrue(verify_password("a-safe-test-password", password_hash))
        self.assertFalse(verify_password("incorrect-password", password_hash))

    def test_access_token_contains_user_identity_and_role(self) -> None:
        user = User(id=42, username="test-user", password_hash="unused", role="admin")

        token = create_access_token(user)
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])

        self.assertEqual(payload["sub"], "42")
        self.assertEqual(payload["role"], "admin")

    def test_registration_rejects_short_password(self) -> None:
        with self.assertRaises(ValidationError):
            RegisterRequest(username="new-user", password="short")


if __name__ == "__main__":
    unittest.main()
