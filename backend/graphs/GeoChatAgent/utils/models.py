from pydantic import BaseModel, Field
from enum import Enum


class MapBoxActions(Enum):
    SET_GEOJSON = "SET_GEOJSON"
    SET_CENTER = "SET_CENTER"
    SET_ZOOM = "SET_ZOOM"
    ANALYZE_DATA = "ANALYZE_DATA"
    DISPLAY_TIMELINE = "DISPLAY_TIMELINE"
    CHAT_MESSAGE_WITH_MEDIA = "CHAT_MESSAGE_WITH_MEDIA"
    NONE = "NONE"


class MapBoxActionList(BaseModel):
    actions: list[MapBoxActions] = Field(default_factory=list, description="List of actions to be performed on the mapbox in the frontend, always zoom to a country after setting the geojson. Never fly to and zoom as two separate actions")


class MapBoxInstruction(BaseModel):
    action: MapBoxActions = Field(default=MapBoxActions.NONE, description="Action to be performed on the mapbox in the frontend") 
    data: dict = Field(default_factory={})


class GeoChatResponse(BaseModel):
    ai_message: str = Field(description="Response from the AI model")
    mapbox_instruction: MapBoxInstruction = Field(default_factory=MapBoxInstruction, description="Instruction to be performed on the mapbox in the frontend")


class AvailableSteps(Enum):
    CHAT_AGENT = "CHAT_AGENT"
    MAPBOX_INSTRUCTIONS = "MAPBOX_INSTRUCTIONS"
    DATA_ANALYSIS = "DATA_ANALYSIS"
    CREATE_GIF_FOR_TIMELINE = "CREATE_GIF_FOR_TIMELINE"


class TimelineParameters(BaseModel):
    dataset: str = Field(
        description="Dataset to create timeline animation for (PopDensity or Precipitation)",
        default="PopDensity"
    )
    country: str = Field(
        description="Country to create timeline animation for (Mali, Chad, Niger, Burkina_Faso, Mauritania, Senegal, Sudan)",
        default="Mali"
    )
    start_year: int = Field(
        description="Start year for the timeline (between 2010 and 2020)",
        default=2015
    )
    end_year: int = Field(
        description="End year for the timeline (between 2010 and 2020)",
        default=2020
    )
    frame_delay: int = Field(
        default=500, 
        description="Delay between frames in milliseconds"
    )


class MediaContent(BaseModel):
    type: str = Field(description="Type of media (image, gif, video, etc.)")
    data: str = Field(description="Base64-encoded media data")
    alt_text: str = Field(description="Alternative text description of the media")
    title: str = Field(default="", description="Optional title for the media")
    metadata: dict = Field(default_factory=dict, description="Additional metadata about the media")


class ChatMessageWithMedia(BaseModel):
    text: str = Field(description="Text content of the message")
    media: MediaContent = Field(description="Media content to include with the message")
    

class RouteUserMessage(BaseModel):
    route: AvailableSteps = Field(description="Route to the next step")
