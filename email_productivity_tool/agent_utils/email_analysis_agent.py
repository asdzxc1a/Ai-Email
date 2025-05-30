import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnablePassthrough

# Import the Pydantic models generated in Part 1
from email_productivity_tool.agent_utils.structured_output_models import (
    EmailAnalysis,
    PersonEntity,
    OrganizationEntity,
    LocationEntity,
    DateMention,
    ActionItem,
    Topic,
    Sentiment,
    MeetingReference,
    DocumentReference
)

# --- 1. Master Prompt String ---

# This prompt is designed to be highly detailed to guide the LLM.
# It references the Pydantic model structure implicitly through its detailed descriptions.

MASTER_PROMPT_STRING = """
You are an advanced AI assistant designed for detailed email analysis. Your task is to meticulously analyze the provided email content and extract structured information according to a specific JSON schema.

Please output a single JSON object that strictly adheres to the following structure and field descriptions. Do NOT output any text or explanation before or after the JSON object.

The main JSON object should represent an "EmailAnalysis".

Here are the detailed fields for "EmailAnalysis":

1.  **`summary` (string, required)**:
    *   Provide a concise, neutral summary of the entire email's content. Focus on the main purpose and key information.

2.  **`extracted_entities` (array of objects, optional)**:
    *   Identify key entities mentioned. Each object in this array can be a Person, Organization, or Location.
    *   **For each entity (base fields for all types)**:
        *   `name` (string, required): The name of the entity (e.g., "John Doe", "Acme Corp", "New York").
        *   `context` (string, optional): The surrounding text or phrase where the entity was found.
    *   **If the entity is a `PersonEntity`**:
        *   Include base fields (`name`, `context`).
        *   `email` (string, optional): Email address of the person, if mentioned (e.g., "john.doe@example.com").
        *   `role` (string, optional): Role or title (e.g., "Project Manager", "CEO").
    *   **If the entity is an `OrganizationEntity`**:
        *   Include base fields (`name`, `context`).
        *   `website` (string, optional): Website URL (e.g., "https://www.example.com").
        *   `industry` (string, optional): Industry (e.g., "Technology", "Finance").
    *   **If the entity is a `LocationEntity`**:
        *   Include base fields (`name`, `context`).
        *   `address` (string, optional): Full address.
        *   `type` (string, optional): Type of location (e.g., "City", "Office Building").
    *   Example: `[{"name": "Alice Wonderland", "role": "Lead Developer", "email": "alice@example.com", "context": "Alice mentioned the new feature"}, {"name": "Global Innovations Inc.", "industry": "Tech", "context": "Global Innovations Inc. is our partner"}]`

3.  **`action_items` (array of objects, optional)**:
    *   List any specific tasks, assignments, or action items mentioned.
    *   **For each `ActionItem` object**:
        *   `task` (string, required): Clear description of the action (e.g., "Prepare Q3 report", "Follow up with client").
        *   `assigned_to` (array of `PersonEntity` objects, optional): Who is responsible for the task. Use the `PersonEntity` structure described above.
        *   `due_date` (object, optional): Represents a `DateMention` for the deadline.
            *   `date_text` (string, required): The original text for the due date (e.g., "by next Friday", "end of day tomorrow", "2024-03-15").
            *   `start_date` (string, ISO 8601 datetime format, optional): The parsed start datetime (e.g., "2024-03-15T17:00:00Z"). If only a date is mentioned, use the beginning of that day.
            *   `end_date` (string, ISO 8601 datetime format, optional): The parsed end datetime if it's a range.
            *   `context` (string, optional): The surrounding text of the due date mention.
        *   `priority` (string, optional): Priority level. Must be one of: "high", "medium", "low".
        *   `context` (string, optional): The sentence or phrase from which the action item was extracted.
        *   `status` (string, optional, default "open"): Current status. Must be one of: "open", "in progress", "completed", "blocked".
    *   Example: `[{"task": "Submit the TPS reports", "assigned_to": [{"name": "Bob", "context":"Bob needs to submit"}], "due_date": {"date_text": "EOD Monday", "start_date": "2024-07-29T17:00:00Z"}, "priority": "high", "status": "open", "context": "Bob needs to submit the TPS reports by EOD Monday"}]`

4.  **`key_topics` (array of objects, optional)**:
    *   Identify the main topics or keywords.
    *   **For each `Topic` object**:
        *   `topic_name` (string, required): The topic or keyword (e.g., "budget approval", "marketing strategy").
        *   `relevance_score` (float, optional): A score from 0.0 to 1.0 indicating topic relevance.

5.  **`dates_mentioned` (array of objects, optional)**:
    *   List all significant dates or date ranges mentioned, not just for action items.
    *   **For each `DateMention` object**:
        *   `date_text` (string, required): Original text (e.g., "next week's meeting", "Q4 planning", "December 10th").
        *   `start_date` (string, ISO 8601 datetime format, optional): Parsed start datetime.
        *   `end_date` (string, ISO 8601 datetime format, optional): Parsed end datetime if a range.
        *   `context` (string, optional): Surrounding text.

6.  **`overall_sentiment` (object, optional)**:
    *   Analyze the overall sentiment of the email.
    *   **For the `Sentiment` object**:
        *   `polarity` (float, required): A score indicating positive/negative sentiment (e.g., from -1.0 to 1.0).
        *   `subjectivity` (float, optional): A score for how objective/subjective the text is (e.g., 0.0 to 1.0).
        *   `label` (string, required): Must be one of: "positive", "negative", "neutral".
        *   `context` (string, optional): Phrases that particularly indicate this sentiment.

7.  **`reply_suggestions` (array of strings, optional)**:
    *   Suggest 1-3 brief, relevant reply phrases or points based on the email's content and purpose.
    *   Example: `["Acknowledge receipt", "Confirm attendance", "Ask for clarification on point X"]`

8.  **`meeting_references` (array of objects, optional)**:
    *   Identify any references to potential or scheduled meetings.
    *   **For each `MeetingReference` object**:
        *   `occasion` (string, optional): Purpose of the meeting (e.g., "Project Kick-off", "Client Demo").
        *   `proposed_times` (array of `DateMention` objects, optional): List of proposed dates/times for the meeting. Use the `DateMention` structure.
        *   `participants` (array of `PersonEntity` objects, optional): Mentioned or implied participants. Use the `PersonEntity` structure.
        *   `location` (object, optional): Proposed location. Use the `LocationEntity` structure.
    *   Example: `[{"occasion": "Weekly Sync", "proposed_times": [{"date_text": "next Tuesday morning", "start_date": "2024-07-30T09:00:00Z"}], "participants": [{"name": "Team", "context":"for the whole team"}]}]`

9.  **`document_references` (array of objects, optional)**:
    *   Identify any references to documents.
    *   **For each `DocumentReference` object**:
        *   `document_name` (string, required): Name or title of the document (e.g., "Q3 Financial Report", "User Manual").
        *   `document_type` (string, optional): Type of document (e.g., "report", "slides", "spreadsheet").
        *   `link` (string, optional, HttpUrl format): URL link to the document, if provided.
        *   `context` (string, optional): Surrounding text where the document was mentioned.
    *   Example: `[{"document_name": "Onboarding Guide", "document_type": "guide", "link": "https://example.com/guide.pdf", "context": "Please review the Onboarding Guide"}]`

10. **`language` (string, optional)**:
    *   Detected language of the email text (e.g., "en", "es", "fr"). If unsure, omit.

11. **`urgency_score` (float, optional)**:
    *   A score from 0.0 (not urgent) to 1.0 (very urgent) indicating the perceived urgency. Consider deadlines, explicit requests for quick action, etc.

**Important Considerations for Dates:**
*   When parsing dates (`start_date`, `end_date`), always provide them in ISO 8601 format (e.g., "YYYY-MM-DDTHH:MM:SSZ" or "YYYY-MM-DD"). If time is not mentioned, assume a relevant time (e.g., start of workday for "next Monday" or end of workday if "by EOD Monday"). If timezone is not specified, assume UTC.
*   For `date_text`, always include the original text as it appeared in the email.

**General Instructions:**
*   If a field is marked optional and the information is not present or not applicable, omit the field entirely from the JSON output for that object. Do not use null values for optional fields unless the schema explicitly allows it (most optional fields here should be omitted if not applicable).
*   Ensure all strings are properly escaped within the JSON.
*   Pay close attention to data types (string, array, object, float, boolean).

Analyze the following email content and provide your response strictly in the described JSON format.
"""

