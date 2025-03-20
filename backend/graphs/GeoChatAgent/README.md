# GeoChatAgent

A graph-based agent that uses Groq to understand user questions and provide conversational responses while integrating with MapBox for geospatial data visualization.

## Architecture

The GeoChatAgent is structured as a graph with the following components:

1. **Intent Recognition Node**
   - Analyzes user input to determine if they're requesting geospatial data
   - Extracts key parameters: dataset type, location, time period

2. **Data Lookup Node**
   - Maps natural language requests to available geospatial files
   - Supports multiple datasets (Population, Precipitation, Vegetation)
   - Handles both single-year and multi-year requests

3. **Response Generation Node**
   - Creates contextual responses based on available data
   - Streams responses back to the user in natural language
   - Includes appropriate GeoJSON files for MapBox visualization

## Implementation Plan

1. Create core `GeoChatGraph` class that:
   - Processes incoming chat messages
   - Extracts intents and parameters using the LLM
   - Maps requests to available GeoJSON files
   - Generates appropriate responses

2. Implement file lookup logic that:
   - Handles different dataset types
   - Supports various geographical regions
   - Manages time-series data requests

3. Develop a response formatting system that:
   - Provides accurate, helpful information
   - Explains data being displayed
   - Formats GeoJSON files for MapBox compatibility

## Usage

Example queries:

```
"Rainfall data from assaba 2022 to 2024"
"Population density in assaba for 2020"
"Vegetation productivity data for assaba from 2015 to 2020"
```

## Response Format

The agent returns:

```json
{
  "ai_message": "You will now have the rainfall data from Assaba from 2022 to 2024",
  "geojson_files": [
    "filename.geojson",
    "filename.geojson"
  ]
}
```

Or for conversational responses without geospatial data:

```json
{
  "ai_message": "Hi, how are you."
}
```

## Integration

The GeoChatAgent integrates with:
- Frontend chat interface for user interactions
- MapBox for geospatial data visualization
- Backend data services for file lookup and access