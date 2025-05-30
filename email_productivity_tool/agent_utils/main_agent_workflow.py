import asyncio
import os
from typing import Dict, Any
from dotenv import load_dotenv

# Import necessary components from other modules
from email_productivity_tool.agent_utils.email_analysis_agent import get_email_analysis_chain
from email_productivity_tool.agent_utils.structured_output_models import EmailAnalysis # Corrected import name
from email_productivity_tool.agent_utils.rag_tool import EmailContextRetrieverTool, RagToolInput, RagToolOutputItem
from email_productivity_tool.agent_utils.context_summarizer import get_context_summarization_chain

# Load environment variables (e.g., OPENAI_API_KEY)
load_dotenv()

async def process_email_with_agent(email_content: str, email_subject_for_context: str = "Not specified") -> Optional[EmailAnalysis]:
    """
    Processes a single email through an agentic workflow:
    1. Initial analysis (summary, entities, action items, etc.).
    2. Retrieves additional context using a RAG tool based on extracted keywords.
    3. Summarizes the retrieved context in relation to the email.
    4. Enriches the initial analysis with the context summary.
    """
    print(f"\n--- Starting Agent Workflow for Email (Subject: '{email_subject_for_context}') ---")

    # 1. Initial Email Analysis
    initial_analysis_output: Optional[EmailAnalysis] = None
    try:
        print("\nStep 1: Performing initial email analysis...")
        analysis_chain = get_email_analysis_chain()
        initial_analysis_output = await analysis_chain.ainvoke({"email_content": email_content})
        if not isinstance(initial_analysis_output, EmailAnalysis):
            print(f"Warning: Initial analysis did not return an EmailAnalysis object. Got: {type(initial_analysis_output)}")
            # Depending on strictness, you might want to return None or raise an error here
            # For now, we'll try to proceed if it's dictionary-like and can be parsed,
            # but PydanticOutputParser should handle this.
            if isinstance(initial_analysis_output, dict):
                initial_analysis_output = EmailAnalysis(**initial_analysis_output)
            else:
                print("Error: Could not convert initial analysis output to EmailAnalysis model.")
                return None # Cannot proceed without a valid initial analysis

        print("Initial analysis successful.")
        # print(f"Initial Summary: {initial_analysis_output.summary}")
    except Exception as e:
        print(f"Error during initial email analysis: {e}")
        return None # Cannot proceed if initial analysis fails

    # Initialize the field that will be updated
    initial_analysis_output.retrieved_context_summary = "No relevant context retrieved or RAG not triggered."

    # 2. Context Retrieval (RAG)
    keywords_for_rag: List[str] = []
    if initial_analysis_output.key_topics:
        keywords_for_rag = [topic.topic_name for topic in initial_analysis_output.key_topics[:3]] # Use top 3 topics
    
    if not keywords_for_rag and initial_analysis_output.summary: # Fallback if no key topics
        # Simple keyword extraction from summary (can be improved)
        potential_keywords = initial_analysis_output.summary.split()[:10] # first 10 words
        keywords_for_rag = [kw for kw in potential_keywords if len(kw) > 4]


    if keywords_for_rag:
        print(f"\nStep 2: Retrieving context with RAG tool for keywords: {keywords_for_rag}...")
        retriever_tool = EmailContextRetrieverTool()
        rag_input_args = RagToolInput(queries=keywords_for_rag, top_k=2) # Request 2 chunks

        retrieved_items_dicts: Optional[List[Dict[str, Any]]] = None
        try:
            # Use arun for async call
            retrieved_items_dicts = await retriever_tool.arun(
                queries=rag_input_args.queries,
                top_k=rag_input_args.top_k,
                user_id="simulated_user_for_workflow" # Example user_id
            )
            # Convert dicts to RagToolOutputItem if needed, though _arun returns list of dicts
            # For this example, we'll assume the dict structure matches RagToolOutputItem
            print(f"RAG tool returned {len(retrieved_items_dicts) if retrieved_items_dicts else 0} items.")

        except Exception as e:
            print(f"Error during RAG tool execution: {e}")
            retrieved_items_dicts = None

        # 3. Context Summarization
        if retrieved_items_dicts and len(retrieved_items_dicts) > 0:
            print("\nStep 3: Summarizing retrieved context...")
            # Ensure items are actual RagToolOutputItem or compatible dicts
            valid_chunks = [RagToolOutputItem(**item).chunk for item in retrieved_items_dicts if isinstance(item, dict) and 'chunk' in item]
            
            if not valid_chunks:
                print("No valid text chunks found in RAG output to summarize.")
                initial_analysis_output.retrieved_context_summary = "Retrieved context items lacked valid text content."
            else:
                concatenated_chunks = "\n---\n".join(valid_chunks)
                # print(f"Concatenated chunks for summarization:\n{concatenated_chunks}")

                summarizer_chain = get_context_summarization_chain()
                try:
                    context_summary = await summarizer_chain.ainvoke({
                        "original_email_subject": email_subject_for_context, # Passed as arg to main func
                        "original_email_summary_of_request": initial_analysis_output.summary,
                        "retrieved_context_chunks_concatenated": concatenated_chunks
                    })
                    print(f"Context summarization successful: {context_summary}")
                    initial_analysis_output.retrieved_context_summary = context_summary
                except Exception as e:
                    print(f"Error during context summarization: {e}")
                    initial_analysis_output.retrieved_context_summary = "Failed to summarize retrieved context due to an error."
        elif retrieved_items_dicts is not None and len(retrieved_items_dicts) == 0:
             print("RAG tool ran but found no relevant items.")
             initial_analysis_output.retrieved_context_summary = "No specific context items were found by the RAG tool for the extracted keywords."
        else: # implies retrieved_items_dicts is None due to error or no keywords
            print("Skipping context summarization as no context items were retrieved or RAG tool failed.")
            # The default message set earlier will persist if RAG didn't run due to no keywords.
            if retrieved_items_dicts is None and keywords_for_rag : # RAG failed for some reason
                 initial_analysis_output.retrieved_context_summary = "Failed to retrieve context due to an error in the RAG tool."


    else:
        print("\nStep 2 & 3: Skipping RAG and Context Summarization as no keywords were extracted for RAG.")
        # Default message "No relevant context retrieved or RAG not triggered." is already set.

    print("\n--- Agent Workflow Completed ---")
    return initial_analysis_output


