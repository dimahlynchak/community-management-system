import hashlib
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, data: UserCreate) -> User:
    """Створює нового користувача в БД."""
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Перевіряє email + пароль, повертає User або None."""
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


def create_tokens(user_id: int) -> dict:
    """Генерує пару access + refresh токенів."""
    payload = {"sub": str(user_id)}
    return {
        "access_token": create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
    }


def _hash_token(token: str) -> str:
    """SHA-256 хеш токена — у БД зберігаємо лише його, не сам JWT."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def store_refresh_token(db: Session, user_id: int, token: str) -> RefreshToken:
    """Зберігає хеш виданого refresh-токена для подальшої валідації/відкликання."""
    rt = RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(token),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    db.commit()
    return rt


def get_valid_refresh_token(db: Session, token: str) -> RefreshToken | None:
    """Повертає запис, якщо токен існує, не відкликаний і не протермінований."""
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(token)
    ).first()
    if rt is None or rt.revoked or rt.expires_at < datetime.utcnow():
        return None
    return rt


def revoke_refresh_token(db: Session, token: str) -> bool:
    """Відкликає конкретний refresh-токен (logout / ротація)."""
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(token)
    ).first()
    if rt is None or rt.revoked:
        return False
    rt.revoked = True
    db.commit()
    return True