from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.models import AvailableSteps, RouteUserMessage
from langchain_core.messages import SystemMessage
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


def route_user_message(state: GraphState) -> Literal["chat_agent", "instructions"]:
    """Routes to the chat_agent node or the instructions node."""
    next = llm.with_structured_output(RouteUserMessage).invoke(state["messages"])
    if next.route == AvailableSteps.CHAT_AGENT:
        return "chat_agent"
    elif next.route == AvailableSteps.MAPBOX_INSTRUCTIONS:
        return "instructions"


def chat_agent(state: GraphState):
    system_message = SystemMessage(
        content=""""
        You are a ...
        """,
    )
    return {"messages": llm.with_config(tags=["answer"]).invoke([system_message] + state["messages"])}


def instructions(state: GraphState):
    system_message = SystemMessage(
        content=""""
        Here are the instructions...
        """,
    )
    return {"messages": llm.with_config(tags=["answer"]).invoke([system_message] + state["messages"])}