# --- 2. LangChain Setup ---

def get_email_analysis_chain():
    """
    Sets up and returns a LangChain runnable for email analysis
    that outputs structured data according to the EmailAnalysis Pydantic model.
    """
    # Load environment variables (e.g., for API keys)
    # Ensure you have OPENAI_API_KEY (or DEEPSEEK_API_KEY, etc.) set in your .env file or environment
    load_dotenv()
    
    # Placeholder for API Key checks
    # For OpenAI:
    if not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not found in environment. The LLM call might fail.")
        # You could raise an error here or allow it to proceed and fail at runtime
    # For DeepSeek (if using DeepSeek through a LangChain compatible API like OpenAI's):
    # if not os.getenv("DEEPSEEK_API_KEY"):
    #     print("Warning: DEEPSEEK_API_KEY not found. Ensure it's set if using DeepSeek via an OpenAI-compatible endpoint.")


    # b. Initialize LLM
    # Replace with your preferred LLM provider and model
    # Example uses ChatOpenAI, assuming OPENAI_API_KEY is set
    llm = ChatOpenAI(
        model="gpt-3.5-turbo-0125", # Or "gpt-4o", "gpt-4-turbo" for potentially better results with complex JSON
        temperature=0.1, # Low temperature for more deterministic and structured output
        # max_tokens can be adjusted if the output is consistently truncated
        model_kwargs={"response_format": {"type": "json_object"}} # Enforce JSON output mode if available
    )
    # If using a different provider like Deepseek directly (not via OpenAI API compatibility)
    # from langchain_deepseek import ChatDeepseek
    # llm = ChatDeepseek(model="deepseek-chat", temperature=0.1, api_key=os.getenv("DEEPSEEK_API_KEY"))


    # c. Create PydanticOutputParser
    parser = PydanticOutputParser(pydantic_object=EmailAnalysis)

    # d. Create ChatPromptTemplate
    prompt_template = ChatPromptTemplate.from_messages(
        [
            ("system", MASTER_PROMPT_STRING),
            ("system", "Formatting Instructions:\n{format_instructions}"),
            ("human", "Please analyze the following email content:\n\n```text\n{email_content}\n```")
        ]
    )
    
    # Add format instructions to the partial variables for the prompt
    # This way, format_instructions is already part of the prompt when we invoke the chain
    # and doesn't need to be passed at each invocation.
    prompt_with_format_instructions = prompt_template.partial(format_instructions=parser.get_format_instructions())

    # e. Combine into a runnable LCEL chain
    # The chain takes "email_content" as input
    chain = prompt_with_format_instructions | llm | parser
    
    # Alternative chain structure if you prefer passing format_instructions explicitly during invoke:
    # chain = (
    #     RunnablePassthrough.assign(format_instructions=lambda _: parser.get_format_instructions())
    #     | prompt_template
    #     | llm
    #     | parser
    # )
    
    return chain

