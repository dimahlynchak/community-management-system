from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError, InternalError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission, require_membership, get_client_ip
from app.models.role import Role
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.schemas.role import (
    AssignRoleRequest,
    CreateMemberWithUserRequest,
    CreateMemberWithUserResponse,
    MemberLookupResponse,
    PasswordResetResponse,
    RoleResponse,
    UserRoleResponse,
)
from app.services.audit import create_audit_entry
from app.services.role import (
    assign_role,
    create_member_with_user,
    get_community_members,
    get_roles,
    lookup_user_by_email,
    remove_role,
    reset_user_password_by_admin,
)
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
    "/api/communities/{community_id}/members/lookup",
    response_model=MemberLookupResponse,
)
def lookup_member(
    community_id: int,
    request: Request,
    email: str = Query(..., description="Email користувача для пошуку"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage")),
):
    """Пошук існуючого користувача за email перед додаванням до спільноти.
    Повертає мінімальний публічний профіль; решта даних залишаються
    приватними. 404, якщо такого користувача немає."""
    user = lookup_user_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=404, detail="User with this email not found")
    return MemberLookupResponse(id=user.id, full_name=user.full_name, email=user.email)


@router.post(
    "/api/communities/{community_id}/members/create-with-user",
    response_model=CreateMemberWithUserResponse,
    status_code=201,
)
def create_member_with_new_user(
    community_id: int,
    data: CreateMemberWithUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage")),
):
    """Створює нового користувача з випадковим паролем і одразу призначає
    йому роль у спільноті. Згенерований пароль повертається голові один раз
    у відповіді — голова передає його юзеру поза програмою (мессенджер,
    особисто). Юзер при першому вході має змінити пароль через /profile."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        user, membership, password = create_member_with_user(
            db,
            community_id=community_id,
            email=data.email,
            full_name=data.full_name,
            phone=data.phone,
            role_name=data.role_name,
            unit_id=data.unit_id,
        )
    except ValueError as e:
        msg = str(e)
        status_code = 409 if "already exists" in msg else 400
        raise HTTPException(status_code=status_code, detail=msg)
    except (IntegrityError, InternalError) as e:
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise HTTPException(status_code=409, detail=error_msg)

    # Два аудиторські записи: створення юзера + призначення ролі.
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "user", user.id,
        details={"email": data.email, "full_name": data.full_name},
        ip_address=get_client_ip(request),
    )
    create_audit_entry(
        db, current_user.id, community_id, "ASSIGN_ROLE", "member", user.id,
        details={"role_name": data.role_name, "unit_id": data.unit_id},
        ip_address=get_client_ip(request),
    )
    return CreateMemberWithUserResponse(
        membership=UserRoleResponse.model_validate(membership),
        user_id=user.id,
        email=user.email,
        generated_password=password,
    )


@router.post(
    "/api/communities/{community_id}/members/{user_id}/reset-password",
    response_model=PasswordResetResponse,
)
def reset_member_password(
    community_id: int,
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:manage")),
):
    """Скидає пароль учаснику спільноти на новий випадковий. Голова передає
    його юзеру поза програмою. Усі активні refresh-токени цього юзера
    відкликаються — попередні сесії на інших пристроях буде завершено."""
    ucr = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == user_id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if ucr is None:
        raise HTTPException(status_code=404, detail="Member not found in this community")
    try:
        user, new_password = reset_user_password_by_admin(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    create_audit_entry(
        db, current_user.id, community_id, "PASSWORD_RESET", "user", user.id,
        details={"by": "head"},
        ip_address=get_client_ip(request),
    )
    return PasswordResetResponse(user_id=user.id, new_password=new_password)


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