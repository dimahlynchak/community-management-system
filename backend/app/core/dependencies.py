from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_permission(permission_codename: str):
    """Dependency factory: перевіряє чи має користувач певний дозвіл (з урахуванням ієрархії ролей)."""

    def _check(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.models.role import Role
        from app.models.user_community_role import UserCommunityRole

        # Отримуємо роль користувача (поки що — перша спільнота)
        ucr = db.query(UserCommunityRole).filter(
            UserCommunityRole.user_id == current_user.id
        ).first()

        if ucr is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No role assigned",
            )

        # Збираємо всі дозволи по ієрархії ролей
        all_permissions: set[str] = set()
        role = db.query(Role).filter(Role.id == ucr.role_id).first()

        while role is not None:
            for perm in role.permissions:
                all_permissions.add(perm.codename)
            if role.parent_role_id:
                role = db.query(Role).filter(Role.id == role.parent_role_id).first()
            else:
                role = None

        if permission_codename not in all_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_codename}' required",
            )
        return current_user

    return _check