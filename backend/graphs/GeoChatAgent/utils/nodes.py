from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.models import AvailableSteps, RouteUserMessage, MapBoxActionList, MapBoxActions, MapBoxInstruction
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage
from langchain_groq import ChatGroq
from typing import Literal, List
from dotenv import load_dotenv
import os
import json
from graphs.GeoChatAgent.utils.tools import DataAnalysisTool

load_dotenv()

# Initialize the LLM (defined at top level as recommended)
llm = ChatGroq(
    model_name="llama3-70b-8192",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0,
)


def route_user_message(state: GraphState) -> Literal["chat_agent", "create_instructions", "analyze_data"]:
    """Routes to the chat_agent node, instructions node, or data analysis node."""
    system_content = """Determine whether the user's message requires map interaction or data analysis.
        
        Examples that require map interaction:
        - "Show me Paris on the map" (centering the map)
        - "Center the map on New York" (centering the map)
        - "Zoom in to Tokyo" (zooming)
        - "Show me data for Burkina Faso" (loading data)
        - "Show me population density in Mali for 2015" (loading specific dataset)
        - "Show areas with precipitation above 50 in Niger" (loading data with threshold)
        - "Focus on Africa" (centering the map)
        - "Compare population between Chad and Mali" (loading data for comparison)
        - "Show me trends in rainfall from 2010 to 2020" (loading temporal data)
        
        Examples that require data analysis:
        - "Analyze the precipitation patterns in Mali"
        - "Calculate the average population density for Chad"
        - "Compare the population density trends between Mali and Niger"
        - "Find the correlation between precipitation and population in Burkina Faso"
        - "What's the statistical significance of rainfall changes in Senegal over time?"
        - "Show me a summary of population growth in Sudan"
        - "Give me insights about the data for Mauritania"
        - "Analyze the trends in the displayed data"
        
        Choose MAPBOX_INSTRUCTIONS if any map manipulation is needed. This includes:
        - Centering on locations
        - Zooming
        - Loading data (countries, datasets, years)
        - Setting thresholds
        - Visually comparing data
        
        Choose DATA_ANALYSIS if the user is asking for:
        - Statistical analysis
        - Data comparisons and correlations
        - Trend analysis
        - Summaries of data patterns
        - Insights about the data
        - Mathematical calculations on the data
        
        Otherwise choose CHAT_AGENT.
        """
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"
    
    system_message = SystemMessage(content=system_content)
    
    messages = [system_message] + state["messages"]
    next = llm.with_structured_output(RouteUserMessage).invoke(messages)
    
    print(f"Routing decision: {next.route}")
    
    if next.route == AvailableSteps.CHAT_AGENT:
        return "chat_agent"
    elif next.route == AvailableSteps.MAPBOX_INSTRUCTIONS:
        return "create_instructions"
    elif next.route == AvailableSteps.DATA_ANALYSIS:
        return "analyze_data"


