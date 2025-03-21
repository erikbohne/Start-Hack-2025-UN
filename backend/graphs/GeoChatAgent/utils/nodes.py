from graphs.GeoChatAgent.utils.state import GraphState
from graphs.GeoChatAgent.utils.models import (
    AvailableSteps, RouteUserMessage, MapBoxActionList, 
    MapBoxActions, MapBoxInstruction, MediaContent, ChatMessageWithMedia
)
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage
from langchain_groq import ChatGroq
from langchain_openai import AzureChatOpenAI
from typing import Literal, List, Union
from dotenv import load_dotenv
import os
import json
from graphs.GeoChatAgent.utils.tools import DataAnalysisTool

load_dotenv()

# Initialize the LLM (defined at top level as recommended)
# llm = ChatGroq(
#     model_name="llama3-70b-8192",
#     api_key=os.getenv("GROQ_API_KEY"),
#     temperature=0,
# )

AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_URL = os.getenv("AZURE_OPENAI_URL")

llm = AzureChatOpenAI(
    temperature=0,
    model="gpt-4o",
    api_key=AZURE_OPENAI_KEY,
    azure_endpoint=AZURE_OPENAI_URL,
    api_version="2024-10-21",
    verbose=False,
)


def route_user_message(state: GraphState) -> Literal["chat_agent", "create_instructions", "analyze_data", "create_gif_timeline"]:
    """Routes to the chat_agent node, instructions node, data analysis node, or GIF creation node."""
    system_content = """Determine whether the user's message requires map interaction, data analysis, or timeline animation.
        
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
        - "Display data for the Sahel region" (loading region data)
        - "Show precipitation in the Assaba region" (loading region data)
        
        Examples that require data analysis:
        - "Analyze the precipitation patterns in Mali"
        - "Give me an analysis of population density in Chad"
        - "Analyze the correlation between precipitation and population in Burkina Faso"
        - "Can you analyze the trends in rainfall over time?"
        - "Provide statistical analysis of the population density data"
        - "Calculate the average precipitation for Niger"
        - "Compare and analyze the data between regions"
        
        Examples that require timeline animation (CREATE_GIF_FOR_TIMELINE):
        - "Create an animation of population density in Mali from 2015 to 2020"
        - "Show me a timeline animation of precipitation in Niger"
        - "Make a GIF showing how rainfall changed in Chad over time"
        - "Animate the population changes in Burkina Faso over the years"
        - "Create a visual timeline of population density in Senegal"
        - "I want to see how precipitation evolved in Sudan through an animation"
        - "Show me an animated timeline of population changes in Mauritania from 2010 to 2020"
        
        Choose MAPBOX_INSTRUCTIONS if any map manipulation is needed. This includes:
        - Centering on locations
        - Zooming
        - Loading data (countries, datasets, years)
        - Setting thresholds
        - Visually comparing data
        - When the user says "show" or "display" data, ALWAYS choose MAPBOX_INSTRUCTIONS
        
        ONLY choose DATA_ANALYSIS if the user EXPLICITLY asks for analysis with words like:
        - "Analyze..."
        - "Give me an analysis of..."
        - "Provide statistical analysis..."
        - "Calculate statistics for..."
        - "Compute the correlation between..."
        - "What is the statistical significance of..."
        
        If the user simply asks to "show data" or "display data" or "show trends" without explicitly requesting analysis, choose MAPBOX_INSTRUCTIONS instead of DATA_ANALYSIS.
        
        Choose CREATE_GIF_FOR_TIMELINE if the user is asking for:
        - Timeline animations or visualizations
        - GIFs showing changes over time
        - Time-lapse visualizations
        - Animations of data changes
        - Visualizing temporal patterns through animation
        
        Otherwise choose CHAT_AGENT.
        """

    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"

    system_message = SystemMessage(content=system_content)

    messages = [system_message] + state["messages"]
    next = llm.with_structured_output(
        RouteUserMessage, method="function_calling"
    ).invoke(messages)

    print(f"Routing decision: {next.route}")

    if next.route == AvailableSteps.CHAT_AGENT:
        return "chat_agent"
    elif next.route == AvailableSteps.MAPBOX_INSTRUCTIONS:
        return "create_instructions"
    elif next.route == AvailableSteps.DATA_ANALYSIS:
        return "analyze_data"
    elif next.route == AvailableSteps.CREATE_GIF_FOR_TIMELINE:
        return "create_gif_timeline"


