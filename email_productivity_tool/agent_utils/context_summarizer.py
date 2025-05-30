import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# --- 1. Context Summarization Chain Setup ---

CONTEXT_SUMMARIZATION_PROMPT_STRING = """
You are an AI assistant whose task is to summarize retrieved context relevant to an original email query.

You will be given:
1. The subject of the original email: `{{original_email_subject}}`
2. A summary of the request or main point of the original email: `{{original_email_summary_of_request}}`
3. A collection of retrieved context chunks: `{{retrieved_context_chunks_concatenated}}`

Your goal is to:
- Read the `retrieved_context_chunks_concatenated`.
- Produce a concise summary (ideally 2-3 sentences, maximum 4 sentences) of this retrieved context.
- This summary should specifically focus on the information within the retrieved context that is most relevant to the `original_email_subject` and the `original_email_summary_of_request`.
- If the `retrieved_context_chunks_concatenated` is empty, explicitly state: "No additional context was provided."
- If the `retrieved_context_chunks_concatenated` does not seem relevant to the original email's subject or summary of request, explicitly state: "The provided context does not appear to be relevant to the original email query."
- Do not add any conversational fluff. Output only the summary or the specific statements mentioned above.

Summary of retrieved context:
"""

def get_context_summarization_chain():
    """
    Sets up and returns a LangChain runnable for summarizing retrieved context
    in relation to an original email query.
    """
    load_dotenv()

    if not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not found in environment for context summarizer. The LLM call might fail.")

    # a. Initialize LLM
    llm = ChatOpenAI(
        model="gpt-3.5-turbo", # Can use gpt-4o for more nuance if needed
        temperature=0.3, # Slightly higher for summarization but still mostly factual
    )

    # b. Create ChatPromptTemplate
    prompt_template = ChatPromptTemplate.from_template(CONTEXT_SUMMARIZATION_PROMPT_STRING)

    # c. Initialize StrOutputParser
    output_parser = StrOutputParser()

    # d. Compose the LCEL chain
    chain = prompt_template | llm | output_parser
    
    return chain

# --- Example Usage ---
if __name__ == "__main__":
    print("Setting up Context Summarization Chain...")

    if not os.getenv("OPENAI_API_KEY"):
         print("OPENAI_API_KEY is not set. Please set it in your environment or .env file for this example to run.")
         # exit() # Or handle gracefully

    context_chain = get_context_summarization_chain()
    print("Context Summarization Chain Initialized.")

    print("\n--- Test Case 1: Relevant Context ---")
    sample_subject_1 = "Inquiry about Q3 Budget Proposal"
    sample_summary_of_request_1 = "The user is asking for the status of the Q3 budget proposal and when it will be finalized."
    sample_retrieved_context_1 = (
        "Chunk 1 (from msg_123): The Q3 budget proposal needs to be finalized by next Friday. Key stakeholders are Alice and Bob from Finance. "
        "Chunk 2 (from doc_abc): Current draft of Q3 budget shows a 5% increase in marketing spend. Awaiting final approval from CFO."
    )
    
    if os.getenv("OPENAI_API_KEY"):
        try:
            summary_1 = context_chain.invoke({
                "original_email_subject": sample_subject_1,
                "original_email_summary_of_request": sample_summary_of_request_1,
                "retrieved_context_chunks_concatenated": sample_retrieved_context_1
            })
            print(f"Summarized Context 1:\n{summary_1}")
        except Exception as e:
            print(f"Error during Test Case 1 invocation: {e}")
    else:
        print("Skipping Test Case 1 LLM call as API key is not available.")

    print("\n--- Test Case 2: No Context Provided ---")
    sample_subject_2 = "Follow-up on client meeting"
    sample_summary_of_request_2 = "User wants to know the action items from the recent client X meeting."
    sample_retrieved_context_2 = "" # Empty context
    
    if os.getenv("OPENAI_API_KEY"):
        try:
            summary_2 = context_chain.invoke({
                "original_email_subject": sample_subject_2,
                "original_email_summary_of_request": sample_summary_of_request_2,
                "retrieved_context_chunks_concatenated": sample_retrieved_context_2
            })
            print(f"Summarized Context 2:\n{summary_2}")
        except Exception as e:
            print(f"Error during Test Case 2 invocation: {e}")
    else:
        print("Skipping Test Case 2 LLM call as API key is not available.")

    print("\n--- Test Case 3: Irrelevant Context ---")
    sample_subject_3 = "Regarding new office location"
    sample_summary_of_request_3 = "User is asking about the new office location and move-in dates."
    sample_retrieved_context_3 = (
        "Chunk 1 (from policy_doc): Company policy states that all employees must complete cybersecurity training annually. "
        "Chunk 2 (from news_feed): The company cafeteria will feature a new menu next month."
    )

    if os.getenv("OPENAI_API_KEY"):
        try:
            summary_3 = context_chain.invoke({
                "original_email_subject": sample_subject_3,
                "original_email_summary_of_request": sample_summary_of_request_3,
                "retrieved_context_chunks_concatenated": sample_retrieved_context_3
            })
            print(f"Summarized Context 3:\n{summary_3}")
        except Exception as e:
            print(f"Error during Test Case 3 invocation: {e}")
    else:
        print("Skipping Test Case 3 LLM call as API key is not available.")
```
