from langgraph.graph import START, END, StateGraph
from typing import List, Dict, Any, AsyncGenerator
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.nodes import route_user_message, chat_agent, instructions, create_instructions
from graphs.GeoChatAgent.utils.models import MapBoxInstruction
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

async def stream_geo_chat(messages: List[Dict[str, Any]], mapState: Dict[str, Any] = None) -> AsyncGenerator[str, None]:
    print("Starting stream_geo_chat with messages:", [m.get("content", "") for m in messages])
    print("Map state:", mapState)
    
    formatted_messages = []
    for message in messages:
        if message["sender"] == "human":
            formatted_messages.append(HumanMessage(content=message["content"]))
        else:
            formatted_messages.append(AIMessage(content=message["content"]))

    # If we have map state, use it to enhance the first message instead of adding a new system message
    if mapState:
        # Create a formatted description of the map state
        map_state_description = "Current map state:\n"
        
        if "is3DMode" in mapState:
            map_state_description += f"- View mode: {'3D' if mapState['is3DMode'] else '2D'}\n"
        
        if "displayYear" in mapState and mapState["displayYear"]:
            map_state_description += f"- Currently displaying year: {mapState['displayYear']}\n"
        
        if "yearSequence" in mapState and mapState["yearSequence"]:
            map_state_description += f"- Available years: {', '.join(map(str, mapState['yearSequence']))}\n"
        
        if "activeDatasets" in mapState and mapState["activeDatasets"]:
            datasets = set([d.get('dataset') for d in mapState["activeDatasets"]])
            countries = set([d.get('country') for d in mapState["activeDatasets"]])
            
            map_state_description += f"- Active datasets: {', '.join(datasets)}\n"
            map_state_description += f"- Countries shown: {', '.join(countries)}\n"
        
        if "thresholdValues" in mapState:
            thresholds = [f"{key}: {value}" for key, value in mapState["thresholdValues"].items()]
            if thresholds:
                map_state_description += f"- Threshold values: {', '.join(thresholds)}\n"
        
        if "animating" in mapState:
            map_state_description += f"- Animation: {'playing' if mapState['animating'] else 'paused'}\n"
        
        # Store the map context information in the graph state
        # We'll use this in the node functions directly

    print("Launching graph execution")
    chunk_count = 0
    instruction_count = 0
    
    # Prepare the initial state with map context if available
    initial_state = {
        "messages": formatted_messages,
        "map_context": map_state_description if mapState else None
    }
    
    # Track if we've already processed instructions from the current state
    processed_states = set()
    
    async for response in graph.astream_events(
        initial_state, version="v2"
    ):
        # Get the full state to check for frontend actions
        state = response.get("state", {})
        state_id = id(state)  # Use object id to track if we've seen this state
        
        data = response.get("data", {})

        if isinstance(data.get("output"), MapBoxInstruction):
            instruction_count += 1
            instruction = {
                "type": "instruction",
                "action": data.get("output").action.value,
                "data": data.get("output").data
            }
            instruction_json = json.dumps(instruction)
            yield f"INSTRUCTION:{instruction_json}"
            continue

        # Handle map instructions from state if we haven't processed them yet
        if state_id not in processed_states and "frontend_actions" in state and state["frontend_actions"]:
            frontend_actions = state["frontend_actions"]
            processed_states.add(state_id)
            
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
        
        data = response.get("data", {})
        chunk_obj = data.get("chunk")
        
        # Handle regular message chunks
        try:
            if chunk_obj and hasattr(chunk_obj, 'content') and chunk_obj.content != "":
                chunk_count += 1
                print(f"Yielding text chunk #{chunk_count}: {chunk_obj.content[:30]}...")
                yield chunk_obj.content
        except Exception as e:
            print(f"Error yielding text chunk: {e}")
    
    print(f"Stream complete: {chunk_count} text chunks, {instruction_count} instructions")