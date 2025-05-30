from typing import List, Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
import asyncio # For _arun example

# --- 1. Pydantic Models for Tool Input and Output ---

class RagToolInput(BaseModel):
    """Input arguments for the EmailContextRetrieverTool."""
    queries: List[str] = Field(..., description="A list of natural language queries to search for relevant email context.")
    top_k: Optional[int] = Field(3, description="The maximum number of relevant email chunks to retrieve. Defaults to 3.")
    user_id: Optional[str] = Field(None, description="Optional user ID to scope the search to a specific user's emails.")
    # date_filter_start: Optional[str] = Field(None, description="Optional start date (YYYY-MM-DD) to filter emails.")
    # date_filter_end: Optional[str] = Field(None, description="Optional end date (YYYY-MM-DD) to filter emails.")

class RagToolOutputItem(BaseModel):
    """Schema for an individual item returned by the RAG tool."""
    chunk: str = Field(..., description="The actual text chunk retrieved from an email or document.")
    source: Optional[str] = Field(None, description="Identifier for the source email or document (e.g., message ID, document name).")
    date: Optional[str] = Field(None, description="Date of the source email or document (e.g., YYYY-MM-DD).")
    score: Optional[float] = Field(None, description="Relevance score of the chunk to the query (if applicable).")
    # metadata: Optional[dict] = Field(default_factory=dict, description="Other relevant metadata, e.g., sender, subject.")


# --- 2. EmailContextRetrieverTool Class ---

class EmailContextRetrieverTool(BaseTool):
    """
    A tool that simulates retrieving relevant context from a user's emails or related documents
    based on input queries. In a real implementation, this tool would query a vector database
    or other retrieval system.
    """
    name: str = "email_context_retriever"
    description: str = (
        "Useful for fetching relevant snippets or summaries from a user's emails or documents "
        "when you need more context to answer a question or perform a task. "
        "Input should be a list of search queries. Optionally, specify 'top_k' for number of results "
        "and 'user_id' to scope the search."
    )
    args_schema: Type[BaseModel] = RagToolInput
    return_direct: bool = False # Set to True if the agent should return the tool's output directly to the user.
                               # False if the agent should use the output for further processing.

    def _run(
        self,
        queries: List[str],
        top_k: Optional[int] = 3,
        user_id: Optional[str] = None,
        # date_filter_start: Optional[str] = None, # Example of how more args could be added
        # date_filter_end: Optional[str] = None,   # based on RagToolInput
        **kwargs # To catch any other unexpected args LangChain might pass
    ) -> List[dict]: # Return a list of dictionaries matching RagToolOutputItem schema
        """
        Simulates retrieving email context.
        In a real RAG pipeline, this would involve:
        1. Generating embeddings for the queries.
        2. Querying a vector store (e.g., FAISS, Pinecone, ChromaDB) containing email chunks.
        3. Optionally filtering by user_id, dates, etc.
        4. Formatting and returning the top_k results.
        """
        print("\n--- EmailContextRetrieverTool (_run) ---")
        print(f"Received queries: {queries}")
        print(f"Received top_k: {top_k}")
        print(f"Received user_id: {user_id}")
        # print(f"Received date_filter_start: {date_filter_start}")
        # print(f"Received date_filter_end: {date_filter_end}")
        print(f"Received kwargs: {kwargs}")


        # Hardcoded example results simulating a RAG pipeline
        results = []
        for i, query in enumerate(queries):
            if "budget" in query.lower():
                results.append(
                    RagToolOutputItem(
                        chunk="The Q3 budget proposal needs to be finalized by next Friday. Key stakeholders are Alice and Bob from Finance.",
                        source="Email Message ID: msg_12345xyz",
                        date="2024-07-15",
                        score=0.85 + (i * 0.01) # Slight variation for multiple queries
                    ).model_dump() # Use .dict() for Pydantic V1
                )
            if "meeting" in query.lower() or "schedule" in query.lower():
                results.append(
                    RagToolOutputItem(
                        chunk="Reminder: Project Phoenix sync meeting scheduled for Wednesday at 10 AM PST. Please confirm your attendance.",
                        source="Calendar Event ID: cal_event_abc",
                        date="2024-07-17",
                        score=0.90 + (i * 0.01)
                    ).model_dump()
                )
        
        if not results:
            results.append(
                 RagToolOutputItem(
                    chunk="No specific documents found for your exact query, but general company policy states all reports are due end of month.",
                    source="Company Policy Document: policy_v3.pdf",
                    date="2023-01-01",
                    score=0.30
                ).model_dump()
            )
            
        # Ensure we respect top_k, even with multiple queries potentially generating many results
        # This is a simplified top_k handling for the mock. A real system would do this more intelligently.
        final_results = results[:top_k]
        
        print(f"Returning {len(final_results)} simulated results.")
        return final_results

    async def _arun(
        self,
        queries: List[str],
        top_k: Optional[int] = 3,
        user_id: Optional[str] = None,
        # date_filter_start: Optional[str] = None,
        # date_filter_end: Optional[str] = None,
        **kwargs
    ) -> List[dict]:
        """
        Asynchronous version of the email context retrieval.
        For this simulation, it can call the synchronous version or be implemented with async primitives if needed.
        """
        print("\n--- EmailContextRetrieverTool (_arun) ---")
        # For many I/O bound operations (like calling a real DB or API),
        # you'd use async libraries here.
        # For this simulation, we can run the sync method in a thread pool executor
        # or just call it directly if it's not truly blocking in its mocked form.
        
        # Simple approach: run the synchronous method in a thread pool
        # loop = asyncio.get_event_loop()
        # return await loop.run_in_executor(None, self._run, queries, top_k, user_id, date_filter_start, date_filter_end, **kwargs)
        
        # Simpler mock: just call the sync version as it's not really blocking
        print(f"Async call delegating to sync _run method for simulation.")
        return self._run(queries=queries, top_k=top_k, user_id=user_id, **kwargs)