def analyze_data(state: GraphState):
    """Analyzes data based on the user's query and map context."""
    # Extract active datasets, countries, and years from map context
    active_datasets = []
    active_countries = []
    active_years = []
    
    if state.get("map_context"):
        map_context = state["map_context"]
        
        # Parse the map context to extract information
        for line in map_context.split('\n'):
            if "Active datasets:" in line:
                datasets_text = line.split("Active datasets:")[1].strip()
                active_datasets = [d.strip() for d in datasets_text.split(',')]
            elif "Countries shown:" in line:
                countries_text = line.split("Countries shown:")[1].strip()
                active_countries = [c.strip() for c in countries_text.split(',')]
            elif "Available years:" in line:
                years_text = line.split("Available years:")[1].strip()
                active_years = [int(y.strip()) for y in years_text.split(',')]
            elif "Currently displaying year:" in line:
                current_year_text = line.split("Currently displaying year:")[1].strip()
                current_year = int(current_year_text)
                if current_year not in active_years:
                    active_years.append(current_year)
    
    # Get or set default values
    if not active_datasets:
        active_datasets = ["PopDensity", "Precipitation"]
    if not active_countries:
        active_countries = ["Mali", "Chad", "Niger"]  # Default selection
    if not active_years:
        active_years = [2015, 2016, 2017, 2018, 2019, 2020]  # Recent years
    
    # Normalize country names (replace spaces with underscores)
    active_countries = [c.replace(" ", "_") for c in active_countries]
    
    # Collect analysis results
    analysis_results = {
        "statistics": {},
        "temporal_trends": {},
        "regional_comparisons": {},
        "correlations": {}
    }
    
    # Generate statistics for each dataset and country
    for dataset in active_datasets:
        for country in active_countries:
            if active_years:
                # Use the most recent year for statistics
                most_recent_year = max(active_years)
                geojson = DataAnalysisTool.get_geojson_data(dataset, country, most_recent_year)
                
                if geojson:
                    values = DataAnalysisTool.extract_data_values(geojson)
                    stats = DataAnalysisTool.calculate_statistics(values)
                    analysis_results["statistics"][f"{dataset}_{country}_{most_recent_year}"] = stats
    
    # Generate temporal trends analysis
    for dataset in active_datasets:
        for country in active_countries:
            if len(active_years) > 1:  # Need multiple years for trend analysis
                trends = DataAnalysisTool.analyze_temporal_trends(dataset, country, active_years)
                analysis_results["temporal_trends"][f"{dataset}_{country}"] = trends
    
    # Generate regional comparisons
    for dataset in active_datasets:
        if len(active_countries) > 1 and active_years:  # Need multiple countries for comparison
            most_recent_year = max(active_years)
            comparisons = DataAnalysisTool.compare_regions(dataset, active_countries, most_recent_year)
            analysis_results["regional_comparisons"][f"{dataset}_{most_recent_year}"] = comparisons
    
    # Generate correlation analysis
    for country in active_countries:
        if len(active_datasets) > 1 and active_years:  # Need both datasets for correlation
            correlations = DataAnalysisTool.analyze_correlations(country, active_years)
            analysis_results["correlations"][country] = correlations
    
    # Format analysis results for LLM
    analysis_json = json.dumps(analysis_results, indent=2)
    
    # Create detailed system prompt with the analysis data
    system_content = f"""You are a data analyst specializing in geospatial data analysis for UN climate and population data.

Based on the analysis of the map data, provide detailed insights in clear, non-technical language.

Here is the raw analysis data to interpret:
```json
{analysis_json}
```

Structure your response with the following sections:

1. STATISTICAL SUMMARY: Interpret key metrics (mean, median, max/min values) for each dataset and country
2. TEMPORAL TRENDS: Explain patterns and changes over time, highlighting significant year-to-year changes
3. REGIONAL PATTERNS: Compare data across different countries, noting which regions stand out and why
4. RELATIONSHIPS: Describe correlations between population density and precipitation where available
5. KEY INSIGHTS: Summarize 3-5 most important findings from the data
6. RECOMMENDATIONS: Suggest additional data that would enhance the analysis

Important:
- Explain what the numbers mean in real-world terms
- Note any limitations in the data or analysis
- Use clear, non-technical language for a general audience
- When discussing trends, be specific about the magnitude and significance of changes
"""
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\nMap context information:\n{state['map_context']}"
        
    system_message = SystemMessage(content=system_content)
    
    # Get the analysis from the LLM
    messages = [system_message] + state["messages"]
    analysis_response = llm.invoke(messages)
    
    # Return the analysis as a message
    return {"messages": [AIMessage(content=analysis_response.content)]}


