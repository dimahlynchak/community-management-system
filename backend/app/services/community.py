from sqlalchemy.orm import Session

from app.models.community import Community
from app.models.unit import Unit
from app.models.user_community_role import UserCommunityRole
from app.schemas.community import CommunityCreate, CommunityUpdate, UnitCreate, UnitUpdate


def create_community(db: Session, data: CommunityCreate) -> Community:
    community = Community(**data.model_dump())
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


def get_communities_for_user(db: Session, user_id: int) -> list[Community]:
    return (
        db.query(Community)
        .join(UserCommunityRole, UserCommunityRole.community_id == Community.id)
        .filter(UserCommunityRole.user_id == user_id, Community.is_active == True)
        .all()
    )


def get_community(db: Session, community_id: int) -> Community | None:
    return db.query(Community).filter(Community.id == community_id, Community.is_active == True).first()


def update_community(db: Session, community: Community, data: CommunityUpdate) -> Community:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(community, field, value)
    db.commit()
    db.refresh(community)
    return community


def delete_community(db: Session, community: Community) -> None:
    community.is_active = False
    db.commit()


def create_unit(db: Session, community_id: int, data: UnitCreate) -> Unit:
    unit = Unit(community_id=community_id, **data.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


def get_units_by_community(db: Session, community_id: int) -> list[Unit]:
    """Перелік активних приміщень спільноти. Деактивовані (is_active=false)
    залишаються у БД для збереження історії нарахувань/оплат, але у списку не
    видаються."""
    return (
        db.query(Unit)
        .filter(Unit.community_id == community_id, Unit.is_active == True)
        .all()
    )


def get_unit(db: Session, unit_id: int) -> Unit | None:
    """Юніт за ID незалежно від is_active — потрібно для перевірок при
    обробці платежів, балансу, аудиту, де відображаємо й історичні дані."""
    return db.query(Unit).filter(Unit.id == unit_id).first()


def update_unit(db: Session, unit: Unit, data: UnitUpdate) -> Unit:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(db: Session, unit: Unit) -> None:
    """Soft delete: позначає юніт неактивним. Усі пов'язані нарахування,
    оплати та записи аудиту зберігаються без змін."""
    unit.is_active = False
    db.commit()