# --- Example Usage ---
if __name__ == "__main__":
    print("Testing EmailContextRetrieverTool...\n")

    # Instantiate the tool
    retriever_tool = EmailContextRetrieverTool()

    print(f"Tool Name: {retriever_tool.name}")
    print(f"Tool Description: {retriever_tool.description}")
    print(f"Tool Args Schema: {retriever_tool.args_schema.model_json_schema(indent=2)}") # .schema_json() for Pydantic V1

    # Example 1: Single query
    print("\n--- Test Case 1: Single Query ---")
    input_args_1 = {"queries": ["latest update on project budget"], "user_id": "user123"}
    # LangChain typically handles passing these as keyword arguments from the Pydantic model
    # For direct testing, we can simulate this by unpacking or passing directly
    # result_1 = retriever_tool.run(input_args_1) # For LangChain invocation
    result_1 = retriever_tool._run(**RagToolInput(**input_args_1).model_dump()) # Direct call for testing _run
    print("Result 1:")
    for item in result_1:
        print(f"  - Chunk: {item['chunk'][:50]}...")
        print(f"    Source: {item['source']}, Date: {item['date']}, Score: {item.get('score')}")

    # Example 2: Multiple queries and different top_k
    print("\n--- Test Case 2: Multiple Queries, Different Top_K ---")
    input_args_2 = RagToolInput(
        queries=["meeting schedule for next week", "action items from yesterday's sync"],
        top_k=2,
        user_id="user456"
    )
    # result_2 = retriever_tool.run(input_args_2.model_dump()) # For LangChain invocation
    result_2 = retriever_tool._run(**input_args_2.model_dump()) # Direct call
    print("Result 2:")
    for item in result_2:
        print(f"  - Chunk: {item['chunk'][:50]}...")
        print(f"    Source: {item['source']}, Date: {item['date']}, Score: {item.get('score')}")

    # Example 3: Query that might not hit specific mock data
    print("\n--- Test Case 3: General Query ---")
    input_args_3 = {"queries": ["company holidays"], "top_k": 1}
    result_3 = retriever_tool._run(**RagToolInput(**input_args_3).model_dump())
    print("Result 3:")
    for item in result_3:
        print(f"  - Chunk: {item['chunk'][:50]}...")
        print(f"    Source: {item['source']}, Date: {item['date']}, Score: {item.get('score')}")

    # Example 4: Async run
    print("\n--- Test Case 4: Async Run ---")
    async def main_async_test():
        input_args_4 = {"queries": ["async budget query"], "user_id": "user_async"}
        # result_4 = await retriever_tool.arun(input_args_4) # For LangChain invocation
        result_4 = await retriever_tool._arun(**RagToolInput(**input_args_4).model_dump()) # Direct call
        print("Result 4 (async):")
        for item in result_4:
            print(f"  - Chunk: {item['chunk'][:50]}...")
            print(f"    Source: {item['source']}, Date: {item['date']}, Score: {item.get('score')}")

    asyncio.run(main_async_test())
```