def create_instructions(state: GraphState):
    """Creates instructions for the map based on the user's query."""
    system_content = """You are going to create a list of the instructions we will do to Mapbox.
        
        AVAILABLE MAP ACTIONS:
        - SET_CENTER: Move the map to center on a location
        - SET_ZOOM: Change the zoom level of the map
        - SET_GEOJSON: Add data visualization to the map (countries, datasets, years)
        - ANALYZE_DATA: Perform statistical analysis on the displayed data
        
        Examples:
        1. If the task is to "Show me Paris", you would return:
           [MapBoxActions.SET_CENTER]
        
        2. If the task is to "Zoom into the Eiffel Tower", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_ZOOM]
        
        3. If the task is to "Show population data for Burkina Faso", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_GEOJSON]
        
        4. If the task is to "Compare rainfall in Mali and Chad from 2010 to 2015", you would return:
           [MapBoxActions.SET_GEOJSON]
           
        5. If the task is to "Analyze the trends in population density for Mali", you would return:
           [MapBoxActions.ANALYZE_DATA]
           
        When to use SET_GEOJSON:
        - Whenever the user wants to see specific data (population density, precipitation)
        - When the user wants to filter data (show areas with population above 50)
        - When the user wants to compare data across regions or time
        - When the user mentions specific countries, datasets, or years
        
        When to use ANALYZE_DATA:
        - When the user wants statistical analysis of the displayed data
        - When the user wants trends, patterns, or insights from the data
        - When the user wants to compare regions statistically
        - When the user wants correlation analysis between datasets
        
        Convert the user's request into a sequence of map actions.
        """
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"
        
    system_message = SystemMessage(content=system_content)
    
    instructions = llm.with_structured_output(MapBoxActionList).invoke(state["messages"])
    print(f"Created instructions: {instructions.actions}")
    return {"instructions_list": instructions.actions}


def chat_agent(state: GraphState):
    system_content = """You are a helpful Geography assistant specializing in climate and population data from the UN.
        You can answer questions about population density, precipitation, and other geographical data for African countries.
        
        When the user asks about viewing locations or data on the map, make sure to answer them clearly and helpfully.
        
        Keep answers concise and focused on the user's question.
        """
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"
        
    system_message = SystemMessage(content=system_content)
    
    return {"messages": llm.with_config(tags=["answer"]).invoke([system_message] + state["messages"])}