if __name__ == '__main__':
    # Ensure API key is available for the LLMs
    if not os.getenv("OPENAI_API_KEY"):
        print("CRITICAL: OPENAI_API_KEY is not set. The agent workflow requires this to interact with OpenAI models.")
        print("Please set it in your environment or .env file.")
        # exit() # Uncomment to hard stop if key is missing

    sample_email_subject = "Urgent: Update on Project Phoenix Budget and Next Week's Meeting"
    sample_email_body_content = """
    Hi Team,

    Following up on our discussion yesterday regarding Project Phoenix.
    The client has requested a revised budget proposal by end of day tomorrow, August 10th, 2024. This is a critical deadline.
    Sarah (sarah@example.com), can you please take the lead on incorporating the new figures we discussed?
    John needs to approve it before it goes out.

    Also, a reminder about the all-hands meeting scheduled for next Tuesday morning (August 13th, 2024, around 9:30 AM PST) to discuss the overall project timeline.
    We need to decide on the final deployment date. Please come prepared with your team's estimates.
    The agenda was sent out by Alice (alice.wonder@example.com) from AdminCorp. Let me know if you haven't received the "ProjectPhoenix_Agenda_Aug2024.pdf".

    Thanks,
    Manager Mike (mike.manager@example.com)
    Innovate Solutions Ltd.
    """

    print("Running main agent workflow...")
    
    # It's an async function, so we use asyncio.run()
    final_output: Optional[EmailAnalysis] = asyncio.run(
        process_email_with_agent(
            email_content=sample_email_body_content,
            email_subject_for_context=sample_email_subject
        )
    )

    if final_output:
        print("\n\n--- Final Enriched Email Analysis Output ---")
        # For Pydantic V2, use model_dump_json. For V1, use .json()
        if hasattr(final_output, 'model_dump_json'):
            print(final_output.model_dump_json(indent=2))
        else:
            print(final_output.json(indent=2))
    else:
        print("\nAgent workflow did not produce a final output.")

```
