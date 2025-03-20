from langgraph.graph import START, END, StateGraph
from typing import List, Dict, Any, AsyncGenerator
from langchain_core.messages import HumanMessage, AIMessage
from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.nodes import route_user_message, chat_agent, instructions, create_instructions
import json

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
    print("Starting stream_geo_chat with messages:", [m.get("content", "") for m in messages])
    formatted_messages = []
    for message in messages:
        if message["sender"] == "human":
            formatted_messages.append(HumanMessage(content=message["content"]))
        else:
            formatted_messages.append(AIMessage(content=message["content"]))

    print("Launching graph execution")
    chunk_count = 0
    instruction_count = 0
    
    async for response in graph.astream_events(
        {"messages": formatted_messages}, version="v2", include_tags="answer"
    ):
        data = response.get("data", {})
        chunk_obj = data.get("chunk")
        
        # Handle regular message chunks
        if chunk_obj and chunk_obj.content != "":
            chunk_count += 1
            print(f"Yielding text chunk #{chunk_count}: {chunk_obj.content[:30]}...")
            yield chunk_obj.content
        
        # Handle map instructions if present
        frontend_actions = data.get("frontend_actions", [])
        if frontend_actions:
            for action in frontend_actions:
                instruction_count += 1
                # Format the instruction as JSON for the frontend
                instruction = {
                    "type": "instruction",
                    "action": action.action.value,
                    "data": action.data
                }
                
                instruction_json = json.dumps(instruction)
                print(f"Yielding instruction #{instruction_count}: {instruction_json}")
                
                # Yield the instruction as a JSON string prefixed with INSTRUCTION:
                # This marker helps the frontend identify instructions vs regular text
                yield f"INSTRUCTION:{instruction_json}"
                print(f"Instruction yielded")
    
    print(f"Stream complete: {chunk_count} text chunks, {instruction_count} instructions")