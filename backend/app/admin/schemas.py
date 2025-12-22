from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AgentApprovalRequest(BaseModel):
    agent_id: int


class AgentRejectionRequest(BaseModel):
    agent_id: int
    reason: str


class PropertyApprovalRequest(BaseModel):
    property_id: int


class PropertyRejectionRequest(BaseModel):
    property_id: int
    reason: str


class UserSuspensionRequest(BaseModel):
    user_id: int
    reason: str


class ActivityLogDisplay(BaseModel):
    id: int
    user_id: Optional[int]
    admin_id: Optional[int]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_users: int
    total_properties: int
    total_agents: int
    pending_approvals: int
    pending_agents: int
    pending_properties: int
    approved_agents: int
    approved_properties: int
    users: dict
    properties: dict
    
    class Config:
        from_attributes = True