def instructions(state: GraphState):
    """Executes the next instruction in the list."""

    if not state.get("frontend_actions"):
        state["frontend_actions"] = []

    next_action = state["instructions_list"].pop(0)
    
    # Get the user's original question
    user_message = state["messages"][-1].content.lower() if state["messages"] else ""
    print(f"User message: {user_message}")
    
    if next_action == MapBoxActions.ANALYZE_DATA:
        # Create an instruction for data analysis
        instruct = MapBoxInstruction(
            action=MapBoxActions.ANALYZE_DATA,
            data={}
        )
        state["frontend_actions"].append(instruct)
        
        # Generate a response about the analysis
        system_content = """You are a helpful Geography assistant.
            The system is now performing a data analysis on the currently displayed map data.
            
            Tell the user that you are analyzing the data and they will receive insights shortly.
            Keep your response brief and focused.
            """
            
        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"
        
        system_message = SystemMessage(content=system_content)
        
        # Generate a response
        llm_response = llm.invoke([system_message] + state["messages"])
        state["messages"] = [AIMessage(content=llm_response.content)]
        
        return state
    
    elif next_action == MapBoxActions.SET_CENTER:
        # Use LLM to generate map center instruction
        system_content = """You are going to set the center of the map based on the user's query.
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
            
            # African countries:
            - Burkina Faso: [-1.561593, 12.364637]
            - Chad: [18.732207, 15.454166]
            - Mali: [-3.996166, 17.570692]
            - Mauritania: [-10.940835, 21.00789]
            - Niger: [8.081666, 17.607789]
            - Senegal: [-14.452362, 14.497401]
            - Sudan: [30.217636, 12.862807]
            
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
        
        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"
            
        system_message = SystemMessage(content=system_content)
        
        # Ask LLM to generate the instruction
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        
        # Safety check - if we don't get proper coordinates
        if not instruct.data or "center" not in instruct.data or not isinstance(instruct.data["center"], list):
            print("Warning: LLM didn't return proper coordinates - trying again with a simpler prompt")
            
            # If the LLM fails, try a simpler prompt that's more likely to succeed
            system_content = """Extract the location from the user's query and return its coordinates.
                
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
                
            # Add map context if available
            if state.get("map_context"):
                system_content += f"\n\n{state['map_context']}"
                
            system_message = SystemMessage(content=system_content)
            
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
        
        # Initialize frontend_actions if not already present
        if "frontend_actions" not in state:
            state["frontend_actions"] = []
        
        # Clear existing actions and add this one
        state["frontend_actions"] = []
        state["frontend_actions"].append(instruct)
        
    elif next_action == MapBoxActions.SET_ZOOM:
        system_content = """You are going to set the zoom level of the map.
            For example:
            {
              "action": "SET_ZOOM",
              "data": {
                "zoom": 12
              }
            }
            Zoom levels range from 1 (world view) to 22 (street level).
            """
            
        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"
            
        system_message = SystemMessage(content=system_content)
        
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)
        
    elif next_action == MapBoxActions.SET_GEOJSON:
        system_content = """You are going to set GeoJSON data parameters on the map.
            You need to provide the datasets, countries, and years to display.
            
            Available datasets:
            - "PopDensity" (Population Density)
            - "Precipitation" (Precipitation)
            
            Available countries:
            - "Burkina_Faso" 
            - "Chad"
            - "Mali"
            - "Mauritania"
            - "Niger"
            - "Senegal"
            - "Sudan"
            
            Available years: 2010 through 2020
            
            Example for loading population density data for Mali in 2015:
            {
              "action": "SET_GEOJSON",
              "data": {
                "datasets": ["PopDensity"],
                "countries": ["Mali"],
                "years": [2015],
                "thresholds": {
                  "PopDensity": 20,
                  "Precipitation": 0
                }
              }
            }
            
            Based on the user's request, determine which datasets, countries, and years should be displayed.
            If the user is asking about a specific type of data (population, rainfall, etc.), select the appropriate dataset.
            If the user is asking about specific countries, include those countries.
            If the user mentions years, include those years. Otherwise default to 2015.
            
            You can set threshold values to filter the data. For example, if the user asks to see areas with population 
            density above 50, set the threshold for "PopDensity" to 50.
            """
            
        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"
            
        system_message = SystemMessage(content=system_content)
        
        instruct = llm.with_structured_output(MapBoxInstruction).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)
    
    # Let the LLM generate an appropriate response
    system_content = """You are a helpful Geography assistant. 
        The system has just performed a map action based on the user's request.
        
        If the map was centered on a location, respond naturally as you would to the user's request.
        For example, if they asked to see Paris, you might say "I've centered the map on Paris for you. 
        Paris is the capital of France and known for landmarks like the Eiffel Tower."
        
        Keep your response natural, conversational, and focused on what the user asked.
        Do not use phrases like "I've centered the map" unless it flows naturally with your response.
        
        Be concise but informative.
        """
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"
    
    system_message = SystemMessage(content=system_content)
    
    # Generate a natural response
    # Include the user's original message for better context
    original_message = state["messages"][-1] if state["messages"] else None
    
    # Create a message list with the system prompt and the user's original message
    prompt_messages = [system_message]
    if original_message:
        prompt_messages.append(original_message)
    
    # Generate the response
    llm_response = llm.invoke(prompt_messages)
    
    # Make sure the AI response isn't empty to ensure the frontend shows a message
    if not llm_response.content.strip():
        # If the LLM didn't generate a response, provide a default one
        response_content = "I've updated the map based on your request."
    else:
        response_content = llm_response.content
        
    state["messages"] = [AIMessage(content=response_content)]
    
    return state


def is_more_instructions(state: GraphState) -> Literal["chat_agent", "instructions"]:
    """Returns 'instructions' if there are more instructions or 'chat_agent' if there are no more instructions."""
    if state["instructions_list"]:
        return "instructions"
    return "chat_agent"
