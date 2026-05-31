"""Юніт-тести модуля рольового доступу: валідація користувача в assign_role,
захист засновника від видалення та зміни ролі."""
import pytest

from app.core.security import hash_password
from app.models.user import User
from app.services.role import assign_role, remove_role


@pytest.fixture()
def second_user(db_session):
    """Звичайний користувач, відмінний від голови."""
    u = User(
        email="user2@test.local",
        password_hash=hash_password("User1234"),
        full_name="Second User",
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def second_head(db_session, community):
    """Ще один голова — потрібно для сценаріїв з кількома головами."""
    u = User(
        email="head2@test.local",
        password_hash=hash_password("Head1234"),
        full_name="Second Head",
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    assign_role(db_session, u.id, community.id, "head", None)
    return u


# === Призначення ролей ===

def test_assign_role_to_existing_active_user(db_session, community, second_user):
    """Базовий happy path: призначення ролі активному юзеру працює."""
    ucr = assign_role(db_session, second_user.id, community.id, "accountant", None)
    assert ucr.id is not None
    assert ucr.user_id == second_user.id
    assert ucr.community_id == community.id


def test_assign_role_to_nonexistent_user_raises(db_session, community):
    """Неіснуючий user_id → ValueError, а не IntegrityError з misleading 409."""
    with pytest.raises(ValueError, match="User not found"):
        assign_role(db_session, 99999, community.id, "resident", None)


def test_assign_role_to_inactive_user_raises(db_session, community, second_user):
    """Деактивованому юзеру не можна давати нову роль."""
    second_user.is_active = False
    db_session.commit()
    with pytest.raises(ValueError, match="User is inactive"):
        assign_role(db_session, second_user.id, community.id, "resident", None)


# === Захист засновника ===

def test_founder_cannot_be_assigned_non_head_role(db_session, community, head_user):
    """Засновнику не можна змінити роль на не-head — це б позбавило контролю."""
    with pytest.raises(ValueError, match="Founder must retain"):
        assign_role(db_session, head_user.id, community.id, "accountant", None)


def test_founder_membership_cannot_be_removed(db_session, community, head_user):
    """remove_role блокує видалення членства засновника."""
    ucr = assign_role(db_session, head_user.id, community.id, "head", None)
    with pytest.raises(ValueError, match="Cannot remove the founder"):
        remove_role(db_session, ucr)


def test_non_founder_head_can_be_removed(db_session, community, second_head):
    """Звичайного голову (не засновника) можна видалити."""
    from app.models.user_community_role import UserCommunityRole
    ucr = db_session.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == second_head.id,
        UserCommunityRole.community_id == community.id,
    ).first()
    remove_role(db_session, ucr)
    # Перевіряємо, що membership справді видалено
    again = db_session.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == second_head.id,
        UserCommunityRole.community_id == community.id,
    ).first()
    assert again is None
