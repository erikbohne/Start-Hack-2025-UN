# START HACK 2025 - Builderz Project

Welcome to our project repository for START HACK 2025! This project is developed in collaboration with several industry-leading partners who have provided exciting challenges and opportunities for innovation.

## 🤝 Case Partners

### Kanton St.Gallen
The Canton of St.Gallen is one of Switzerland's leading regions in digital transformation and innovation. As a government entity, they are committed to leveraging technology to improve public services and citizen engagement, making them a crucial partner in driving digital innovation in the public sector.

### Virgin
Virgin is a global brand synonymous with innovation and disruption across multiple industries. Known for their forward-thinking approach and customer-centric solutions, Virgin brings their expertise in transforming traditional markets through technology and creative thinking.

### Zukunft-Fabrik 2050 (Powered by HSG Alumni)
A future-oriented initiative backed by HSG Alumni, Zukunft-Fabrik 2050 focuses on preparing for the challenges and opportunities of tomorrow. This think tank combines academic excellence with practical industry experience to shape the future of work and innovation.

### Six
SIX is Switzerland's principal financial market infrastructure operator, providing essential services in securities, payment transactions, and financial information. They are at the forefront of financial technology innovation and digital transformation in the financial sector.

### Syngenta
Syngenta is a global leader in agricultural science and technology, focused on improving global food security through innovative crop solutions. Their commitment to sustainable agriculture and digital farming makes them a key player in the future of food production.

### BELIMO
BELIMO is a market leader in the development and production of actuator solutions for controlling heating, ventilation, and air conditioning systems. They are pioneering smart building technologies and energy efficiency solutions.

### Helbling
Helbling is an engineering and consulting firm that specializes in product innovation, engineering services, and business consulting. Their expertise spans multiple industries, making them a valuable partner in technological innovation and development.

### G20 Global Land Initiative
The G20 Global Land Initiative, in collaboration with the United Nations Convention to Combat Desertification, works on sustainable land management and restoration. This partnership brings a crucial environmental and sustainability perspective to the hackathon.

## 🚀 Project Overview

This repository contains our innovative solution developed during START HACK 2025. Our project aims to address [specific challenge/goal to be added] while leveraging cutting-edge technologies and methodologies.

## 🛠️ Technologies Used

- Python
- LangChain
- Ollama (Local LLM)
- Language Model Prompting

## 🏗️ Setup Instructions

### Python-Ollama Integration

This component provides a Python integration for calling local Ollama models using LangChain.

#### Prerequisites

- Python 3.8+
- [Ollama](https://ollama.ai/) installed and running locally
- A compatible Ollama model (default: llama3)

#### Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy the environment file and edit as needed:
   ```bash
   cp .env.example .env
   ```

#### Usage

Run the example script to see the client in action:

```bash
python example.py
```

#### Example code

```python
from src.ollama_client import OllamaClient
from src.prompt_templates import CODE_GENERATION_TEMPLATE, DEFAULT_SYSTEM_PROMPT

# Initialize the client
client = OllamaClient(model_name="llama3")

# Basic usage
response = client.generate_response("Explain quantum computing in simple terms.")
print(response)

# Using a template
code_response = client.generate_with_template(
    CODE_GENERATION_TEMPLATE,
    system_prompt=DEFAULT_SYSTEM_PROMPT,
    problem_description="Create a function to calculate prime numbers",
    language="Python"
)
print(code_response)
```

## 👥 Team Members

[To be added]

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
Built with ❤️ at START HACK 2025

# Geospatial Data Visualization with LangGraph

This project provides a natural language interface to geospatial data from Mauritania, allowing users to request and visualize different types of data through simple text queries.

## Architecture

The system uses:
- **LangGraph** for orchestrating the processing workflow
- **LangChain + Groq** for natural language processing
- **FastAPI** for exposing the endpoints
- **Matplotlib/PIL** for visualization

## Available Data Types

The system can process and visualize the following types of data:

### 1. Precipitation Data (2010-2023)
- Annual precipitation measurements
- Files named in format `{year}R.tif`

### 2. Land Cover Data (2010-2023)
- MODIS Land Cover Classification
- Files named in format `{year}LCT.tif`

### 3. Primary Production (GPP) Data (2010-2021)
- Gross Primary Production (kg C/m²/year)
- Files named in format `{year}_GP.tif`

### 4. Population Density Data (2010, 2015, 2020)
- Population density measurements for the Assaba region

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd builderz
```

2. Set up your environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

3. Add your Groq API key to `.env`:
```
GROQ_API_KEY=your_groq_api_key_here
```

4. Run the backend:
```bash
cd backend
python run.py
```

## API Endpoints

### 1. Natural Language Query
`POST /query`

Process a natural language query about geospatial data.

**Request Body:**
```json
{
  "query": "Show me the rainfall data for Assaba in 2020"
}
```

**Response:**
```json
{
  "response": "I've created a visualization of the geospatial data for assaba in 2020. The visualization shows data from: Climate_Precipitation_Data. You can view it at /visualizations/assaba_2020_1710892345.png."
}
```

### 2. Direct TIF Access
`GET /fetch-tif`

Fetch a preprocessed multi-band TIF file directly.

**Query Parameters:**
- `region` (string): Region name (currently only "assaba" is supported)
- `year` (integer): Year for the data
- `datasets` (array): List of dataset names

**Example:**
```
GET /fetch-tif?region=assaba&year=2020&datasets=Climate_Precipitation_Data
```

## Example Queries

1. "Show me the rainfall data for Assaba in 2020"
2. "Visualize the vegetation productivity in Assaba for 2018"
3. "Create a map of land cover types in Assaba for 2015"
4. "Show population density data for Assaba in 2020"

## Architecture Details

The system uses a LangGraph workflow with the following nodes:

1. **Query Parser**: Extracts parameters from natural language
2. **Data Retriever**: Fetches the appropriate geospatial data
3. **Visualizer**: Creates visualizations for the requested data
4. **Response Generator**: Formats the response to the user

The workflow is dynamically adjusted based on whether the user is requesting data or visualization.

## Extending the System

To add support for new data types:
1. Add the data files to the appropriate directory in `/data`
2. Update the data loading logic in `processing.py` 
3. Add appropriate visualization support in `geo_langgraph.py`