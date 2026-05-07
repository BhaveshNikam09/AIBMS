import re
import secrets
import string


EMAIL_RE = re.compile(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
PHONE_RE = re.compile(r"(?<!\d)(?:\+91[- ]?)?([6-9]\d{9})(?!\d)")


def is_management_action(action_type: str) -> bool:
    return str(action_type or "").strip().lower() in {
        "create_branch",
        "update_branch",
        "delete_branch",
        "create_member",
        "grant_access",
        "revoke_access",
        "change_role",
        "toggle_member_status",
    }


def parse_management_action(message: str, business_id: str) -> dict:
    raw_message = str(message or "").strip()
    msg_lower = _normalize_text(raw_message.lower())

    if not raw_message:
        return {"mode": "read_only"}

    if _is_create_branch_command(msg_lower):
        return _parse_create_branch(raw_message, msg_lower, business_id)

    if _is_update_branch_command(msg_lower):
        return _parse_update_branch(raw_message, msg_lower, business_id)

    if _is_change_role_command(msg_lower):
        return _parse_change_role(raw_message, msg_lower, business_id)

    if _is_revoke_access_command(msg_lower):
        return _parse_revoke_access(raw_message, msg_lower, business_id)

    if _is_toggle_member_status_command(msg_lower):
        return _parse_toggle_member_status(raw_message, msg_lower, business_id)

    if _is_delete_branch_command(msg_lower):
        return _parse_delete_branch(raw_message, msg_lower, business_id)

    if _is_create_member_command(msg_lower):
        return _parse_create_member(raw_message, msg_lower, business_id)

    if _is_grant_access_command(msg_lower):
        return _parse_grant_access(raw_message, msg_lower, business_id)

    return {"mode": "read_only"}


def build_management_confirmation_message(action_data: dict) -> str:
    action_type = str(action_data.get("action_type") or "").lower()

    if action_type == "create_branch":
        lines = [
            "Please confirm this branch creation:",
            "",
            f"- Branch name: {action_data.get('branch_name')}",
            f"- Branch type: {action_data.get('branch_type', 'branch').replace('_', ' ')}",
        ]
        if action_data.get("city"):
            lines.append(f"- City: {action_data['city']}")
        if action_data.get("locality"):
            lines.append(f"- Locality: {action_data['locality']}")
        if action_data.get("manager_email"):
            lines.append(f"- Manager email: {action_data['manager_email']}")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    if action_type == "delete_branch":
        return "\n".join(
            [
                "Please confirm this branch deactivation:",
                "",
                f"- Branch: {action_data.get('branch_reference')}",
                "- Action: deactivate branch",
                "",
                "Reply **yes** to confirm or **no** to cancel.",
            ]
        )

    if action_type == "create_member":
        lines = [
            "Please confirm this team member action:",
            "",
            f"- Name: {action_data.get('full_name')}",
            f"- Email: {action_data.get('email')}",
            f"- Role: {action_data.get('role', 'staff').replace('_', ' ')}",
        ]
        if action_data.get("branch_reference"):
            lines.append(f"- Branch assignment: {action_data['branch_reference']}")
        lines.append("- A temporary password will be generated automatically if the user does not already exist.")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    if action_type == "update_branch":
        lines = [
            "Please confirm this branch update:",
            "",
            f"- Branch: {action_data.get('branch_reference')}",
        ]
        updates = action_data.get("updates") or {}
        for key, label in (
            ("name", "New name"),
            ("branch_type", "Branch type"),
            ("city", "City"),
            ("locality", "Locality"),
            ("state", "State"),
            ("country", "Country"),
            ("email", "Email"),
            ("phone", "Phone"),
            ("address_line1", "Address line 1"),
            ("address_line2", "Address line 2"),
        ):
            if updates.get(key):
                value = updates[key]
                if key == "branch_type":
                    value = str(value).replace("_", " ")
                lines.append(f"- {label}: {value}")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    if action_type == "grant_access":
        return "\n".join(
            [
                "Please confirm this branch access assignment:",
                "",
                f"- Member: {action_data.get('member_reference')}",
                f"- Branch: {action_data.get('branch_reference')}",
                f"- Branch role: {action_data.get('role', 'staff')}",
                "",
                "Reply **yes** to confirm or **no** to cancel.",
            ]
        )

    if action_type == "revoke_access":
        lines = [
            "Please confirm this access removal:",
            "",
            f"- Member: {action_data.get('member_reference')}",
            f"- Scope: {'branch access' if action_data.get('branch_reference') else 'business access'}",
        ]
        if action_data.get("branch_reference"):
            lines.append(f"- Branch: {action_data['branch_reference']}")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    if action_type == "toggle_member_status":
        lines = [
            "Please confirm this member status change:",
            "",
            f"- Member: {action_data.get('member_reference')}",
            f"- Target status: {str(action_data.get('target_status') or 'inactive').replace('_', ' ')}",
            f"- Scope: {'branch' if action_data.get('branch_reference') else 'business'}",
        ]
        if action_data.get("branch_reference"):
            lines.append(f"- Branch: {action_data['branch_reference']}")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    if action_type == "change_role":
        lines = [
            "Please confirm this role change:",
            "",
            f"- Member: {action_data.get('member_reference')}",
            f"- Scope: {'branch' if action_data.get('branch_reference') else 'business'}",
            f"- New role: {action_data.get('role', 'staff').replace('_', ' ')}",
        ]
        if action_data.get("branch_reference"):
            lines.append(f"- Branch: {action_data['branch_reference']}")
        lines.extend(["", "Reply **yes** to confirm or **no** to cancel."])
        return "\n".join(lines)

    return ""


def execute_management_action(pending_action) -> str:
    try:
        action_type = str(pending_action.action_type or "").strip().lower()
        if action_type == "create_branch":
            return _execute_create_branch(pending_action)
        if action_type == "update_branch":
            return _execute_update_branch(pending_action)
        if action_type == "delete_branch":
            return _execute_delete_branch(pending_action)
        if action_type == "create_member":
            return _execute_create_member(pending_action)
        if action_type == "grant_access":
            return _execute_grant_access(pending_action)
        if action_type == "revoke_access":
            return _execute_revoke_access(pending_action)
        if action_type == "change_role":
            return _execute_change_role(pending_action)
        if action_type == "toggle_member_status":
            return _execute_toggle_member_status(pending_action)
        return "Summary\nI could not identify the management action to execute."
    except Exception as exc:
        return "\n".join(
            [
                "Summary",
                "The requested admin action could not be completed.",
                f"- Reason: {exc}",
                "Recommended next steps",
                "Check the branch, member, and role details and try again.",
            ]
        )


def _is_create_branch_command(msg_lower: str) -> bool:
    return any(
        phrase in msg_lower
        for phrase in (
            "create branch",
            "add branch",
            "new branch",
            "open branch",
            "set up branch",
            "setup branch",
        )
    )


def _is_update_branch_command(msg_lower: str) -> bool:
    if any(
        phrase in msg_lower
        for phrase in (
            "update branch",
            "edit branch",
            "modify branch",
            "rename branch",
            "change branch name",
            "set branch name",
            "update branch details",
            "change branch details",
            "branch address",
            "branch phone",
            "branch email",
            "branch city",
            "branch locality",
        )
    ):
        return True

    return "branch" in msg_lower and any(word in msg_lower for word in ("rename", "update", "edit", "modify", "change", "set"))


def _is_delete_branch_command(msg_lower: str) -> bool:
    if " from " in f" {msg_lower} ":
        return False
    return (
        any(
            phrase in msg_lower
            for phrase in (
                "delete branch",
                "remove branch",
                "deactivate branch",
                "close branch",
                "delete the branch",
                "remove the branch",
                "deactivate the branch",
                "close the branch",
            )
        )
        or bool(re.search(r"(?:delete|remove|deactivate|close)\s+(?:the\s+)?[a-z0-9][a-z0-9 &.-]*\s+branch\b", msg_lower))
    )


def _is_toggle_member_status_command(msg_lower: str) -> bool:
    member_words = ("staff", "member", "employee", "user", "accountant", "manager", "ca")
    status_words = (
        "activate",
        "deactivate",
        "enable",
        "disable",
        "reinstate",
        "suspend",
        "unsuspend",
        "reactivate",
        "pause access",
        "resume access",
    )
    has_status = any(word in msg_lower for word in status_words)
    if not has_status:
        return False
    if any(word in msg_lower for word in member_words):
        return True
    if "@" in msg_lower:
        return True
    if "branch" not in msg_lower:
        return True
    return any(prep in msg_lower for prep in (" for ", " in ", " at ", " from ", " to "))


def _is_create_member_command(msg_lower: str) -> bool:
    member_words = ("staff", "member", "employee", "team member", "accountant", "manager", "ca")
    create_words = ("create", "add", "new", "invite", "onboard")
    return any(word in msg_lower for word in member_words) and any(word in msg_lower for word in create_words)


def _is_grant_access_command(msg_lower: str) -> bool:
    return (
        "branch" in msg_lower
        and any(phrase in msg_lower for phrase in ("grant access", "give access", "branch access", "assign"))
        and not _is_create_branch_command(msg_lower)
    )


def _is_change_role_command(msg_lower: str) -> bool:
    return any(
        phrase in msg_lower
        for phrase in (
            "change role",
            "set role",
            "update role",
            "make ",
            "promote ",
            "change permission",
            "give permission",
        )
    )


def _is_revoke_access_command(msg_lower: str) -> bool:
    return any(
        phrase in msg_lower
        for phrase in (
            "revoke access",
            "remove access",
            "remove member",
            "remove staff",
            "remove employee",
            "remove user",
        )
    ) or ("remove" in msg_lower and ("branch" in msg_lower or "access" in msg_lower))


def _parse_create_branch(raw_message: str, msg_lower: str, business_id: str) -> dict:
    branch_name = _extract_create_branch_name(raw_message)
    if not branch_name:
        return _clarification_response(
            "create a branch",
            "the branch name",
            'Example: "Create branch Nashik West in Nashik city"',
        )

    action = {
        "mode": "action",
        "action_type": "create_branch",
        "business_id": business_id,
        "branch_name": branch_name,
        "branch_type": _detect_branch_type(msg_lower),
        "city": _extract_location_field(raw_message, "city") or _extract_create_branch_city(raw_message),
        "locality": _extract_location_field(raw_message, "locality"),
        "manager_email": _extract_manager_email(raw_message),
        "email": _extract_generic_email(raw_message) if "manager" not in msg_lower else None,
        "phone": _extract_phone(raw_message),
        "raw_message": raw_message,
    }
    if not action["manager_email"] and action["email"]:
        action["manager_email"] = action["email"]
    return action


def _parse_delete_branch(raw_message: str, msg_lower: str, business_id: str) -> dict:
    branch_reference = _extract_delete_branch_reference(raw_message)
    if not branch_reference:
        return _clarification_response(
            "deactivate a branch",
            "which branch to deactivate",
            'Example: "Deactivate Nashik branch"',
        )

    return {
        "mode": "action",
        "action_type": "delete_branch",
        "business_id": business_id,
        "branch_reference": branch_reference,
        "raw_message": raw_message,
    }


def _parse_update_branch(raw_message: str, msg_lower: str, business_id: str) -> dict:
    branch_reference = _extract_branch_reference(raw_message)
    updates = _extract_branch_update_fields(raw_message)
    if not branch_reference:
        return _clarification_response(
            "update a branch",
            "which branch to update",
            'Example: "Update Nashik branch city to Pune and phone to 9876543210"',
        )

    if not updates:
        return _clarification_response(
            "update a branch",
            "what field to change",
            'Example: "Rename Nashik branch to Nashik West" or "Update Nashik branch city to Pune"',
        )

    return {
        "mode": "action",
        "action_type": "update_branch",
        "business_id": business_id,
        "branch_reference": branch_reference,
        "updates": updates,
        "raw_message": raw_message,
    }


def _parse_toggle_member_status(raw_message: str, msg_lower: str, business_id: str) -> dict:
    member_reference = _extract_member_reference(raw_message)
    target_status = _extract_toggle_member_status(raw_message)
    branch_reference = _extract_branch_reference(raw_message)

    if not member_reference:
        return _clarification_response(
            "change a member status",
            "the member email or full name",
            'Example: "Deactivate Rahul Patil" or "Enable rahul@acme.com for Nashik branch"',
        )

    if not target_status:
        return _clarification_response(
            "change a member status",
            "whether to activate or deactivate",
            'Example: "Deactivate Rahul Patil" or "Activate Rahul Patil"',
        )

    return {
        "mode": "action",
        "action_type": "toggle_member_status",
        "business_id": business_id,
        "member_reference": member_reference,
        "branch_reference": branch_reference,
        "target_status": target_status,
        "raw_message": raw_message,
    }


def _parse_create_member(raw_message: str, msg_lower: str, business_id: str) -> dict:
    email = _extract_generic_email(raw_message)
    full_name = _extract_member_name(raw_message, email=email)
    if not full_name and email:
        full_name = _name_from_email(email)

    role = _detect_business_role(msg_lower)
    branch_reference = _extract_branch_reference(raw_message)

    missing = []
    if not email:
        missing.append("email")
    if not full_name:
        missing.append("member name")

    if missing:
        return _clarification_response(
            "create or add a team member",
            " and ".join(missing),
            'Example: "Create staff Rahul Patil rahul@acme.com as accountant for Nashik branch"',
        )

    return {
        "mode": "action",
        "action_type": "create_member",
        "business_id": business_id,
        "full_name": full_name,
        "email": email,
        "role": role,
        "branch_reference": branch_reference,
        "raw_message": raw_message,
    }


def _parse_grant_access(raw_message: str, msg_lower: str, business_id: str) -> dict:
    branch_reference = _extract_branch_reference(raw_message)
    member_reference = _extract_member_reference(raw_message)
    role = _detect_branch_role(msg_lower)

    missing = []
    if not member_reference:
        missing.append("member email or full name")
    if not branch_reference:
        missing.append("branch name")

    if missing:
        return _clarification_response(
            "grant branch access",
            " and ".join(missing),
            'Example: "Grant access to rahul@acme.com for Nashik branch as accountant"',
        )

    return {
        "mode": "action",
        "action_type": "grant_access",
        "business_id": business_id,
        "member_reference": member_reference,
        "branch_reference": branch_reference,
        "role": role,
        "raw_message": raw_message,
    }


def _parse_revoke_access(raw_message: str, msg_lower: str, business_id: str) -> dict:
    member_reference = _extract_member_reference(raw_message)
    branch_reference = _extract_branch_reference(raw_message)

    if not member_reference:
        return _clarification_response(
            "remove access",
            "the member email or full name",
            'Example: "Remove rahul@acme.com from Nashik branch"',
        )

    return {
        "mode": "action",
        "action_type": "revoke_access",
        "business_id": business_id,
        "member_reference": member_reference,
        "branch_reference": branch_reference,
        "raw_message": raw_message,
    }


def _parse_change_role(raw_message: str, msg_lower: str, business_id: str) -> dict:
    member_reference = _extract_member_reference(raw_message)
    branch_reference = _extract_branch_reference(raw_message)
    role = _detect_branch_role(msg_lower) if branch_reference else _detect_business_role(msg_lower)

    missing = []
    if not member_reference:
        missing.append("member email or full name")
    if not role:
        missing.append("target role")

    if missing:
        return _clarification_response(
            "change a role",
            " and ".join(missing),
            'Example: "Make rahul@acme.com accountant for Nashik branch"',
        )

    return {
        "mode": "action",
        "action_type": "change_role",
        "business_id": business_id,
        "member_reference": member_reference,
        "branch_reference": branch_reference,
        "role": role,
        "raw_message": raw_message,
    }


def _execute_create_branch(pending_action) -> str:
    from apps.branches.models import Branch, BranchMember

    data = pending_action.action_data
    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    branch_name = data.get("branch_name")
    manager = None

    if Branch.objects.filter(business=business, name__iexact=branch_name, is_active=True).exists():
        return "\n".join(
            [
                "Summary",
                f"An active branch named {branch_name} already exists for this business.",
                "Recommended next steps",
                "Use a different branch name or update the existing branch instead.",
            ]
        )

    manager_email = data.get("manager_email")
    if manager_email:
        manager = _resolve_user_by_reference(manager_email)
        if manager is None:
            return "\n".join(
                [
                    "Summary",
                    f"No user was found with email {manager_email}.",
                    "Recommended next steps",
                    "Create the staff account first or remove the manager assignment from this branch command.",
                ]
            )
        if getattr(manager, "role", "") != "branch_manager":
            return "\n".join(
                [
                    "Summary",
                    f"{manager_email} is not a branch manager user.",
                    "Recommended next steps",
                    "Change that member's role to branch manager first, then try assigning them again.",
                ]
            )

    branch = Branch.objects.create(
        business=business,
        name=branch_name,
        branch_type=data.get("branch_type") or "branch",
        city=data.get("city") or "",
        locality=data.get("locality") or "",
        email=data.get("email") or "",
        phone=data.get("phone") or "",
        manager=manager,
    )

    if manager:
        BranchMember.objects.get_or_create(
            branch=branch,
            user=manager,
            defaults={"role": BranchMember.MemberRole.MANAGER, "assigned_by": pending_action.user},
        )

    lines = [
        "Summary",
        f"Branch {branch.name} was created successfully.",
        f"- Code: {branch.code}",
        f"- Type: {branch.branch_type.replace('_', ' ')}",
    ]
    if branch.city:
        lines.append(f"- City: {branch.city}")
    if branch.locality:
        lines.append(f"- Locality: {branch.locality}")
    if manager:
        lines.append(f"- Manager assigned: {manager.full_name} ({manager.email})")
    lines.extend(
        [
            "Recommended next steps",
            "Review branch operating hours, contact details, and member assignments if needed.",
            "Ask for branch-wise profit once transactions start flowing into this branch.",
        ]
    )
    return "\n".join(lines)


def _execute_delete_branch(pending_action) -> str:
    data = pending_action.action_data
    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    branch = _resolve_branch_for_business(business, data.get("branch_reference"))

    branch.is_active = False
    branch.save(update_fields=["is_active", "updated_at"])

    return "\n".join(
        [
            "Summary",
            f"Branch {branch.name} was deactivated successfully.",
            f"- Code: {branch.code}",
            f"- City: {branch.city or 'Not set'}",
            "Recommended next steps",
            "Review any staff or reporting dependencies tied to this branch.",
        ]
    )


def _execute_update_branch(pending_action) -> str:
    from apps.branches.models import Branch

    data = pending_action.action_data
    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    branch = _resolve_branch_for_business(business, data.get("branch_reference"))
    updates = data.get("updates") or {}

    if not updates:
        return "Summary\nNo branch fields were provided to update."

    new_name = updates.get("name")
    if new_name and Branch.objects.filter(
        business=business,
        name__iexact=new_name,
        is_active=True,
    ).exclude(pk=branch.pk).exists():
        raise ValueError(f"An active branch named {new_name} already exists in {business.name}.")

    update_fields = []
    field_map = {
        "name": "name",
        "branch_type": "branch_type",
        "city": "city",
        "locality": "locality",
        "state": "state",
        "country": "country",
        "email": "email",
        "phone": "phone",
        "address_line1": "address_line1",
        "address_line2": "address_line2",
    }

    for key, model_field in field_map.items():
        value = updates.get(key)
        if value:
            setattr(branch, model_field, value)
            update_fields.append(model_field)

    if not update_fields:
        return "Summary\nNo branch fields were provided to update."

    branch.save(update_fields=update_fields + ["updated_at"])

    lines = [
        "Summary",
        f"Branch {branch.name} was updated successfully.",
    ]
    for field in update_fields:
        label = field.replace("_", " ").title()
        value = getattr(branch, field)
        if field == "branch_type":
            value = str(value).replace("_", " ")
        lines.append(f"- {label}: {value}")
    lines.extend(
        [
            "Recommended next steps",
            "Review the branch card and ensure related permissions or reports still match the updated details.",
        ]
    )
    return "\n".join(lines)


def _execute_create_member(pending_action) -> str:
    from django.contrib.auth.hashers import make_password
    from apps.business.models import BusinessMember
    from apps.branches.models import BranchMember
    from apps.users.models import User

    data = pending_action.action_data
    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    email = data.get("email")
    role = _normalize_business_role_value(data.get("role") or "staff")
    branch = _resolve_optional_branch(business, data.get("branch_reference"))
    temp_password = None

    user = User.objects.filter(email__iexact=email).first()
    if user:
        created_user = False
    else:
        created_user = True
        temp_password = _generate_temp_password()
        user = User.objects.create(
            full_name=data.get("full_name"),
            email=email.lower(),
            password=make_password(temp_password),
            role=role,
            is_verified=True,
        )

    if getattr(user, "role", "") != role:
        user.role = role
        user.save(update_fields=["role", "updated_at"])

    member, created_membership = BusinessMember.objects.get_or_create(
        business=business,
        user=user,
        defaults={"role": role, "status": BusinessMember.MemberStatus.ACTIVE, "invited_by": pending_action.user},
    )
    if not created_membership and member.role != role:
        member.role = role
        member.status = BusinessMember.MemberStatus.ACTIVE
        member.save(update_fields=["role", "status"])

    branch_assignment = None
    if branch:
        branch_member, _ = BranchMember.objects.get_or_create(
            branch=branch,
            user=user,
            defaults={
                "role": _business_role_to_branch_role(role),
                "is_active": True,
                "assigned_by": pending_action.user,
            },
        )
        branch_member.role = _business_role_to_branch_role(role)
        branch_member.is_active = True
        branch_member.save(update_fields=["role", "is_active"])
        branch_assignment = branch.name
        if role == "branch_manager":
            branch.manager = user
            branch.save(update_fields=["manager", "updated_at"])

    lines = [
        "Summary",
        f"Member {user.full_name} is now available in {business.name}.",
        f"- Email: {user.email}",
        f"- Business role: {role.replace('_', ' ')}",
    ]
    if branch_assignment:
        lines.append(f"- Branch assignment: {branch_assignment}")
    if created_user and temp_password:
        lines.append(f"- Temporary password: {temp_password}")
        lines.append("- Ask the member to change this password after first login.")
    lines.extend(
        [
            "Recommended next steps",
            "Review the member's branch scope and update their permissions if needed.",
        ]
    )
    return "\n".join(lines)


def _execute_toggle_member_status(pending_action) -> str:
    from apps.business.models import BusinessMember
    from apps.branches.models import Branch, BranchMember

    data = pending_action.action_data
    business = _get_business_for_action(data.get("business_id"), pending_action.user)
    member_reference = data.get("member_reference")
    target_status = str(data.get("target_status") or "").strip().lower() or "inactive"
    is_active = target_status == "active"

    if data.get("branch_reference"):
        branch = _resolve_branch_for_business(business, data.get("branch_reference"))
        _ensure_branch_manage_permission(branch, pending_action.user)
        user = _resolve_user_or_member_reference(business, member_reference)
        branch_member = BranchMember.objects.filter(branch=branch, user=user).first()
        if not branch_member:
            raise ValueError(f"{member_reference} is not assigned to {branch.name}.")

        branch_member.is_active = is_active
        branch_member.save(update_fields=["is_active"])

        if not is_active and branch.manager_id == user.id:
            branch.manager = None
            branch.save(update_fields=["manager", "updated_at"])
        elif is_active and branch_member.role == "manager" and branch.manager_id != user.id:
            branch.manager = user
            branch.save(update_fields=["manager", "updated_at"])

        business_member = BusinessMember.objects.filter(business=business, user=user).first()
        if business_member and is_active and business_member.status != BusinessMember.MemberStatus.ACTIVE:
            business_member.status = BusinessMember.MemberStatus.ACTIVE
            business_member.save(update_fields=["status"])

        return "\n".join(
            [
                "Summary",
                f"{user.full_name}'s access for {branch.name} was {'activated' if is_active else 'deactivated'}.",
                f"- Branch role: {branch_member.role}",
                "Recommended next steps",
                "Review whether this branch assignment should also change the member's business-wide status.",
            ]
        )

    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    user = _resolve_user_or_member_reference(business, member_reference)
    business_member = BusinessMember.objects.filter(business=business, user=user).first()
    if not business_member:
        raise ValueError(f"{member_reference} is not a member of {business.name}.")
    if business.owner_id == user.id and not is_active:
        raise ValueError("The business owner cannot be deactivated.")

    business_member.status = BusinessMember.MemberStatus.ACTIVE if is_active else BusinessMember.MemberStatus.INACTIVE
    business_member.save(update_fields=["status"])

    branch_members = BranchMember.objects.filter(branch__business=business, user=user).select_related("branch")
    branch_members.update(is_active=is_active)

    if not is_active:
        Branch.objects.filter(business=business, manager=user).update(manager=None)
    else:
        for branch_member in branch_members:
            if branch_member.role == "manager" and branch_member.branch.manager_id != user.id:
                branch_member.branch.manager = user
                branch_member.branch.save(update_fields=["manager", "updated_at"])

    return "\n".join(
        [
            "Summary",
            f"{user.full_name}'s business access was {'activated' if is_active else 'deactivated'} for {business.name}.",
            f"- Business role: {business_member.role.replace('_', ' ')}",
            "Recommended next steps",
            "Review whether any branch-specific assignments should also be updated to match this status change.",
        ]
    )


def _execute_grant_access(pending_action) -> str:
    from apps.business.models import BusinessMember
    from apps.branches.models import BranchMember

    data = pending_action.action_data
    business = _get_business_for_action(data.get("business_id"), pending_action.user)
    branch = _resolve_branch_for_business(business, data.get("branch_reference"))
    _ensure_branch_manage_permission(branch, pending_action.user)
    user = _resolve_user_or_member_reference(business, data.get("member_reference"))
    role = _normalize_branch_role_value(data.get("role") or "staff")

    business_role = _branch_role_to_business_role(role)
    member, _ = BusinessMember.objects.get_or_create(
        business=business,
        user=user,
        defaults={
            "role": business_role,
            "status": BusinessMember.MemberStatus.ACTIVE,
            "invited_by": pending_action.user,
        },
    )
    if member.role != business_role or member.status != BusinessMember.MemberStatus.ACTIVE:
        member.role = business_role
        member.status = BusinessMember.MemberStatus.ACTIVE
        member.save(update_fields=["role", "status"])

    branch_member, _ = BranchMember.objects.get_or_create(
        branch=branch,
        user=user,
        defaults={"role": role, "is_active": True, "assigned_by": pending_action.user},
    )
    previous_manager = branch.manager
    branch_member.role = role
    branch_member.is_active = True
    branch_member.save(update_fields=["role", "is_active"])

    if role == "manager":
        branch.manager = user
        branch.save(update_fields=["manager", "updated_at"])

    lines = [
        "Summary",
        f"{user.full_name} now has access to {branch.name}.",
        f"- Branch role: {role}",
    ]
    if role == "manager" and previous_manager and previous_manager != user:
        lines.append(f"- Previous manager replaced: {previous_manager.full_name}")
    lines.extend(
        [
            "Recommended next steps",
            "Review whether this member also needs cashbook or reporting responsibilities.",
        ]
    )
    return "\n".join(lines)


def _execute_revoke_access(pending_action) -> str:
    from apps.business.models import BusinessMember
    from apps.branches.models import Branch, BranchMember

    data = pending_action.action_data
    business = _get_business_for_action(data.get("business_id"), pending_action.user)
    member_reference = data.get("member_reference")

    if data.get("branch_reference"):
        branch = _resolve_branch_for_business(business, data.get("branch_reference"))
        _ensure_branch_manage_permission(branch, pending_action.user)
        user = _resolve_user_or_member_reference(business, member_reference)
        branch_member = BranchMember.objects.filter(branch=branch, user=user).first()
        if not branch_member:
            raise ValueError(f"{member_reference} does not currently have access to {branch.name}.")
        if branch.manager_id == user.id:
            branch.manager = None
            branch.save(update_fields=["manager", "updated_at"])
        branch_member.delete()
        return "\n".join(
            [
                "Summary",
                f"{user.full_name} was removed from {branch.name}.",
                "Recommended next steps",
                "Review whether this member should also be removed from the business entirely.",
            ]
        )

    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    user = _resolve_user_or_member_reference(business, member_reference)
    member = BusinessMember.objects.filter(business=business, user=user).first()
    if not member:
        raise ValueError(f"{member_reference} is not an active business member.")
    if business.owner_id == user.id:
        raise ValueError("The business owner cannot be removed from the business.")

    member.delete()
    BranchMember.objects.filter(branch__business=business, user=user).delete()
    Branch.objects.filter(business=business, manager=user).update(manager=None)

    return "\n".join(
        [
            "Summary",
            f"{user.full_name} was removed from {business.name}.",
            "- Related branch memberships for this business were also cleared.",
            "Recommended next steps",
            "Review whether another member should take over any pending operational responsibilities.",
        ]
    )


def _execute_change_role(pending_action) -> str:
    from apps.business.models import BusinessMember
    from apps.branches.models import BranchMember

    data = pending_action.action_data
    business = _get_business_for_action(data.get("business_id"), pending_action.user)
    member_reference = data.get("member_reference")

    if data.get("branch_reference"):
        branch = _resolve_branch_for_business(business, data.get("branch_reference"))
        _ensure_branch_manage_permission(branch, pending_action.user)
        user = _resolve_user_or_member_reference(business, member_reference)
        branch_member = BranchMember.objects.filter(branch=branch, user=user).first()
        if not branch_member:
            raise ValueError(f"{member_reference} is not assigned to {branch.name}.")

        new_role = _normalize_branch_role_value(data.get("role") or "staff")
        branch_member.role = new_role
        branch_member.is_active = True
        branch_member.save(update_fields=["role", "is_active"])

        if new_role == "manager":
            branch.manager = user
            branch.save(update_fields=["manager", "updated_at"])
        elif branch.manager_id == user.id:
            branch.manager = None
            branch.save(update_fields=["manager", "updated_at"])

        business_member = BusinessMember.objects.filter(business=business, user=user).first()
        if business_member:
            business_member.role = _branch_role_to_business_role(new_role)
            business_member.status = BusinessMember.MemberStatus.ACTIVE
            business_member.save(update_fields=["role", "status"])

        return "\n".join(
            [
                "Summary",
                f"{user.full_name}'s role for {branch.name} was updated successfully.",
                f"- New branch role: {new_role}",
                "Recommended next steps",
                "Review whether this branch role should also affect reporting or approval responsibility.",
            ]
        )

    business = _get_business_for_owner_action(data.get("business_id"), pending_action.user)
    user = _resolve_user_or_member_reference(business, member_reference)
    business_member = BusinessMember.objects.filter(business=business, user=user).first()
    if not business_member:
        raise ValueError(f"{member_reference} is not a member of {business.name}.")

    new_role = _normalize_business_role_value(data.get("role") or "staff")
    business_member.role = new_role
    business_member.status = BusinessMember.MemberStatus.ACTIVE
    business_member.save(update_fields=["role", "status"])

    if getattr(user, "role", "") != new_role:
        user.role = new_role
        user.save(update_fields=["role", "updated_at"])

    return "\n".join(
        [
            "Summary",
            f"{user.full_name}'s business role was updated successfully.",
            f"- New business role: {new_role.replace('_', ' ')}",
            "Recommended next steps",
            "Review any branch-specific assignments that should be aligned with this role change.",
        ]
    )


def _get_business_for_action(business_id, user):
    from apps.business.models import Business, BusinessMember

    business = Business.objects.filter(pk=business_id).first()
    if not business:
        raise ValueError("Business not found.")

    if user.is_super_admin or business.owner_id == user.id:
        return business

    is_member = BusinessMember.objects.filter(
        business=business,
        user=user,
        status=BusinessMember.MemberStatus.ACTIVE,
    ).exists()
    if not is_member:
        raise ValueError("You do not have access to this business.")
    return business


def _get_business_for_owner_action(business_id, user):
    business = _get_business_for_action(business_id, user)
    if user.is_super_admin or business.owner_id == user.id:
        return business
    raise ValueError("Only the business owner can perform this action.")


def _ensure_branch_manage_permission(branch, user):
    from apps.branches.models import BranchMember

    allowed = (
        user.is_super_admin
        or branch.business.owner_id == user.id
        or branch.manager_id == user.id
        or BranchMember.objects.filter(branch=branch, user=user, role=BranchMember.MemberRole.MANAGER, is_active=True).exists()
    )
    if not allowed:
        raise ValueError("You do not have permission to manage this branch.")


def _resolve_optional_branch(business, branch_reference):
    if not branch_reference:
        return None
    return _resolve_branch_for_business(business, branch_reference)


def _resolve_branch_for_business(business, branch_reference):
    from django.db.models import Q
    from apps.branches.models import Branch

    reference = _normalize_reference(branch_reference)
    if not reference:
        raise ValueError("Branch name is required.")

    queryset = Branch.objects.filter(business=business, is_active=True)
    exact = queryset.filter(
        Q(name__iexact=reference) |
        Q(code__iexact=reference) |
        Q(locality__iexact=reference)
    )
    if exact.count() == 1:
        return exact.first()

    contains = queryset.filter(
        Q(name__icontains=reference) |
        Q(code__icontains=reference) |
        Q(locality__icontains=reference) |
        Q(city__icontains=reference)
    )
    if contains.count() == 1:
        return contains.first()
    if contains.count() > 1:
        matches = ", ".join(branch.name for branch in contains[:5])
        raise ValueError(f"Multiple branches matched {branch_reference}: {matches}. Please be more specific.")
    raise ValueError(f"No active branch matched {branch_reference}.")


def _resolve_user_by_reference(reference):
    from apps.users.models import User

    if not reference:
        return None
    ref = str(reference).strip()
    if "@" in ref:
        return User.objects.filter(email__iexact=ref).first()
    return User.objects.filter(full_name__iexact=ref).first()


def _resolve_user_or_member_reference(business, reference):
    from apps.business.models import BusinessMember
    from apps.users.models import User

    ref = str(reference or "").strip()
    if not ref:
        raise ValueError("A member reference is required.")

    if "@" in ref:
        user = User.objects.filter(email__iexact=ref).first()
        if not user:
            raise ValueError(f"No user was found for {ref}.")
        return user

    member_matches = BusinessMember.objects.filter(
        business=business,
        user__full_name__iexact=ref,
    ).select_related("user")
    if member_matches.count() == 1:
        return member_matches.first().user
    if member_matches.count() > 1:
        raise ValueError(f"Multiple members matched {ref}. Please use the member email instead.")

    user = User.objects.filter(full_name__iexact=ref).first()
    if user:
        return user
    raise ValueError(f"No member or user matched {ref}.")


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _normalize_reference(value: str) -> str:
    ref = _normalize_text(value)
    ref = re.sub(r"\bbranch\b", "", ref, flags=re.IGNORECASE)
    return _normalize_text(ref.strip(" .,-"))


def _extract_generic_email(message: str) -> str:
    match = EMAIL_RE.search(str(message or ""))
    return match.group(1).lower() if match else ""


def _extract_phone(message: str) -> str:
    match = PHONE_RE.search(str(message or ""))
    return match.group(1) if match else ""


def _extract_manager_email(message: str) -> str:
    text = str(message or "")
    match = re.search(
        r"(?:manager|assign manager|with manager)\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).lower()
    return ""


def _extract_location_field(message: str, field_name: str) -> str:
    match = re.search(
        rf"\b{re.escape(field_name)}\s+([A-Za-z][A-Za-z .-]*?)(?=\s+(?:manager|email|phone|state|country|code|type)\b|$)",
        str(message or ""),
        re.IGNORECASE,
    )
    if not match:
        return ""
    candidate = _clean_entity(match.group(1))
    if candidate.lower().startswith("to "):
        candidate = candidate[3:].strip()
    return candidate


def _extract_create_branch_city(message: str) -> str:
    match = re.search(
        r"\bin\s+([A-Za-z][A-Za-z .-]*?)(?=\s+(?:manager|email|phone|locality|state|country|code|type)\b|$)",
        str(message or ""),
        re.IGNORECASE,
    )
    return _clean_entity(match.group(1)) if match else ""


def _extract_create_branch_name(message: str) -> str:
    text = str(message or "")
    quoted = _extract_quoted_text(text)
    if quoted:
        return quoted

    patterns = [
        r"(?:create|add|open|set\s*up|setup)\s+(?:new\s+)?branch(?:\s+named)?\s+(.+?)(?=\s+(?:in|manager|email|phone|locality|city|state|country|code|type)\b|$)",
        r"(?:new\s+branch)\s+(.+?)(?=\s+(?:in|manager|email|phone|locality|city|state|country|code|type)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = _clean_entity(match.group(1))
            if candidate and candidate.lower() not in {"in", "manager", "city"}:
                return candidate
    return ""


def _extract_branch_reference(message: str) -> str:
    text = str(message or "")
    quoted = _extract_quoted_text(text)
    if quoted and "branch" in text.lower():
        return quoted

    patterns = [
        r"(?:for|in|at|from)\s+(.+?)\s+branch\b",
        r"(?:rename|update|edit|change|delete|remove|deactivate|close|open)\s+(?:the\s+)?(.+?)\s+branch\b",
        r"branch(?:\s+named)?\s+(.+?)(?=\s+(?:as|for|to|in|at|with|manager|email|phone|role|permission|access)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = _clean_entity(match.group(1))
            if candidate and candidate.lower() not in {
                "name",
                "details",
                "branch",
                "city",
                "locality",
                "state",
                "country",
                "email",
                "phone",
                "type",
                "manager",
            }:
                return candidate
    return ""


def _extract_delete_branch_reference(message: str) -> str:
    text = str(message or "")
    quoted = _extract_quoted_text(text)
    if quoted:
        return quoted

    patterns = [
        r"(?:delete|remove|deactivate|close)\s+(?:the\s+)?branch(?:\s+named)?\s+(.+?)(?=\s+(?:in|at|with|manager|email|phone|role)\b|$)",
        r"(?:delete|remove|deactivate|close)\s+(?:the\s+)?(.+?)\s+branch\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = _clean_entity(match.group(1))
            if candidate and candidate.lower() not in {
                "name",
                "details",
                "branch",
                "city",
                "locality",
                "state",
                "country",
                "email",
                "phone",
                "type",
                "manager",
            }:
                return candidate
    return ""


def _extract_update_branch_name(message: str) -> str:
    text = str(message or "")
    msg_lower = text.lower()
    if not any(
        phrase in msg_lower
        for phrase in (
            "rename",
            "change branch name",
            "change name",
            "update branch name",
            "update name",
            "set branch name",
            "set name",
        )
    ):
        return ""

    match = re.search(
        r"\bto\s+([A-Za-z][A-Za-z0-9 &'.-]*?)(?=\s+(?:and|then|in|at|for|with|manager|email|phone|city|locality|state|country|type|address)\b|$)",
        text,
        re.IGNORECASE,
    )
    if match:
        candidate = _clean_entity(match.group(1))
        if candidate:
            return candidate

    quoted = _extract_quoted_text(text)
    return quoted or ""


def _extract_branch_update_fields(message: str) -> dict:
    text = str(message or "")
    msg_lower = text.lower()
    updates = {}

    new_name = _extract_update_branch_name(text)
    if new_name:
        updates["name"] = new_name

    for field_name in ("city", "locality", "state", "country", "email", "phone", "address line1", "address line2"):
        value = _extract_location_field(text, field_name)
        if value:
            updates[field_name.replace(" ", "_")] = value

    branch_type = _detect_branch_type(msg_lower)
    if branch_type != "branch" and any(word in msg_lower for word in ("head office", "warehouse", "outlet", "franchise", "type")):
        updates["branch_type"] = branch_type

    manager_email = _extract_manager_email(text)
    if manager_email:
        updates["manager_email"] = manager_email

    return updates


def _extract_toggle_member_status(message: str) -> str:
    msg_lower = str(message or "").lower()
    if any(
        word in msg_lower
        for word in (
            "deactivate",
            "disable",
            "suspend",
            "pause access",
            "remove access",
            "turn off",
            "inactive",
        )
    ):
        return "inactive"
    if any(
        word in msg_lower
        for word in (
            "activate",
            "enable",
            "reinstate",
            "resume access",
            "reactivate",
            "unsuspend",
            "active",
        )
    ):
        return "active"
    return ""


def _extract_member_reference(message: str) -> str:
    email = _extract_generic_email(message)
    if email:
        return email

    quoted = _extract_quoted_text(message)
    if quoted:
        return quoted

    patterns = [
        r"(?:make|promote|remove|grant access to|give access to|revoke access from|change role of|set role for|activate|deactivate|enable|disable|suspend|reinstate|reactivate|resume)\s+(.+?)(?=\s+(?:as|to|for|from|in|at)\b|$)",
        r"(?:member|staff|employee|user)\s+(.+?)(?=\s+(?:as|to|for|from|in|at)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, str(message or ""), re.IGNORECASE)
        if match:
            candidate = _clean_entity(match.group(1))
            if candidate:
                return candidate
    return ""


def _extract_member_name(message: str, email: str = "") -> str:
    text = str(message or "")
    quoted = _extract_quoted_text(text)
    if quoted:
        return quoted

    if email:
        escaped_email = re.escape(email)
        patterns = [
            rf"(?:create|add|invite|onboard)\s+(?:new\s+)?(?:staff|member|employee|team member|accountant|manager|ca)\s+(.+?)\s+{escaped_email}",
            rf"(?:staff|member|employee|team member|accountant|manager|ca)\s+(.+?)\s+{escaped_email}",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = _clean_entity(match.group(1))
                if candidate and "@" not in candidate:
                    return candidate
    return ""


def _extract_quoted_text(text: str) -> str:
    match = re.search(r'"([^"]+)"|\'([^\']+)\'', str(text or ""))
    if not match:
        return ""
    return _clean_entity(match.group(1) or match.group(2))


def _detect_branch_type(msg_lower: str) -> str:
    if "head office" in msg_lower:
        return "head_office"
    if "warehouse" in msg_lower:
        return "warehouse"
    if "outlet" in msg_lower:
        return "outlet"
    if "franchise" in msg_lower:
        return "franchise"
    return "branch"


def _detect_business_role(msg_lower: str) -> str:
    if "business owner" in msg_lower or "owner" in msg_lower or "partner" in msg_lower:
        return "business_owner"
    if "branch manager" in msg_lower or "manager" in msg_lower:
        return "branch_manager"
    if "accountant" in msg_lower or "accounts" in msg_lower:
        return "accountant"
    if re.search(r"\bca\b", msg_lower) or "consultant" in msg_lower:
        return "ca"
    return "staff"


def _detect_branch_role(msg_lower: str) -> str:
    if "branch manager" in msg_lower or "manager" in msg_lower:
        return "manager"
    if "accountant" in msg_lower or "accounts" in msg_lower:
        return "accountant"
    if re.search(r"\bca\b", msg_lower) or "consultant" in msg_lower:
        return "ca"
    return "staff"


def _normalize_business_role_value(role: str) -> str:
    role_value = str(role or "").strip().lower().replace(" ", "_")
    if role_value in {"owner", "partner", "co_owner"}:
        return "business_owner"
    if role_value in {"manager", "branch_manager"}:
        return "branch_manager"
    if role_value in {"accountant", "accounts"}:
        return "accountant"
    if role_value in {"ca", "consultant"}:
        return "ca"
    return "staff"


def _normalize_branch_role_value(role: str) -> str:
    role_value = str(role or "").strip().lower().replace(" ", "_")
    if role_value in {"branch_manager", "manager"}:
        return "manager"
    if role_value in {"accountant", "accounts"}:
        return "accountant"
    if role_value in {"ca", "consultant"}:
        return "ca"
    return "staff"


def _business_role_to_branch_role(role: str) -> str:
    return _normalize_branch_role_value(role)


def _branch_role_to_business_role(role: str) -> str:
    role_value = _normalize_branch_role_value(role)
    if role_value == "manager":
        return "branch_manager"
    return role_value


def _clean_entity(value: str) -> str:
    cleaned = _normalize_text(value)
    cleaned = re.sub(r"\b(branch|member|staff|employee|user)\b$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.strip(" .,-")
    if not cleaned:
        return ""
    return " ".join(part.capitalize() if not part.isupper() else part for part in cleaned.split())


def _name_from_email(email: str) -> str:
    local_part = str(email or "").split("@", 1)[0]
    local_part = re.sub(r"[._-]+", " ", local_part)
    return " ".join(word.capitalize() for word in local_part.split() if word) or "Team Member"


def _clarification_response(action_label: str, missing_label: str, example: str) -> dict:
    return {
        "mode": "clarify",
        "clarification_message": "\n".join(
            [
                "Summary",
                f"I can {action_label}, but I still need {missing_label}.",
                "Recommended next steps",
                example,
            ]
        ),
    }
