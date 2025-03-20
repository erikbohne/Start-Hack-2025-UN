from graphs.GeoChatAgent.utils.models import MapBoxActionList, MapBoxInstruction
from typing import Annotated, Sequence, TypedDict, List
from langchain_core.messages import BaseMessage
from langgraph.graph import add_messages


class GraphState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages] = []
    instructions_list: List[MapBoxActionList] = []
    frontend_actions: List[MapBoxInstruction] = []
