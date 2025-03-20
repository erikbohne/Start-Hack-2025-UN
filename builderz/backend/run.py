import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

if __name__ == "__main__":
    # Make sure GROQ_API_KEY is set
    if "GROQ_API_KEY" not in os.environ:
        print("Warning: GROQ_API_KEY environment variable is not set.")
        print("Please set it in your .env file or environment variables.")
    
    print("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 