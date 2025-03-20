from graphs.GeoChatAgent.utils.state import GraphState
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize the LLM (defined at top level as recommended)
llm = ChatGroq(
    model_name="llama3-70b-8192",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0,
)


def chat_agent(state: GraphState):
    return {"messages": llm.with_config(tags=["answer"]).invoke(state["messages"])}