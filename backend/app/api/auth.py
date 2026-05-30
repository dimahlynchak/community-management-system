from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_client_ip
from app.core.security import decode_token
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest, TokenResponse, UserCreate, UserResponse, UserUpdate,
)
from app.services.auth import (
    register_user, authenticate_user, create_tokens,
    cleanup_expired_refresh_tokens,
    store_refresh_token, get_valid_refresh_token, revoke_refresh_token,
    change_user_password, update_user_profile,
)
import random
from app.services.audit import create_audit_entry


router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=REFRESH_MAX_AGE,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Реєстрація нового користувача."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = register_user(db, data)
    # community_id=None бо при реєстрації юзер ще не у жодній спільноті;
    # action='CREATE', resource='user' для forensics — корисно знати, коли і з
    # якого IP створено акаунт.
    create_audit_entry(
        db, user.id, None, "CREATE", "user", user.id,
        details={"email": user.email, "full_name": user.full_name},
        ip_address=get_client_ip(request),
    )
    return user


@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Автентифікація. Повертає access token у body, refresh — у httpOnly cookie."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        create_audit_entry(
            db, None, None, "LOGIN_FAILED", "user", None,
            details={"email": form_data.username},
            ip_address=get_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    tokens = create_tokens(user.id)
    store_refresh_token(db, user.id, tokens["refresh_token"])
    _set_refresh_cookie(response, tokens["refresh_token"])

    create_audit_entry(
        db, user.id, None, "LOGIN", "user", user.id,
        ip_address=get_client_ip(request),
    )

    # Опортуністичне прибирання прострочених/відкликаних refresh-токенів:
    # запускаємо приблизно раз на 20 логінів. Так таблиця refresh_tokens не
    # накопичує мертві рядки без окремого cron-скрипту.
    if random.randint(0, 19) == 0:
        try:
            cleanup_expired_refresh_tokens(db)
        except Exception:
            db.rollback()  # очищення опційне, поразка не має ламати логін

    return TokenResponse(access_token=tokens["access_token"])


@router.post("/refresh", response_model=TokenResponse)
def refresh(response: Response, request: Request, db: Session = Depends(get_db)):
    """Оновлення access token + ротація refresh token (старий відкликається)."""
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    stored = get_valid_refresh_token(db, refresh_token)
    if stored is None or stored.user_id != user_id:
        raise HTTPException(status_code=401, detail="Refresh token revoked or unknown")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    # Ротація: відкликаємо пред'явлений токен і видаємо новий
    revoke_refresh_token(db, refresh_token)
    tokens = create_tokens(user.id)
    store_refresh_token(db, user.id, tokens["refresh_token"])
    _set_refresh_cookie(response, tokens["refresh_token"])
    create_audit_entry(
        db, user.id, None, "UPDATE", "auth", user.id,
        details={"event": "refresh"},
        ip_address=get_client_ip(request),
    )
    return TokenResponse(access_token=tokens["access_token"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Вихід: відкликає refresh token у БД і видаляє cookie."""
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        revoke_refresh_token(db, refresh_token)
    response.delete_cookie(REFRESH_COOKIE)
    create_audit_entry(
        db, current_user.id, None, "LOGOUT", "user", current_user.id,
        ip_address=get_client_ip(request),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Повертає дані поточного автентифікованого користувача."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оновити власні дані користувача (full_name, phone). Email не змінюється."""
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return current_user
    updated = update_user_profile(
        db, current_user, full_name=changes.get("full_name"), phone=changes.get("phone"),
    )
    create_audit_entry(
        db, current_user.id, None, "UPDATE", "user", current_user.id,
        details=changes,
        ip_address=get_client_ip(request),
    )
    return updated


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChangeRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Зміна власного паролю: перевірка старого, оновлення хешу, ревок усіх refresh-токенів.
    Поточну сесію після виклику буде завершено — клієнт має повторно увійти."""
    try:
        change_user_password(db, current_user, data.old_password, data.new_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    response.delete_cookie(REFRESH_COOKIE)
    create_audit_entry(
        db, current_user.id, None, "PASSWORD_CHANGED", "user", current_user.id,
        ip_address=get_client_ip(request),
    )
