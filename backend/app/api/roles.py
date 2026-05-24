from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.schemas.role import AssignRoleRequest, UserRoleResponse, RoleResponse
from app.services.role import get_roles, assign_role, get_community_members, remove_role
from app.services.community import get_community
from sqlalchemy.exc import IntegrityError, InternalError


router = APIRouter(tags=["roles"])


@router.get("/api/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати список усіх ролей."""
    return get_roles(db)


@router.post(
    "/api/communities/{community_id}/members",
    response_model=UserRoleResponse,
    status_code=201,
)
def assign_member_role(
    community_id: int,
    data: AssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Призначити роль користувачу в спільноті."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        return assign_role(db, data.user_id, community_id, data.role_name, data.unit_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (IntegrityError, InternalError) as e:
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if "does not belong to community" in error_msg:
            raise HTTPException(status_code=400, detail="Unit does not belong to this community")
        raise HTTPException(status_code=409, detail="User already has a role in this community")


@router.get(
    "/api/communities/{community_id}/members",
    response_model=list[UserRoleResponse],
)
def list_members(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати учасників спільноти з ролями."""
    return get_community_members(db, community_id)


@router.delete(
    "/api/communities/{community_id}/members/{user_id}",
    status_code=204,
)
def remove_member(
    community_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Видалити роль користувача зі спільноти."""
    ucr = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == user_id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if ucr is None:
        raise HTTPException(status_code=404, detail="Member not found")
    remove_role(db, ucr)