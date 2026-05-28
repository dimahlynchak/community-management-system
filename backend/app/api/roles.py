from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError, InternalError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission, require_membership, get_client_ip
from app.models.role import Role
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.schemas.role import AssignRoleRequest, UserRoleResponse, RoleResponse
from app.services.audit import create_audit_entry
from app.services.role import get_roles, assign_role, get_community_members, remove_role
from app.services.community import get_community


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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage")),
):
    """Призначити роль користувачу в спільноті."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        ucr = assign_role(db, data.user_id, community_id, data.role_name, data.unit_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (IntegrityError, InternalError) as e:
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if "does not belong to community" in error_msg:
            raise HTTPException(status_code=400, detail="Unit does not belong to this community")
        raise HTTPException(status_code=409, detail="User already has a role in this community")
    create_audit_entry(
        db, current_user.id, community_id, "ASSIGN_ROLE", "member", data.user_id,
        details={"role_name": data.role_name, "unit_id": data.unit_id},
        ip_address=get_client_ip(request),
    )
    return ucr


@router.get(
    "/api/communities/{community_id}/members",
    response_model=list[UserRoleResponse],
)
def list_members(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage")),
):
    """Видалити роль користувача зі спільноти."""
    ucr = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == user_id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if ucr is None:
        raise HTTPException(status_code=404, detail="Member not found")

    role = db.query(Role).filter(Role.id == ucr.role_id).first()
    if role is not None and role.name == "head":
        head_count = (
            db.query(UserCommunityRole)
            .join(Role, Role.id == UserCommunityRole.role_id)
            .filter(
                UserCommunityRole.community_id == community_id,
                Role.name == "head",
            )
            .count()
        )
        if head_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="Cannot remove the last head of the community",
            )
    remove_role(db, ucr)
    create_audit_entry(
        db, current_user.id, community_id, "REMOVE_ROLE", "member", user_id,
        ip_address=get_client_ip(request),
    )