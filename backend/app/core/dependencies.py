from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_client_ip(request: Request) -> str | None:
    """Безпечно отримує IP клієнта. request.client = None за деяких проксі/ASGI-серверів."""
    return request.client.host if request.client else None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: отримує поточного користувача з JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_user_permissions(db: Session, user_id: int, community_id: int) -> set[str]:
    """Усі дозволи користувача в конкретній спільноті (з ієрархією ролей)."""
    from app.models.role import Role
    from app.models.user_community_role import UserCommunityRole

    ucr = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == user_id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if ucr is None:
        return set()

    permissions: set[str] = set()
    role = db.query(Role).filter(Role.id == ucr.role_id).first()
    while role is not None:
        for perm in role.permissions:
            permissions.add(perm.codename)
        role = (
            db.query(Role).filter(Role.id == role.parent_role_id).first()
            if role.parent_role_id else None
        )
    return permissions


def check_permission(
    db: Session,
    user_id: int,
    community_id: int,
    codename: str,
    ip_address: str | None = None,
) -> None:
    """Кидає 403, якщо користувач не має дозволу в цій спільноті. Логує відмову."""
    if codename not in get_user_permissions(db, user_id, community_id):
        from app.services.audit import create_audit_entry

        create_audit_entry(
            db, user_id, community_id, "ACCESS_DENIED", "permission", None,
            details={"codename": codename}, ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{codename}' required",
        )


def _ensure_community_active(db: Session, community_id: int) -> None:
    """Кидає 404, якщо спільнота не існує або деактивована (soft-deleted).
    Захищає всі вкладені ендпоїнти (units, members, finances, announcements)."""
    from app.models.community import Community

    exists = db.query(Community.id).filter(
        Community.id == community_id,
        Community.is_active == True,
    ).first()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found",
        )


def require_permission(permission_codename: str):
    """Dependency factory: перевіряє дозвіл у спільноті з шляху (community-scoped)."""

    def _check(
        community_id: int,
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        _ensure_community_active(db, community_id)
        check_permission(
            db, current_user.id, community_id, permission_codename,
            ip_address=get_client_ip(request),
        )
        return current_user

    return _check


def require_membership(
    community_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: користувач має будь-яку роль у цій спільноті."""
    from app.models.user_community_role import UserCommunityRole

    _ensure_community_active(db, community_id)
    ucr = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == current_user.id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if ucr is None:
        from app.services.audit import create_audit_entry

        create_audit_entry(
            db, current_user.id, community_id, "ACCESS_DENIED", "membership", None,
            ip_address=get_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this community",
        )
    return current_user