def analyze_data(state: GraphState):
    """Analyzes data based on the user's query and map context."""
    # Extract active datasets, countries, and years from map context
    active_datasets = []
    active_countries = []
    active_years = []

    if state.get("map_context"):
        map_context = state["map_context"]

        # Parse the map context to extract information
        for line in map_context.split("\n"):
            if "Active datasets:" in line:
                datasets_text = line.split("Active datasets:")[1].strip()
                active_datasets = [d.strip() for d in datasets_text.split(",")]
            elif "Countries shown:" in line:
                countries_text = line.split("Countries shown:")[1].strip()
                active_countries = [c.strip() for c in countries_text.split(",")]
            elif "Available years:" in line:
                years_text = line.split("Available years:")[1].strip()
                active_years = [int(y.strip()) for y in years_text.split(",")]
            elif "Currently displaying year:" in line:
                current_year_text = line.split("Currently displaying year:")[1].strip()
                current_year = int(current_year_text)
                if current_year not in active_years:
                    active_years.append(current_year)

    # Get the user's original question
    user_message = state["messages"][-1].content.lower() if state["messages"] else ""

    # Check for time range queries in the user's question
    time_range_query = False
    specific_country_query = None
    specific_years = []

    # Check for population change queries
    if (
        "change" in user_message
        or "trend" in user_message
        or "difference" in user_message
    ):
        if "population" in user_message:
            if "PopDensity" not in active_datasets:
                active_datasets.append("PopDensity")
            time_range_query = True

    # Check for specific country mentions
    countries = [
        "Mali",
        "Chad",
        "Niger",
        "Burkina Faso",
        "Mauritania",
        "Senegal",
        "Sudan",
    ]
    for country in countries:
        if country.lower() in user_message:
            specific_country_query = country.replace(" ", "_")
            break

    # Try to extract specific years mentioned in the query
    import re

    year_matches = re.findall(r"\b(20\d\d)\b", user_message)
    if year_matches:
        for year_match in year_matches:
            try:
                year = int(year_match)
                if 2010 <= year <= 2020:  # Ensure it's in our available range
                    specific_years.append(year)
            except ValueError:
                pass

    # Check for time period phrases
    time_phrases = [
        ("last 5 years", 5),
        ("past 5 years", 5),
        ("last five years", 5),
        ("past five years", 5),
        ("last 10 years", 10),
        ("past 10 years", 10),
        ("last ten years", 10),
        ("past ten years", 10),
        ("last 3 years", 3),
        ("past 3 years", 3),
        ("last three years", 3),
        ("past three years", 3),
    ]

    for phrase, years_back in time_phrases:
        if phrase in user_message:
            latest_year = 2020  # Assuming our data goes up to 2020
            for y in range(latest_year - years_back + 1, latest_year + 1):
                specific_years.append(y)
            time_range_query = True
            break

    # Apply the extracted query parameters
    if specific_country_query:
        active_countries = [specific_country_query]

    if specific_years:
        active_years = specific_years

    # Get or set default values if still empty
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
        "correlations": {},
    }

    # Generate statistics for each dataset and country
    for dataset in active_datasets:
        for country in active_countries:
            if active_years:
                # Use the most recent year for statistics
                most_recent_year = max(active_years)
                geojson = DataAnalysisTool.get_geojson_data(
                    dataset, country, most_recent_year
                )

                if geojson:
                    values = DataAnalysisTool.extract_data_values(geojson)
                    # Pass the geojson to calculate_statistics to get center of mass
                    stats = DataAnalysisTool.calculate_statistics(values, geojson)
                    analysis_results["statistics"][
                        f"{dataset}_{country}_{most_recent_year}"
                    ] = stats

    # Generate temporal trends analysis
    for dataset in active_datasets:
        for country in active_countries:
            if len(active_years) > 1:  # Need multiple years for trend analysis
                trends = DataAnalysisTool.analyze_temporal_trends(
                    dataset, country, active_years
                )
                analysis_results["temporal_trends"][f"{dataset}_{country}"] = trends

    # Generate regional comparisons
    for dataset in active_datasets:
        if (
            len(active_countries) > 1 and active_years
        ):  # Need multiple countries for comparison
            most_recent_year = max(active_years)
            comparisons = DataAnalysisTool.compare_regions(
                dataset, active_countries, most_recent_year
            )
            analysis_results["regional_comparisons"][
                f"{dataset}_{most_recent_year}"
            ] = comparisons

    # Generate correlation analysis
    for country in active_countries:
        if (
            len(active_datasets) > 1 and active_years
        ):  # Need both datasets for correlation
            correlations = DataAnalysisTool.analyze_correlations(country, active_years)
            analysis_results["correlations"][country] = correlations

    # Format analysis results for LLM
    analysis_json = json.dumps(analysis_results, indent=2)

    # Create concise system prompt with the analysis data
    system_content = f"""You are a data analyst. Based on the analysis data below, generate a concise and clear report in non-technical language.

Raw analysis data:
    
{analysis_json}

Analyze the data and provide insights, trends, and comparisons based on the user's query.
If the user asked about specific countries, datasets, or years, focus on those in your analysis.
Keep your response focused and informative.

Always try to see the data in light of each other.
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
        - SET_GEOJSON: Add data visualization to the map (countries, regions, datasets, years)
        - ANALYZE_DATA: Perform statistical analysis on the displayed data
        
        Examples:
        1. If the task is to "Show me Paris", you would return:
           [MapBoxActions.SET_CENTER]
        
        2. If the task is to "Zoom into the Eiffel Tower", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_ZOOM]
        
        3. If the task is to "Show population data for Burkina Faso", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_GEOJSON]
        
        4. If the task is to "Compare rainfall in Mali and Chad from 2010 to 2015", you would return:
           [MapBoxActions.SET_GEOJSON, MapBoxActions.SET_CENTER]
           
        5. If the task is to "Show data for the Sahel Est region", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_GEOJSON]
           
        6. If the task is to "Show trends in population density for Mali", you would return:
           [MapBoxActions.SET_CENTER, MapBoxActions.SET_GEOJSON]
           
        7. If the task is to "Display precipitation changes over time", you would return:
           [MapBoxActions.SET_GEOJSON, MapBoxActions.SET_CENTER]
           
        8. ONLY if the task is explicitly "Analyze the data for Mali" or "Give me statistical analysis", you would return:
           [MapBoxActions.ANALYZE_DATA]
           
        When to use SET_GEOJSON:
        - Whenever the user wants to see specific data (population density, precipitation)
        - When the user wants to filter data (show areas with population above 50)
        - When the user wants to compare data across regions or time
        - When the user mentions specific countries, specific regions, datasets, or years
        - ALWAYS use SET_GEOJSON when the user says "show" or "display" data
        - ALWAYS use SET_GEOJSON when the user asks to see trends or changes over time
        
        When to use ANALYZE_DATA:
        - ONLY when the user EXPLICITLY asks for statistical analysis with phrases like:
          * "Analyze the data"
          * "Give me an analysis"
          * "Provide statistical analysis"
          * "Calculate statistics"
          * "What is the statistical significance"
        
        IMPORTANT: If the user simply asks to "show data" or "display data" or "show trends" 
        without explicitly requesting analysis, NEVER use ANALYZE_DATA. Instead use 
        SET_GEOJSON to show the data visually on the map.
        
        Convert the user's request into a sequence of map actions.
        """

    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\n{state['map_context']}"

    system_message = SystemMessage(content=system_content)

    instructions = llm.with_structured_output(
        MapBoxActionList, method="function_calling"
    ).invoke([system_message] + state["messages"])
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

    return {
        "messages": llm.with_config(tags=["answer"]).invoke(
            [system_message] + state["messages"]
        )
    }


