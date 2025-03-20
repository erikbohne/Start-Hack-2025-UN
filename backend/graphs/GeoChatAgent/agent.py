from langgraph.graph import START, END, StateGraph
from typing import List, Dict, Any, AsyncGenerator
from langchain_core.messages import HumanMessage, AIMessage
from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.nodes import route_user_message, chat_agent, instructions, create_instructions

workflow = StateGraph(GraphState)

workflow.add_node("chat_agent", chat_agent)
workflow.add_node("create_instructions", create_instructions)
workflow.add_node("instructions", instructions)

workflow.add_edge("chat_agent", END)
workflow.add_edge("create_instructions", "instructions")
workflow.add_edge("instructions", "chat_agent")

workflow.add_conditional_edges(START, route_user_message)

graph = workflow.compile()

async def stream_geo_chat(messages: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
    formatted_messages = []
    for message in messages:
        if message["sender"] == "human":
            formatted_messages.append(HumanMessage(content=message["content"]))
        else:
            formatted_messages.append(AIMessage(content=message["content"]))

    async for response in graph.astream_events(
        {"messages": formatted_messages}, version="v2", include_tags="answer"
    ):
        data = response.get("data", {})
        chunk_obj = data.get("chunk")
        if chunk_obj and chunk_obj.content != "":
            yield chunk_obj.content
