from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission, require_membership, get_client_ip
from app.models.user import User
from app.schemas.community import (
    CommunityCreate, CommunityUpdate, CommunityResponse,
    UnitCreate, UnitUpdate, UnitResponse,
)
from app.services.community import (
    create_community, get_communities_for_user, get_community,
    update_community, delete_community,
    create_unit, get_units_by_community, get_unit,
    update_unit, delete_unit,
)
from app.services.role import assign_role
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
    """Створити нову спільноту (ОСББ). Творець стає головою правління."""
    try:
        community = create_community(db, data)
    except IntegrityError as exc:
        db.rollback()
        detail = "Community with this EDRPOU already exists" if "edrpou" in str(exc).lower() else "Community already exists"
        raise HTTPException(status_code=409, detail=detail)

    assign_role(db, current_user.id, community.id, "head", None)
    create_audit_entry(
        db, current_user.id, community.id, "CREATE", "community", community.id,
        details=data.model_dump(), ip_address=get_client_ip(request),
    )
    return community


@router.get("/", response_model=list[CommunityResponse])
def list_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати спільноти, у яких користувач має роль."""
    return get_communities_for_user(db, current_user.id)


@router.get("/{community_id}", response_model=CommunityResponse)
def get_one(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("community:manage")),
):
    """Оновити дані спільноти."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        updated = update_community(db, community, data)
    except IntegrityError as exc:
        db.rollback()
        detail = "Community with this EDRPOU already exists" if "edrpou" in str(exc).lower() else "Integrity constraint violated"
        raise HTTPException(status_code=409, detail=detail)
    create_audit_entry(
        db, current_user.id, community_id, "UPDATE", "community", community_id,
        details=data.model_dump(exclude_unset=True), ip_address=get_client_ip(request),
    )
    return updated


@router.delete("/{community_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    community_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("community:manage")),
):
    """Видалити спільноту."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    delete_community(db, community)
    create_audit_entry(
        db, current_user.id, community_id, "DELETE", "community", community_id,
        ip_address=get_client_ip(request),
    )


# --- Units ---

@router.post("/{community_id}/units", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
def create_community_unit(
    community_id: int,
    data: UnitCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units:manage")),
):
    """Додати приміщення до спільноти."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        unit = create_unit(db, community_id, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unit with this number already exists in community")
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "unit", unit.id,
        details=data.model_dump(), ip_address=get_client_ip(request),
    )
    return unit

@router.get("/{community_id}/units", response_model=list[UnitResponse])
def list_community_units(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    """Отримати всі приміщення спільноти."""
    return get_units_by_community(db, community_id)


@router.get("/{community_id}/units/{unit_id}", response_model=UnitResponse)
def get_community_unit(
    community_id: int,
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units:manage")),
):
    """Оновити дані приміщення. Деактивовані приміщення не редагуються."""
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id or not unit.is_active:
        raise HTTPException(status_code=404, detail="Unit not found")
    try:
        updated = update_unit(db, unit, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unit with this number already exists in community")
    create_audit_entry(
        db, current_user.id, community_id, "UPDATE", "unit", unit_id,
        details=data.model_dump(exclude_unset=True),
        ip_address=get_client_ip(request),
    )
    return updated


@router.delete("/{community_id}/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_community_unit(
    community_id: int,
    unit_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units:manage")),
):
    """Деактивувати приміщення (soft-delete). Усі історичні нарахування,
    оплати та записи аудиту зберігаються. Повторне видалення вже неактивного
    приміщення повертає 404."""
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id or not unit.is_active:
        raise HTTPException(status_code=404, detail="Unit not found")
    delete_unit(db, unit)
    create_audit_entry(
        db, current_user.id, community_id, "DELETE", "unit", unit_id,
        ip_address=get_client_ip(request),
    )