def instructions(state: GraphState):
    """Executes the next instruction in the list."""

    if not state.get("frontend_actions"):
        state["frontend_actions"] = []

    # If there are no more instructions, return the state as is
    if not state.get("instructions_list"):
        return state

    # Process the next instruction from the list
    next_action = state["instructions_list"].pop(0)
    print(f"Processing instruction: {next_action}")

    # Get the user's original question
    user_message = state["messages"][-1].content.lower() if state["messages"] else ""
    print(f"User message: {user_message}")

    if next_action == MapBoxActions.ANALYZE_DATA:
        # First, verify that this is an explicit analysis request
        user_message = state["messages"][-1].content.lower() if state["messages"] else ""
        explicit_analysis_terms = ["analyze", "analysis", "statistical", "statistics", "calculate"]
        
        # Check if any explicit analysis terms are present in the user message
        is_explicit_analysis = any(term in user_message for term in explicit_analysis_terms)
        
        # If not an explicit analysis request, switch to SET_GEOJSON instead
        if not is_explicit_analysis:
            print("User did not explicitly request analysis, switching to SET_GEOJSON instead")
            # Update instructions_list to use SET_GEOJSON instead
            if "instructions_list" not in state:
                state["instructions_list"] = []
                
            # Replace the current instruction with SET_GEOJSON and SET_CENTER
            state["instructions_list"] = [MapBoxActions.SET_GEOJSON, MapBoxActions.SET_CENTER]
            
            # Continue to the next instruction (which will now be SET_GEOJSON)
            return state
        
        print("Proceeding with explicit data analysis as requested")
        
        # Extract map context country and region information
        active_countries = []
        active_regions = []
        if state.get("map_context"):
            map_context = state["map_context"]
            for line in map_context.split("\n"):
                if "Countries shown:" in line:
                    countries_text = line.split("Countries shown:")[1].strip()
                    if countries_text:  # Only process if not empty
                        active_countries = [c.strip() for c in countries_text.split(",") if c.strip()]
                if "Regions shown:" in line:
                    regions_text = line.split("Regions shown:")[1].strip()
                    if regions_text:  # Only process if not empty
                        active_regions = [r.strip() for r in regions_text.split(",") if r.strip()]

        # Country and region coordinates
        country_coords = {
            "Burkina_Faso": [-1.561593, 12.364637],
            "Burkina Faso": [-1.561593, 12.364637],
            "Chad": [18.732207, 15.454166],
            "Mali": [-3.996166, 17.570692],
            "Mauritania": [-10.940835, 21.00789],
            "Niger": [8.081666, 17.607789],
            "Senegal": [-14.452362, 14.497401],
            "Sudan": [30.217636, 12.862807],
            # Regions
            "Assaba_Hodh_El_Gharbi_Tagant": [-10.940835, 21.00789],
            "Sahel_Est_Centre-Est": [-1.561593, 12.364637]
        }

        # Use the LLM to identify the most relevant location (country or region)
        target_location = None
        
        # Prepare a prompt for the LLM to extract location
        location_system_prompt = f"""
        Identify if the user is asking about a specific country or region in their message.
        
        Available countries:
        - Burkina_Faso
        - Chad
        - Mali 
        - Mauritania
        - Niger
        - Senegal
        - Sudan
        
        Available regions:
        - Assaba_Hodh_El_Gharbi_Tagant (in Mauritania)
        - Sahel_Est_Centre-Est (in Burkina Faso)
        
        Return the exact name from the list above that best matches what the user is asking about.
        If there are multiple matches, return the best one.
        If there's no clear match, return the most appropriate one from the current map context.
        
        Current map context:
        {state.get('map_context', 'No context available')}
        """
        
        try:
            # Only create a brief conversation to extract the location
            location_messages = [
                SystemMessage(content=location_system_prompt),
                HumanMessage(content=f"Extract the country or region from: {user_message}")
            ]
            
            # Get a simple response with just the location name
            location_response = llm.invoke(location_messages).content.strip()
            
            # If we got a response that's in our coordinates list, use it
            if location_response in country_coords:
                target_location = location_response
                print(f"LLM identified location: {target_location}")
            # Otherwise try to find the closest match
            else:
                for location in country_coords.keys():
                    if location.lower() in location_response.lower() or location_response.lower() in location.lower():
                        target_location = location
                        print(f"Matched location '{location_response}' to '{target_location}'")
                        break
        except Exception as e:
            print(f"Error using LLM to extract location: {e}")
            
        # Fallback to active regions/countries if LLM didn't find a match
        if not target_location:
            if active_regions and len(active_regions) > 0:
                target_location = active_regions[0]
                print(f"Using active region: {target_location}")
            elif active_countries and len(active_countries) > 0:
                target_location = active_countries[0]
                print(f"Using active country: {target_location}")
            else:
                # Default to Mali if nothing else is available
                target_location = "Mali"
                print(f"Using default country: {target_location}")

        # Create a CENTER instruction if we have a target location
        if target_location and target_location in country_coords:
            center_instruct = MapBoxInstruction(
                action=MapBoxActions.SET_CENTER,
                data={
                    "center": country_coords[target_location],
                    "zoom": 4,  # Zoomed out enough to show country or region context
                },
            )
            state["frontend_actions"].append(center_instruct)

        # Add the analysis instruction after the center instruction
        analyze_instruct = MapBoxInstruction(action=MapBoxActions.ANALYZE_DATA, data={})
        state["frontend_actions"].append(analyze_instruct)

        # Generate a response about the analysis
        system_content = """You are a helpful Geography assistant.
            The system is now performing a data analysis on the currently displayed map data.
            
            Tell the user that you are analyzing the data and they will receive insights shortly.
            If a specific country is being analyzed, mention it by name.
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
            
            # Regions:
            - Assaba Hodh El Gharbi Tagant: [-10.940835, 21.00789] # Same as Mauritania for now
            - Sahel Est Centre-Est: [-1.561593, 12.364637] # Same as Burkina Faso for now
            
            Example output:
            {
              "action": "SET_CENTER",
              "data": {
                "center": [2.3522, 48.8566],
                "zoom": 10
              }
            }
            
            DO NOT return string names for locations. Always use coordinates. Do not do DATA ANALYSIS here.
            You are forced to use the MapBoxActions.SET_CENTER action AND IT ALWAYS NEEDS DATA.
            If the user asks for a specific location, center the map on that location.
            If the user asks for a region or country, center the map on the capital or a central point.
            If the user asks for a comparison, center the map on a point that includes both locations.
            Be precise with the coordinates and 

            please do not zoom in to much
            """

        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"

        system_message = SystemMessage(content=system_content)

        # Ask LLM to generate the instruction
        instruct = llm.with_structured_output(
            MapBoxInstruction, method="function_calling"
        ).invoke([system_message] + state["messages"])

        # Safety check - if we don't get proper coordinates
        if (
            not instruct.data
            or "center" not in instruct.data
            or not isinstance(instruct.data["center"], list)
        ):
            print(
                "Warning: LLM didn't return proper coordinates - trying again with a simpler prompt"
            )

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
                instruct = llm.with_structured_output(
                    MapBoxInstruction, method="function_calling"
                ).invoke([system_message] + state["messages"])
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

        # Add this instruction to the list
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

        instruct = llm.with_structured_output(
            MapBoxInstruction, method="function_calling"
        ).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)

    elif next_action == MapBoxActions.SET_GEOJSON:
        system_content = """You are going to set GeoJSON data parameters on the map.
            You need to provide the datasets, countries/regions, and years to display.
            
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
            
            Available regions:
            - "Assaba_Hodh_El_Gharbi_Tagant" (in Mauritania)
            - "Sahel_Est_Centre-Est" (in Burkina Faso)
            
            Available years: 2010 through 2020
            
            Example for loading population density data for Mali in 2015:
            {
              "action": "SET_GEOJSON",
              "data": {
                "datasets": ["PopDensity"],
                "countries": ["Mali"],
                "regions": [],
                "years": [2015],
                "thresholds": {
                  "PopDensity": 20,
                  "Precipitation": 0
                }
              }
            }
            
            Based on the user's request, determine which datasets, countries, regions, and years should be displayed.
            If the user is asking about a specific type of data (population, rainfall, etc.), select the appropriate dataset.
            If the user is asking about specific countries, include those countries.
            If the user is asking about specific regions, include those regions.
            Note: Either include countries OR regions, not both at the same time.
            If the user mentions years, include those years. Otherwise default to 2015.
            
            You can set threshold values to filter the data. For example, if the user asks to see areas with population 
            density above 50, set the threshold for "PopDensity" to 50.
            """

        # Add map context if available
        if state.get("map_context"):
            system_content += f"\n\n{state['map_context']}"

        system_message = SystemMessage(content=system_content)

        instruct = llm.with_structured_output(
            MapBoxInstruction, method="function_calling"
        ).invoke([system_message] + state["messages"])
        state["frontend_actions"].append(instruct)

    return state


