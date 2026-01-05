from pydantic import BaseModel, ConfigDict

# Schema for User Registration (Input from Frontend)
class UserCreate(BaseModel):
    full_name: str
    company_name: str
    email: str
    password: str

# Schema for User Response (Output to Frontend)
class UserResponse(BaseModel):
    id: int
    full_name: str
    company_name: str
    email: str
    
    # ✅ Pydantic V2 ka sahi tarika:
    model_config = ConfigDict(from_attributes=True)