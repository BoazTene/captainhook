from pydantic import BaseModel

class GenericResponse(BaseModel):
    """
    A generic response model for API endpoints.
    """
    message: str