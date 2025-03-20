# How we structure Langgraph agents

## Agents
The following agents are available and will contain their own `README.md`:
- [FindSDLFile](./FindSDLFile/README.md) - Locates relevant SDL files in project directories
- [ReadSDLFile](./ReadSDLFile/README.md) - Extracts and processes data from SDL files
- [StartupRappagent](./StartupRappagent/README.md) - Orchestrates the documentation workflow

## Folder structure
Each agent will have its own folder with the following structure:

```bash
ExampleAgent
├── README.md
├── agent.py
└── utils
    ├── nodes.py
    ├── state.py
    ├── models.py
    ├── routers.py
    └── tools.py
```

Each file has a specific purpose and will be discussed below.

### `README.md`
This file will contain information about the agent, how it works, and how to use it.

### `agent.py`
It is in `agent.py` the agent workflow is constructed. Nodes, routers, state and tools are imported and constructed into a compiled graph-workflow.

To ensure correct Langsmith tracing and support streaming of the agent, there should also be a function that can be imported elsewhere to run the agent.

### `utils/nodes.py`
This file contains the nodes that the agent will use. Thus it should only contain functions that takes state as parameter and returns an updated state.

Routers should be kept in a separate file.

LLM initializations should happen top level in the node file.

### `utils/state.py`
This file should only contain the `GraphState`. Typically we have used `TypedDict` from `typing` as the state type. But `BaseModel` from `pydantic` should be considered in future agents.

Other classes that may be defined in this file are `InputState` and `OutputState`. These features are not yet used on our applications, but should be considered for future agents.

### `utils/models.py`
Most agents use structured output or defined data structures. These should be defined in `models.py`. This file should only contain pydantic models.

**TIP:** Use `Field` from `pydantic` to define the fields of the model. The description in the `Field` is read when using `.with_structured_output()` and saves a lot of unecassary guiding in the prompt.

### `utils/routers.py`
For conditional edges, the routers are defined in this file. These are functions that take the `GraphState` as input and typically returns a `Literal` or `str` that is the name of the next node.

It can also return a `Enum` or other types that is used to define the next node.

### `utils/tools.py`
Tools are defined and described in this file. When creating tools use the `@tool` decorator to ensure that the tool is registered in the agent.

A list of tools should be defined in this file and it will be imported in the `agent.py` and `nodes.py` files. This may look like this:

```python
@tool
def add(a: int, b: int) -> int:
    return a + b

@tool
def subtract(a: int, b: int) -> int:
    return a - b

add_tool = [add]
all_tools = [add, subtract]
```
