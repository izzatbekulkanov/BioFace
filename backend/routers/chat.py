from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from typing import List, Optional

from database import get_db
from models import User, ChatMessage, Organization, UserRole

router = APIRouter()

ONLINE_USERS = {}  # {user_id: last_active_timestamp}



class SendMessageRequest(BaseModel):
    receiver_id: int
    message: str


def get_current_user(request: Request, db: Session) -> User:
    auth_user = request.session.get("auth_user")
    if not auth_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.id == auth_user["id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    import time
    ONLINE_USERS[user.id] = time.time()
    return user


@router.get("/api/chat/contacts")
def list_chat_contacts(request: Request, db: Session = Depends(get_db)):
    current_user = get_current_user(request, db)

    # 1. Fetch potential contacts based on roles
    if current_user.role == UserRole.super_admin.value:
        # SuperAdmin can chat with any active user in the system
        contacts_query = db.query(User).filter(
            User.id != current_user.id,
            User.status == "active",
            User.is_staff == True
        )
    else:
        # Regular user can chat with same-organization users + all superadmins
        contacts_query = db.query(User).filter(
            User.id != current_user.id,
            User.status == "active",
            User.is_staff == True,
            or_(
                User.organization_id == current_user.organization_id,
                User.role == UserRole.super_admin.value
            )
        )

    contacts = contacts_query.all()
    results = []

    for contact in contacts:
        # Get unread message count from this contact
        unread_count = db.query(ChatMessage).filter(
            ChatMessage.sender_id == contact.id,
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False
        ).count()

        # Get last message
        last_msg = db.query(ChatMessage).filter(
            or_(
                and_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == contact.id),
                and_(ChatMessage.sender_id == contact.id, ChatMessage.receiver_id == current_user.id)
            )
        ).order_by(desc(ChatMessage.created_at)).first()

        import time
        last_active = ONLINE_USERS.get(contact.id, 0)
        is_online = (time.time() - last_active) < 30.0

        results.append({
            "id": contact.id,
            "name": contact.name,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "middle_name": contact.middle_name,
            "email": contact.email,
            "phone": contact.phone,
            "role": str(contact.role or "User"),
            "organization_name": contact.organization.name if contact.organization else "Tashkilotsiz",
            "unread_count": unread_count,
            "is_online": is_online,
            "last_message": {
                "message": last_msg.message if last_msg else None,
                "created_at": last_msg.created_at.isoformat() if last_msg and last_msg.created_at else None,
                "sender_id": last_msg.sender_id if last_msg else None
            }
        })

    # Sort contacts: contacts with messages first (most recent first), then alphabetical
    def sort_key(item):
        has_msg = item["last_message"]["created_at"] is not None
        ts = item["last_message"]["created_at"] or ""
        return (not has_msg, ts, item["name"])

    # Sort descending by timestamp for those that have messages
    results.sort(key=lambda x: (x["last_message"]["created_at"] or ""), reverse=True)
    
    # Keep alphabetical for those without messages at the end
    no_msg_contacts = [c for c in results if c["last_message"]["created_at"] is None]
    no_msg_contacts.sort(key=lambda x: x["name"])
    
    msg_contacts = [c for c in results if c["last_message"]["created_at"] is not None]
    
    return msg_contacts + no_msg_contacts


@router.get("/api/chat/messages")
def get_chat_history(
    contact_id: int, 
    request: Request, 
    limit: int = 30, 
    before_id: Optional[int] = None, 
    after_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    current_user = get_current_user(request, db)

    # 1. Check if contact exists
    contact = db.query(User).filter(User.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # 2. Check permission to chat
    is_allowed = (
        current_user.role == UserRole.super_admin.value or
        contact.role == UserRole.super_admin.value or
        current_user.organization_id == contact.organization_id
    )
    if not is_allowed:
        raise HTTPException(status_code=403, detail="You do not have permission to chat with this user")

    # 3. Mark incoming messages from this contact as read
    unread = db.query(ChatMessage).filter(
        ChatMessage.sender_id == contact_id,
        ChatMessage.receiver_id == current_user.id,
        ChatMessage.is_read == False
    ).all()
    for m in unread:
        m.is_read = True
    db.commit()

    # 4. Fetch history
    query = db.query(ChatMessage).filter(
        or_(
            and_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == contact_id),
            and_(ChatMessage.sender_id == contact_id, ChatMessage.receiver_id == current_user.id)
        )
    )

    if before_id is not None:
        query = query.filter(ChatMessage.id < before_id)

    if after_id is not None:
        query = query.filter(ChatMessage.id > after_id)
        # Fetching new messages, order asc
        messages = query.order_by(ChatMessage.id.asc()).all()
    else:
        # Fetching older messages or initial load, order desc, limit, then reverse
        messages = query.order_by(desc(ChatMessage.id)).limit(limit).all()
        messages = list(reversed(messages))

    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "message": m.message,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "is_read": m.is_read
        }
        for m in messages
    ]


@router.post("/api/chat/messages")
def send_chat_message(req: SendMessageRequest, request: Request, db: Session = Depends(get_db)):
    current_user = get_current_user(request, db)

    # 1. Check if receiver exists
    receiver = db.query(User).filter(User.id == req.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # 2. Check permission to send message
    is_allowed = (
        current_user.role == UserRole.super_admin.value or
        receiver.role == UserRole.super_admin.value or
        current_user.organization_id == receiver.organization_id
    )
    if not is_allowed:
        raise HTTPException(status_code=403, detail="You do not have permission to message this user")

    # 3. Create and save message
    msg = ChatMessage(
        sender_id=current_user.id,
        receiver_id=req.receiver_id,
        message=req.message.strip()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "message": msg.message,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "is_read": msg.is_read
    }


@router.get("/api/chat/unread-count")
def get_total_unread_count(request: Request, db: Session = Depends(get_db)):
    current_user = get_current_user(request, db)
    count = db.query(ChatMessage).filter(
        ChatMessage.receiver_id == current_user.id,
        ChatMessage.is_read == False
    ).count()
    return {"unread_count": count}
