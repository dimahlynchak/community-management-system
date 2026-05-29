import secrets
import string

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.role import Role
from app.models.unit import Unit
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.services.auth import revoke_all_user_refresh_tokens


_PASSWORD_ALPHABET = string.ascii_letters + string.digits


def _generate_password(length: int = 12) -> str:
    """Випадковий пароль із літер і цифр. Гарантовано має літеру і цифру,
    що відповідає валідаторам схеми UserCreate."""
    while True:
        candidate = ''.join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))
        if any(c.isalpha() for c in candidate) and any(c.isdigit() for c in candidate):
            return candidate


def get_roles(db: Session) -> list[Role]:
    return db.query(Role).all()


def assign_role(
    db: Session, user_id: int, community_id: int, role_name: str, unit_id: int | None,
) -> UserCommunityRole:
    """Призначає роль користувачу в спільноті. Якщо вказано unit_id, перевіряє
    що приміщення активне (не soft-deleted) і належить цій спільноті —
    деактивовані юніти не приймають нових власників."""
    role = db.query(Role).filter(Role.name == role_name).first()
    if role is None:
        raise ValueError(f"Role '{role_name}' not found")

    if unit_id is not None:
        unit = db.query(Unit).filter(Unit.id == unit_id).first()
        if unit is None or unit.community_id != community_id:
            raise ValueError("Unit does not belong to this community")
        if not unit.is_active:
            raise ValueError("Unit is deactivated")

    ucr = UserCommunityRole(
        user_id=user_id,
        community_id=community_id,
        role_id=role.id,
        unit_id=unit_id,
    )
    db.add(ucr)
    db.commit()
    db.refresh(ucr)
    return ucr


def get_community_members(db: Session, community_id: int) -> list[UserCommunityRole]:
    return db.query(UserCommunityRole).filter(
        UserCommunityRole.community_id == community_id
    ).all()


def remove_role(db: Session, ucr: UserCommunityRole) -> None:
    db.delete(ucr)
    db.commit()


def lookup_user_by_email(db: Session, email: str) -> User | None:
    """Пошук користувача за email. Використовується головою для додавання
    юзера, який сам зареєструвався."""
    return db.query(User).filter(User.email == email.strip()).first()


def create_member_with_user(
    db: Session,
    community_id: int,
    email: str,
    full_name: str,
    phone: str | None,
    role_name: str,
    unit_id: int | None,
) -> tuple[User, UserCommunityRole, str]:
    """Створює нового користувача з випадковим паролем і одразу призначає
    йому роль у спільноті. Повертає (user, membership, generated_password).

    Якщо юзер з таким email уже існує — кидає ValueError (голова має
    скористатися пошуком + assign_role замість цього ендпоінту)."""
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise ValueError("User with this email already exists; use member lookup")

    password = _generate_password()
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=phone,
    )
    db.add(user)
    db.flush()  # отримуємо user.id без коміту, щоб assign_role йшов у тій самій транзакції

    try:
        membership = assign_role(db, user.id, community_id, role_name, unit_id)
    except Exception:
        db.rollback()
        raise

    db.refresh(user)
    return user, membership, password


def reset_user_password_by_admin(db: Session, target_user_id: int) -> tuple[User, str]:
    """Голова скидає пароль учаснику. Генерує новий випадковий пароль,
    оновлює хеш, відкликає всі активні refresh-токени цього юзера.
    Повертає (user, new_password) — голова передає пароль особисто
    поза програмою; зберігати його у БД у відкритому вигляді не можна."""
    user = db.query(User).filter(User.id == target_user_id).first()
    if user is None:
        raise ValueError("User not found")

    new_password = _generate_password()
    user.password_hash = hash_password(new_password)
    db.commit()
    revoke_all_user_refresh_tokens(db, user.id)
    db.refresh(user)
    return user, new_password
