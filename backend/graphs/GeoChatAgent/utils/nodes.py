from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.models import AvailableSteps, RouteUserMessage, MapBoxActionList, MapBoxActions, MapBoxInstruction
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage
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
    system_message = SystemMessage(
        content="""Determine whether the user's message requires map interaction.
        
        Examples that require map interaction:
        - "Show me Paris on the map"
        - "Center the map on New York"
        - "Zoom in to Tokyo"
        - "Show me data for Burkina Faso"
        - "Focus on Africa"
        
        Choose MAPBOX_INSTRUCTIONS if any map manipulation is needed. Otherwise choose CHAT_AGENT.
        """
    )
    
    messages = [system_message] + state["messages"]
    next = llm.with_structured_output(RouteUserMessage).invoke(messages)
    
    print(f"Routing decision: {next.route}")
    
    if next.route == AvailableSteps.CHAT_AGENT:
        return "chat_agent"
    elif next.route == AvailableSteps.MAPBOX_INSTRUCTIONS:
        return "create_instructions"


def create_instructions(state: GraphState):
    system_prompt = SystemMessage(
        content="""You are going to create a list of the instructions we will do to Mapbox.
        
        AVAILABLE MAP ACTIONS:
        - SET_CENTER: Move the map to center on a location
        - SET_ZOOM: Change the zoom level of the map
        - SET_GEOJSON: Add GeoJSON data to the map
        
        Examples:
        1. If the task is to "Show me Paris", you would return:
           [MapBoxActions.SET_CENTER]
        
        2. If the task is to "Zoom into the Eiffel Tower", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_ZOOM]
        
        3. If the task is to "Show population data for Burkina Faso", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_GEOJSON]
        
        Convert the user's request into a sequence of map actions.
        """
    )

    instructions = llm.with_structured_output(MapBoxActionList).invoke([system_prompt] + state["messages"])
    print(f"Created instructions: {instructions.actions}")
    return {"instructions_list": instructions.actions}


def chat_agent(state: GraphState):
    system_message = SystemMessage(
        content="""You are a helpful Geography assistant specializing in climate and population data from the UN.
        You can answer questions about population density, precipitation, and other geographical data for African countries.
        
        When the user asks about viewing locations or data on the map, make sure to answer them clearly and helpfully.
        
        Keep answers concise and focused on the user's question.
        """
    )
    return {"messages": llm.with_config(tags=["answer"]).invoke([system_message] + state["messages"])}


