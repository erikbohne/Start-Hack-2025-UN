from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.models import AvailableSteps, RouteUserMessage, MapBoxActionList, MapBoxActions, MapBoxInstruction
from langchain_core.messages import SystemMessage, AIMessage
from langchain_groq import ChatGroq
from typing import Literal
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize the LLM (defined at top level as recommended)
llm = ChatGroq(
    model_name="llama3-70b-8192",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0,
)


def route_user_message(state: GraphState) -> Literal["chat_agent", "create_instructions"]:
    """Routes to the chat_agent node or the instructions node."""
    next = llm.with_structured_output(RouteUserMessage).invoke(state["messages"])
    if next.route == AvailableSteps.CHAT_AGENT:
        return "chat_agent"
    elif next.route == AvailableSteps.MAPBOX_INSTRUCTIONS:
        return "create_instructions"


def create_instructions(state: GraphState):
    system_prompt = SystemMessage(
        content=""""
        You are going to create a list of the instructions we will do to Mapbox.
        If the task is to Zoom into the Eiffel Tower, you would write:
        [MapBoxActionList.SET_CENTER, MapBoxActionList.SET_ZOOM]
        """,
    )

    instructions = llm.with_structured_output(MapBoxActionList).invoke([system_prompt] + state["messages"])
    return {"instructions_list": instructions.actions}


def chat_agent(state: GraphState):
    system_message = SystemMessage(
        content=""""
        You are a ...
        """,
    )
    return {"messages": llm.with_config(tags=["answer"]).invoke([system_message] + state["messages"])}


def instructions(state: GraphState):
    """Exectutes the next instruction in the list."""

    if not state.get("frontend_actions"):
        state["frontend_actions"] = []

    next_action = state["instructions_list"].pop(0)
    if next_action == MapBoxActions.SET_CENTER:
        system_message = SystemMessage(
            content=""""
            You are going to set the center of the map to the coordinates of the wanted location.
            """,
        )
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)
        state["messages"] = [AIMessage(content=f"Succesfully set the center of the map")]

    elif next_action == MapBoxActions.SET_ZOOM:
        system_message = SystemMessage(
            content=""""
            You are going to set the zoom of the map.
            """,
        )
        # TODO: Get a structured output that sends to the frontend to set the zoom of the map

    return state


def is_more_instructions(state: GraphState) -> Literal["chat_agent", "instructions"]:
    """Returns 'instructions' if there are more instructions or 'chat_agent' if there are no more instructions."""
    if state["instructions_list"]:
        return "instructions"
    return "chat_agent"