# --- Example Usage (for testing this module directly) ---
if __name__ == "__main__":
    print("Setting up Email Analysis Agent...")
    
    # This is a placeholder for loading your API key.
    # In a real application, ensure OPENAI_API_KEY (or your LLM provider's key) is securely managed.
    # Example: load_dotenv() at the top of your main script or set in your environment.
    if not os.getenv("OPENAI_API_KEY"):
         print("OPENAI_API_KEY is not set. Please set it in your environment or .env file for this example to run.")
         # exit() # Or handle gracefully

    email_analyzer_chain = get_email_analysis_chain()
    print("Agent Chain Initialized.")
    print("\n--- Master Prompt String (System Message Part) ---")
    # Print a snippet of the system prompt for review (excluding format instructions for brevity here)
    print(MASTER_PROMPT_STRING[:1000] + "...") 
    
    print("\n--- Pydantic Parser Format Instructions (System Message Part) ---")
    parser_for_instructions = PydanticOutputParser(pydantic_object=EmailAnalysis)
    print(parser_for_instructions.get_format_instructions())

    print("\n--- Example Invocation (Conceptual) ---")
    sample_email_content = """
    Subject: Project Alpha Update & Meeting Next Week

    Hi Team,

    Quick update on Project Alpha: Development is on track. Alice completed the new UI module.
    Bob mentioned we need to finalize the budget by this Friday, August 9th, 2024. Can you action this, Charles?
    Let's schedule a sync meeting for next week to discuss the deployment plan. I propose Tuesday or Wednesday morning.
    Please also review the attached "Alpha_Deployment_Strategy.docx".

    Best,
    Manager Dave (dave.manager@example.com)
    Acme Solutions
    """

    print(f"\nAnalyzing sample email content:\n{sample_email_content}\n")

    if os.getenv("OPENAI_API_KEY"): # Only run if key is available
        try:
            # The chain expects a dictionary with a key matching the input variable in the prompt template,
            # which is "email_content" in our ChatPromptTemplate.
            structured_response = email_analyzer_chain.invoke({"email_content": sample_email_content})
            
            print("\n--- Structured Output (EmailAnalysis Pydantic Object) ---")
            print(structured_response)
            
            print("\n--- JSON Output ---")
            # For Pydantic V2, use model_dump_json. For V1, use .json()
            if hasattr(structured_response, 'model_dump_json'):
                print(structured_response.model_dump_json(indent=2))
            else:
                print(structured_response.json(indent=2))

        except Exception as e:
            print(f"Error during example invocation: {e}")
            print("This might be due to missing API keys, incorrect setup, or an issue with the LLM's response not matching the Pydantic schema.")
    else:
        print("Skipping example LLM call as API key is not available.")

```