def instructions(state: GraphState):
    """Executes the next instruction in the list."""

    if not state.get("frontend_actions"):
        state["frontend_actions"] = []

    next_action = state["instructions_list"].pop(0)
    
    # Get the user's original question
    user_message = state["messages"][-1].content.lower() if state["messages"] else ""
    print(f"User message: {user_message}")
    
    if next_action == MapBoxActions.SET_CENTER:
        # Use LLM to generate map center instruction
        system_message = SystemMessage(
            content="""You are going to set the center of the map based on the user's query.
            You MUST return coordinates in the format [longitude, latitude].
            
            Common city coordinates:
            - Paris: [2.3522, 48.8566]
            - London: [-0.1278, 51.5074]
            - New York: [-74.0060, 40.7128]
            - Tokyo: [139.6917, 35.6895]
            - Berlin: [13.4050, 52.5200]
            - Rome: [12.4964, 41.9028]
            - Madrid: [-3.7038, 40.4168]  # Fixed coordinates (was incorrect)
            - Cairo: [31.2357, 30.0444]
            - Sydney: [151.2093, -33.8688]
            - Rio de Janeiro: [-43.1729, -22.9068]
            - Moscow: [37.6173, 55.7558]
            - Mumbai: [72.8777, 19.0760]
            - Beijing: [116.4074, 39.9042]
            - Oslo: [10.7522, 59.9139]
            - Stockholm: [18.0686, 59.3293]
            - Copenhagen: [12.5683, 55.6761]
            - Helsinki: [24.9384, 60.1699]
            - Dublin: [-6.2603, 53.3498]
            - Amsterdam: [4.9041, 52.3676]
            - Brussels: [4.3517, 50.8503]
            - Vienna: [16.3738, 48.2082]
            - Prague: [14.4378, 50.0755]
            - Athens: [23.7275, 37.9838]
            - Warsaw: [21.0122, 52.2297]
            - Budapest: [19.0402, 47.4979]
            - Bangkok: [100.5018, 13.7563]
            - Singapore: [103.8198, 1.3521]
            - Dubai: [55.2708, 25.2048]
            
            Example output:
            {
              "action": "SET_CENTER",
              "data": {
                "center": [2.3522, 48.8566],
                "zoom": 10
              }
            }
            
            DO NOT return string names for locations. Always use coordinates.
            """
        )
        
        # Ask LLM to generate the instruction
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        
        # Safety check - if we don't get proper coordinates
        if not instruct.data or "center" not in instruct.data or not isinstance(instruct.data["center"], list):
            print("Warning: LLM didn't return proper coordinates - trying again with a simpler prompt")
            
            # If the LLM fails, try a simpler prompt that's more likely to succeed
            system_message = SystemMessage(
                content="""Extract the location from the user's query and return its coordinates.
                
                For example, if the user asks about Paris, return:
                {
                  "action": "SET_CENTER",
                  "data": {
                    "center": [2.3522, 48.8566],
                    "zoom": 10
                  }
                }
                
                Be precise with the coordinates. DO NOT add any explanations.
                """
            )
            
            # Try one more time with a simpler prompt
            try:
                instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
                print(f"Second attempt result: {instruct}")
            except Exception as e:
                print(f"Error in second LLM attempt: {e}")
                # Create a basic instruction as a last resort
                instruct.data = {"center": [0, 0], "zoom": 2}  # World view as fallback
        
        # Debug the instruction format
        print(f"SET_CENTER instruction created: {instruct}")
        print(f"Instruction data: {instruct.data}")
        
        # Add to frontend actions
        state["frontend_actions"] = [instruct]  # Replace any existing actions
        
    elif next_action == MapBoxActions.SET_ZOOM:
        system_message = SystemMessage(
            content="""You are going to set the zoom level of the map.
            For example:
            {
              "action": "SET_ZOOM",
              "data": {
                "zoom": 12
              }
            }
            Zoom levels range from 1 (world view) to 22 (street level).
            """
        )
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)
        
    elif next_action == MapBoxActions.SET_GEOJSON:
        system_message = SystemMessage(
            content="""You are going to set GeoJSON data on the map.
            For example:
            {
              "action": "SET_GEOJSON",
              "data": {
                "geojson": {
                  "type": "FeatureCollection",
                  "features": [
                    {
                      "type": "Feature",
                      "properties": {},
                      "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[2.32, 48.85], [2.38, 48.85], [2.38, 48.87], [2.32, 48.87], [2.32, 48.85]]]
                      }
                    }
                  ]
                },
                "fillColor": "#3288bd",
                "fillOpacity": 0.6
              }
            }
            """
        )
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)
    
    # Let the LLM generate an appropriate response
    system_message = SystemMessage(
        content="""You are a helpful Geography assistant. 
        The system has just performed a map action based on the user's request.
        
        If the map was centered on a location, respond naturally as you would to the user's request.
        For example, if they asked to see Paris, you might say "I've centered the map on Paris for you. 
        Paris is the capital of France and known for landmarks like the Eiffel Tower."
        
        Keep your response natural, conversational, and focused on what the user asked.
        Do not use phrases like "I've centered the map" unless it flows naturally with your response.
        
        Be concise but informative.
        """
    )
    
    # Generate a natural response
    # Include the user's original message for better context
    original_message = state["messages"][-1] if state["messages"] else None
    
    # Create a message list with the system prompt and the user's original message
    prompt_messages = [system_message]
    if original_message:
        prompt_messages.append(original_message)
    
    # Generate the response
    llm_response = llm.invoke(prompt_messages)
    state["messages"] = [AIMessage(content=llm_response.content)]
    
    return state


def is_more_instructions(state: GraphState) -> Literal["chat_agent", "instructions"]:
    """Returns 'instructions' if there are more instructions or 'chat_agent' if there are no more instructions."""
    if state["instructions_list"]:
        return "instructions"
    return "chat_agent"
