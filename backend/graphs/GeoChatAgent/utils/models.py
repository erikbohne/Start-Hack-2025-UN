from pydantic import BaseModel, Field
from enum import Enum


class MapBoxActions(Enum):
    SET_GEOJSON = "SET_GEOJSON"
    SET_CENTER = "SET_CENTER"
    SET_ZOOM = "SET_ZOOM"
    ANALYZE_DATA = "ANALYZE_DATA"
    NONE = "NONE"


class MapBoxActionList(BaseModel):
    actions: list[MapBoxActions] = Field(
        default_factory=list,
        description="List of actions to be performed on the mapbox in the frontend, always zoom to a country after setting the geojson. Never fly to and zoom as two separate actions",
    )


class MapBoxInstruction(BaseModel):
    action: MapBoxActions = Field(
        default=MapBoxActions.NONE,
        description="Action to be performed on the mapbox in the frontend",
    )
    data: dict = Field(default_factory={})


class GeoChatResponse(BaseModel):
    ai_message: str = Field(description="Response from the AI model")
    mapbox_instruction: MapBoxInstruction = Field(
        default_factory=MapBoxInstruction,
        description="Instruction to be performed on the mapbox in the frontend",
    )


class AvailableSteps(Enum):
    CHAT_AGENT = "CHAT_AGENT"
    MAPBOX_INSTRUCTIONS = "MAPBOX_INSTRUCTIONS"
    DATA_ANALYSIS = "DATA_ANALYSIS"
    CREATE_GIF_FOR_TIMELINE = "CREATE_GIF_FOR_TIMELINE"


class RouteUserMessage(BaseModel):
    route: AvailableSteps = Field(description="Route to the next step")