def create_gif_timeline(state: GraphState):
    """Creates an animated timeline GIF from time series data and returns it to the frontend."""
    import numpy as np
    # Force matplotlib to use the Agg backend (non-interactive, no GUI)
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.colors as colors
    from matplotlib.animation import FuncAnimation
    import imageio
    import os
    import tempfile
    import base64
    from pathlib import Path
    import rasterio
    from PIL import Image
    from graphs.GeoChatAgent.utils.models import TimelineParameters
    
    # Get the user's original message
    user_message = state["messages"][-1].content if state["messages"] else ""
    
    # Add context about the available data
    system_content = """Extract timeline parameters from the user's query.
    
    Available datasets:
    - PopDensity (population density)
    - Precipitation (rainfall)
    
    Available countries:
    - Mali
    - Chad
    - Niger
    - Burkina_Faso
    - Mauritania
    - Senegal
    - Sudan
    
    Available years: 2010 through 2020
    
    If the user doesn't specify a particular parameter, use the default value.
    If multiple countries or datasets are mentioned, select the first one mentioned.
    If the user mentions years, extract them for start_year and end_year.
    If only one year is mentioned, use it for both start and end year.
    
    For country names, convert spaces to underscores (e.g., "Burkina Faso" becomes "Burkina_Faso").
    """
    
    # Add map context if available
    if state.get("map_context"):
        system_content += f"\n\nMap context:\n{state['map_context']}"
    
    # Create a system message
    system_message = SystemMessage(content=system_content)
    
    # Use structured output to extract parameters
    timeline_params = llm.with_structured_output(TimelineParameters, method="function_calling").invoke(
        [system_message, HumanMessage(content=user_message)]
    )
    
    print(f"Extracted timeline parameters: {timeline_params}")
    
    # Extract parameters from the structured output
    dataset = timeline_params.dataset
    country = timeline_params.country
    start_year = timeline_params.start_year
    end_year = timeline_params.end_year
    
    # Ensure years are within the available range
    start_year = max(2010, start_year)
    end_year = min(2020, end_year)
    
    # Create a sequence of years for the animation
    years = list(range(start_year, end_year + 1))
    
    # Set up the response message
    response_message = f"Creating an animated timeline of {dataset.replace('PopDensity', 'population density').replace('Precipitation', 'precipitation')} "
    response_message += f"for {country.replace('_', ' ')} from {start_year} to {end_year}. "
    response_message += "The animation will show changes over time in the selected dataset."
    
    # Get paths to the TIFF files
    dataset_path = "/Users/eriknymobohne/Documents/hackathon/Start-Hack-2025-UN/data"
    tiff_paths = []
    
    for year in years:
        if dataset == "PopDensity":
            country_codes = {
                "Burkina_Faso": "bfa",
                "Chad": "tcd",
                "Mali": "mli",
                "Mauritania": "mrt",
                "Niger": "ner",
                "Senegal": "sen",
                "Sudan": "sdn"
            }
            
            code = country_codes.get(country)
            if not code:
                continue
                
            tiff_filename = f"{code}_pd_{year}_1km_UNadj.tif"
            tiff_path = f"{dataset_path}/Africa/PopDensity/{country}/{tiff_filename}"
            
        elif dataset == "Precipitation":
            tiff_filename = f"Precipitation_{country.replace('_', ' ')}_{year}.tif"
            tiff_path = f"{dataset_path}/Africa/Precipitation/{country}/{tiff_filename}"
        
        if os.path.exists(tiff_path):
            tiff_paths.append((year, tiff_path))
    
    # If no valid tiff files found, return an error message
    if not tiff_paths:
        error_message = f"Sorry, I couldn't find any {dataset} TIFF files for {country.replace('_', ' ')} between {start_year} and {end_year}."
        state["messages"].append(AIMessage(content=error_message))
        return {"messages": state["messages"]}
    
    # Add necessary import for BytesIO
    import io
    
    # Create a temporary directory for the GIF frames
    with tempfile.TemporaryDirectory() as temp_dir:
        # Prepare to collect PIL Image frames
        pil_frames = []
        
        # Store min/max values for consistent colorscale
        min_val = float('inf')
        max_val = float('-inf')
        
        # First pass: read the data and determine global min/max for normalization
        data_series = []
        for year, tiff_path in tiff_paths:
            try:
                # Open the TIFF file with rasterio
                with rasterio.open(tiff_path) as src:
                    # Read the data
                    data = src.read(1)
                    
                    # Handle nodata values
                    if src.nodata is not None:
                        data = np.ma.masked_equal(data, src.nodata)
                    
                    # Update global min/max (for consistent colormaps)
                    valid_data = data[~np.isnan(data) & (data > 0)]
                    if len(valid_data) > 0:
                        min_val = min(min_val, valid_data.min())
                        max_val = max(max_val, valid_data.max())
                    
                    # Store data for later processing
                    data_series.append({
                        "year": year,
                        "data": data,
                        "nodata": src.nodata
                    })
            except Exception as e:
                print(f"Error reading {tiff_path}: {e}")
                continue
        
        # Check if we have any valid data
        if not data_series:
            error_message = "Sorry, I couldn't process any TIFF files from the available data."
            state["messages"].append(AIMessage(content=error_message))
            return {"messages": state["messages"]}
        
        # Ensure we have sensible min/max values
        if min_val == float('inf'):
            min_val = 0
        if max_val == float('-inf'):
            max_val = 100
        
        # For population density, use log scale with minimum of 1
        if dataset == 'PopDensity':
            min_val = max(1, min_val)
            norm = colors.LogNorm(vmin=min_val, vmax=max(100, max_val))
            cmap = 'viridis'
        else:
            norm = colors.Normalize(vmin=min_val, vmax=max(100, max_val))
            cmap = 'Blues'
        
        # Second pass: create frames with consistent colorscale
        for data_item in sorted(data_series, key=lambda x: x["year"]):
            year = data_item["year"]
            data = data_item["data"]
            
            # Create a figure with high DPI for better quality
            plt.figure(figsize=(10, 8), dpi=100)
            
            # Plot with consistent normalization
            im = plt.imshow(data, cmap=cmap, norm=norm)
            
            # Add colorbar and title
            cbar = plt.colorbar(im)
            dataset_label = "Population Density" if dataset == "PopDensity" else "Precipitation (mm)"
            cbar.set_label(f"{dataset_label}")
            
            # Add title with year
            plt.title(f"{dataset_label} in {country.replace('_', ' ')} - {year}", fontsize=14)
            
            # Remove axes ticks for cleaner look
            plt.xticks([])
            plt.yticks([])
            
            # Add border for clarity
            plt.gca().spines['top'].set_visible(True)
            plt.gca().spines['right'].set_visible(True)
            plt.gca().spines['bottom'].set_visible(True)
            plt.gca().spines['left'].set_visible(True)
            
            # Save to in-memory buffer
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', bbox_inches='tight')
            plt.close()
            
            # Convert to PIL Image
            buffer.seek(0)
            img = Image.open(buffer)
            pil_frames.append(img)
            
            # Also save to disk for debugging if needed
            frame_path = os.path.join(temp_dir, f"frame_{year}.png")
            img.save(frame_path)
        
        if not pil_frames:
            error_message = "Sorry, I couldn't create animation frames from the available data."
            state["messages"].append(AIMessage(content=error_message))
            return {"messages": state["messages"]}
        
        # Create the GIF file using PIL
        gif_path = os.path.join(temp_dir, f"{dataset}_{country}_{start_year}_{end_year}.gif")
        
        # Save as GIF with appropriate duration (500ms per frame)
        pil_frames[0].save(
            gif_path,
            save_all=True,
            append_images=pil_frames[1:],
            optimize=False,
            duration=500,  # milliseconds per frame
            loop=0  # 0 means loop forever
        )

        # Save to current working directory with absolute path
        import os
        gif_output_path = os.path.join(os.getcwd(), "timeline.gif")
        print(f"Saving GIF to: {gif_output_path}")
        
        pil_frames[0].save(
            gif_output_path,
            save_all=True,
            append_images=pil_frames[1:],
            optimize=False,
            duration=500,  # milliseconds per frame
            loop=0  # 0 means loop forever
        )
        
        # Verify file was saved
        if os.path.exists(gif_output_path):
            print(f"GIF successfully saved, size: {os.path.getsize(gif_output_path)} bytes")
        else:
            print(f"ERROR: GIF file was not saved to {gif_output_path}")

        # Convert GIF to base64 for frontend
        with open(gif_path, "rb") as gif_file:
            gif_data = base64.b64encode(gif_file.read()).decode("utf-8")
        
        # Create a title for the timeline animation
        title = f"{dataset.replace('PopDensity', 'Population Density').replace('Precipitation', 'Precipitation')} Timeline for {country.replace('_', ' ')}"
        
        # Create a media content object
        media_content = MediaContent(
            type="gif",
            data=gif_data,
            alt_text=f"Animated timeline showing {dataset.replace('PopDensity', 'population density').replace('Precipitation', 'precipitation')} changes in {country.replace('_', ' ')} from {start_year} to {end_year}",
            title=title,
            metadata={
                "dataset": dataset,
                "country": country,
                "years": [data_item["year"] for data_item in sorted(data_series, key=lambda x: x["year"])],
                "start_year": start_year,
                "end_year": end_year
            }
        )
        
        # Create a chat message with embedded media
        chat_with_media = ChatMessageWithMedia(
            text=response_message,
            media=media_content
        )
        
        # Generate a unique timestamp for this GIF to avoid browser caching
        import time
        import urllib.parse
        timestamp = int(time.time() * 1000)
        gif_url = f"http://localhost:8000/timeline-gif?t={timestamp}"
        
        # Also create a URL for the HTML page with the title included
        encoded_title = urllib.parse.quote(title)
        html_url = f"http://localhost:8000/timeline-view?title={encoded_title}&t={timestamp}"
        
        print(f"GIF URL with cache buster: {gif_url}")
        print(f"HTML URL with title: {html_url}")
        
        # Create a MapBox instruction with a URL instead of embedding base64 data
        media_instruction = MapBoxInstruction(
            action=MapBoxActions.CHAT_MESSAGE_WITH_MEDIA,
            data={
                "text": response_message,
                "media": {
                    "type": "gif",
                    "url": gif_url,  # Direct GIF URL with cache buster
                    "iframe_url": html_url, # HTML page URL that displays the GIF
                    "alt_text": f"Animated timeline showing {dataset.replace('PopDensity', 'population density').replace('Precipitation', 'precipitation')} changes in {country.replace('_', ' ')} from {start_year} to {end_year}",
                    "title": title,
                    "metadata": {
                        "dataset": dataset,
                        "country": country,
                        "years": [data_item["year"] for data_item in sorted(data_series, key=lambda x: x["year"])],
                        "start_year": start_year,
                        "end_year": end_year
                    }
                }
            }
        )
        
        # Also include the original timeline display instruction for compatibility
        timeline_instruct = MapBoxInstruction(
            action=MapBoxActions.DISPLAY_TIMELINE,
            data={
                "timeline_gif_url": gif_url,  # Direct GIF URL with cache buster
                "timeline_iframe_url": html_url, # HTML page URL that displays the GIF
                "dataset": dataset,
                "country": country,
                "years": [data_item["year"] for data_item in sorted(data_series, key=lambda x: x["year"])],
                "title": title
            }
        )
        
        # Add the instructions to frontend actions
        if "frontend_actions" not in state:
            state["frontend_actions"] = []
        
        # Add both instructions to support both display methods
        state["frontend_actions"].append(media_instruction)
        state["frontend_actions"].append(timeline_instruct)
        
        # Add the response message as a normal AI message
        state["messages"].append(AIMessage(content=response_message))
        
        return {"messages": state["messages"], "frontend_actions": state["frontend_actions"]}


def is_more_instructions(state: GraphState) -> Literal["chat_agent", "instructions"]:
    """Returns 'instructions' if there are more instructions or 'chat_agent' if there are no more instructions."""
    if state.get("instructions_list") and len(state["instructions_list"]) > 0:
        # Still have more instructions to process, continue with the instructions node
        print(
            f"More instructions to process: {len(state['instructions_list'])} remaining"
        )
        return "instructions"

    # No more instructions, return the final state with messages for the chat agent
    print("No more instructions to process, continuing to chat agent")
    return "chat_agent"
