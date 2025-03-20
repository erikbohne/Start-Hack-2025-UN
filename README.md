# Start-Hack-2025-UN: Interactive Map with AI

## Features

This project is an interactive mapping application with AI chat assistance, focused on visualizing UN environmental and population data for Africa.

Key features:
- Interactive map showing population density and precipitation data
- AI chat agent that can answer questions and control the map
- Time-based data visualization with animation controls
- 2D/3D view toggle
- Data filtering controls

## Environment Setup

### Frontend Environment Variables
1. Navigate to the `frontend` directory
2. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
3. Fill in the environment variables:
   - `GROQ_API_KEY`: Get your API key from [Groq](https://console.groq.com)
     - Required for the GeoChatAgent to process natural language queries
     - Uses the llama3-70b-8192 model for optimal performance
   - `NEXT_PUBLIC_MAPBOX_TOKEN`: Get your token from [Mapbox](https://account.mapbox.com/access-tokens/)
     - Required for displaying interactive maps and geospatial data

### Backend Environment Variables
1. Navigate to the `backend` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Configure the variables:
   - `DATASET_PATH`: Path to the directory containing the geospatial data
     - Default value: "vectorized/"
     - Expected directory structure:
       ```
       vectorized/
       ├── Africa/
           ├── PopDensity/
           │   ├── Burkina_Faso/
           │   ├── Chad/
           │   ├── Mali/
           │   ├── Mauritania/
           │   ├── Niger/
           │   ├── Senegal/
           │   └── Sudan/
           └── Precipitation/
               ├── Burkina_Faso/
               ├── Chad/
               ├── Mali/
               ├── Mauritania/
               ├── Niger/
               ├── Senegal/
               └── Sudan/
       ```
     - File naming conventions:
       - Population Density: `{country_code}_pd_{year}_1km_UNadj.geojson`
       - Precipitation: `Precipitation_{country_name}_{year}.geojson`

**Note**: Never commit your actual `.env` or `.env.local` files to version control. They contain sensitive information and should be kept private.

## Map-Chat Integration

The map and chat components are integrated via a Context API that allows:

1. **Bidirectional Communication**: The AI chat can access the map's current state and control its functions
2. **Contextual Awareness**: The AI is provided with current map state (visible year, datasets, 3D mode, etc.)
3. **Direct Map Control**: The AI can issue commands to manipulate the map, such as:
   - Centering the map on specific locations
   - Setting zoom levels
   - Adding GeoJSON data to the map
   - Controlling time animation
   - Toggling 3D/2D mode
   - Changing dataset thresholds

### Implementation Details

#### MapContext Architecture

The application wraps components in a `MapContext` provider that shares:
- Map instance and references
- Current state (year, datasets, rendering mode)
- Control functions
- Animation state
- Data references and thresholds

#### Chat-Map Instruction Pipeline

1. **Frontend to Backend**:
   - Chat messages include the current map state
   - Backend uses this context to understand user requests

2. **Backend to Frontend**:
   - Text responses for user queries
   - Structured instruction format for map control
   - Instructions streamed with special markers

3. **Instruction Processing**:
   - Frontend parses instruction markers in the stream
   - Instructions are processed to manipulate the map
   - Users see confirmation messages for map actions

### Technical Notes

The streaming and instruction handling mechanism works as follows:

1. The frontend sends chat messages along with map state to the `/chat/stream` endpoint
2. The backend (LangGraph) processes the request and can include map instructions in the stream
3. Instructions are marked with the prefix `INSTRUCTION:` followed by JSON data
4. The frontend parses the stream and extracts these instructions, processing them separately
5. Actions performed display feedback to the user as special message types

Two types of instructions are supported:
- Mapbox native actions (SET_CENTER, SET_ZOOM, SET_GEOJSON)
- Custom map actions (toggle3DMode, changeYear, toggleAnimation, etc.)

#### LLM Integration Notes

The backend uses Groq's LLama3-70B model for natural language processing. Some important implementation details:

1. **Single System Message**: Groq only supports a single system message in the input. We handle this by:
   - Storing map context in the graph state
   - Incorporating map context into each system message
   - Using different system messages for different node functions

2. **Map State Context**: When the frontend sends map state:
   - It's formatted into a readable description (current view mode, year, datasets)
   - This context is passed to each LLM call to provide situational awareness
   - The model can understand what's currently displayed and adjust suggestions accordingly

### Error Handling

The system includes robust error handling:
- JSON parsing errors for instructions
- Invalid parameter detection
- Fallbacks for when map actions can't be completed

## Starting the Application

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

## Dependencies

- Frontend: Next.js, Mapbox GL, React
- Backend: FastAPI, LangGraph, Groq