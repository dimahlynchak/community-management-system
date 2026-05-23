from sqlalchemy.orm import Session

from app.models.community import Community
from app.models.unit import Unit
from app.schemas.community import CommunityCreate, CommunityUpdate, UnitCreate, UnitUpdate


def create_community(db: Session, data: CommunityCreate) -> Community:
    community = Community(**data.model_dump())
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


def get_communities(db: Session) -> list[Community]:
    return db.query(Community).all()


def get_community(db: Session, community_id: int) -> Community | None:
    return db.query(Community).filter(Community.id == community_id).first()


def update_community(db: Session, community: Community, data: CommunityUpdate) -> Community:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(community, field, value)
    db.commit()
    db.refresh(community)
    return community


def delete_community(db: Session, community: Community) -> None:
    db.delete(community)
    db.commit()


def create_unit(db: Session, community_id: int, data: UnitCreate) -> Unit:
    unit = Unit(community_id=community_id, **data.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


def get_units_by_community(db: Session, community_id: int) -> list[Unit]:
    return db.query(Unit).filter(Unit.community_id == community_id).all()


def get_unit(db: Session, unit_id: int) -> Unit | None:
    return db.query(Unit).filter(Unit.id == unit_id).first()


def update_unit(db: Session, unit: Unit, data: UnitUpdate) -> Unit:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(db: Session, unit: Unit) -> None:
    db.delete(unit)
    db.commit()