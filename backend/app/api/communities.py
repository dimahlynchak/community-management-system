from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.community import (
    CommunityCreate, CommunityUpdate, CommunityResponse,
    UnitCreate, UnitUpdate, UnitResponse,
)
from app.services.community import (
    create_community, get_communities, get_community,
    update_community, delete_community,
    create_unit, get_units_by_community, get_unit,
    update_unit, delete_unit,
)
from app.services.audit import create_audit_entry
from fastapi import Request


router = APIRouter(prefix="/api/communities", tags=["communities"])


# --- Communities ---

@router.post("/", response_model=CommunityResponse, status_code=status.HTTP_201_CREATED)
def create(
    data: CommunityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Створити нову спільноту (ОСББ)."""
    try:
        community = create_community(db, data)
        create_audit_entry(
            db, current_user.id, community.id, "CREATE", "community", community.id,
            details=data.model_dump(), ip_address=request.client.host,
        )
        return community
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Community already exists")


@router.get("/", response_model=list[CommunityResponse])
def list_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати список усіх спільнот."""
    return get_communities(db)


@router.get("/{community_id}", response_model=CommunityResponse)
def get_one(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати спільноту за ID."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


@router.patch("/{community_id}", response_model=CommunityResponse)
def update(
    community_id: int,
    data: CommunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оновити дані спільноти."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return update_community(db, community, data)


@router.delete("/{community_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Видалити спільноту."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    delete_community(db, community)


# --- Units ---

@router.post("/{community_id}/units", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
def create_community_unit(
    community_id: int,
    data: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Додати приміщення до спільноти."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        return create_unit(db, community_id, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unit with this number already exists in community")

@router.get("/{community_id}/units", response_model=list[UnitResponse])
def list_community_units(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати всі приміщення спільноти."""
    return get_units_by_community(db, community_id)


@router.get("/{community_id}/units/{unit_id}", response_model=UnitResponse)
def get_community_unit(
    community_id: int,
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати приміщення за ID."""
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.patch("/{community_id}/units/{unit_id}", response_model=UnitResponse)
def update_community_unit(
    community_id: int,
    unit_id: int,
    data: UnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оновити дані приміщення."""
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    return update_unit(db, unit, data)


@router.delete("/{community_id}/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_community_unit(
    community_id: int,
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Видалити приміщення."""
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    delete_unit(db, unit)