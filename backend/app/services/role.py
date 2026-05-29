from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.unit import Unit
from app.models.user_community_role import UserCommunityRole


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