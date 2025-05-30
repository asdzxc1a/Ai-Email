from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr, HttpUrl
import datetime

class BaseEntity(BaseModel):
    """Base model for recognized entities."""
    name: str = Field(..., description="The name of the entity.")
    context: Optional[str] = Field(None, description="The context in which the entity was found in the text.")

class PersonEntity(BaseEntity):
    """Represents a person entity."""
    email: Optional[EmailStr] = Field(None, description="Email address of the person, if available.")
    role: Optional[str] = Field(None, description="Role or title of the person, if mentioned (e.g., 'Project Manager').")

class OrganizationEntity(BaseEntity):
    """Represents an organization entity."""
    website: Optional[HttpUrl] = Field(None, description="Website of the organization, if available.")
    industry: Optional[str] = Field(None, description="Industry of the organization, if mentioned (e.g., 'Technology').")

class LocationEntity(BaseEntity):
    """Represents a location entity."""
    address: Optional[str] = Field(None, description="Full address, if available.")
    type: Optional[str] = Field(None, description="Type of location (e.g., 'City', 'Country', 'Office Building').")

class DateMention(BaseModel):
    """Represents a mention of a date or date range."""
    date_text: str = Field(..., description="The original text mentioning the date (e.g., 'next Tuesday', '2023-12-25').")
    start_date: Optional[datetime.datetime] = Field(None, description="The specific start date and time, if parsable.")
    end_date: Optional[datetime.datetime] = Field(None, description="The specific end date and time, if it's a range and parsable.")
    context: Optional[str] = Field(None, description="Context of how the date was mentioned.")

class ActionItem(BaseModel):
    """Represents an action item identified in the text."""
    task: str = Field(..., description="The description of the action item or task.")
    assigned_to: Optional[List[PersonEntity]] = Field(default_factory=list, description="List of people assigned to this action item.")
    due_date: Optional[DateMention] = Field(None, description="Due date for the action item.")
    priority: Optional[Literal['high', 'medium', 'low']] = Field(None, description="Priority of the action item.")
    context: Optional[str] = Field(None, description="The sentence or phrase from which the action item was extracted.")
    status: Optional[Literal['open', 'in progress', 'completed', 'blocked']] = Field('open', description="Current status of the action item.")

class Topic(BaseModel):
    """Represents a key topic or keyword."""
    topic_name: str = Field(..., description="The identified topic or keyword.")
    relevance_score: Optional[float] = Field(None, description="A score indicating the relevance of the topic to the text (0.0 to 1.0).")

class Sentiment(BaseModel):
    """Represents the sentiment of the text."""
    polarity: float = Field(..., description="Sentiment polarity score (e.g., -1.0 to 1.0, where negative is negative, positive is positive).")
    subjectivity: Optional[float] = Field(None, description="Sentiment subjectivity score (e.g., 0.0 to 1.0, where 0 is objective, 1 is subjective).")
    label: Literal['positive', 'negative', 'neutral'] = Field(..., description="Overall sentiment label.")
    context: Optional[str] = Field(None, description="Specific phrases or context contributing to this sentiment, if applicable.")

class MeetingReference(BaseModel):
    """Information about a potential meeting mentioned."""
    occasion: Optional[str] = Field(None, description="The purpose or occasion of the meeting (e.g., 'Project Kick-off', 'Weekly Sync').")
    proposed_times: List[DateMention] = Field(default_factory=list, description="List of proposed dates/times for the meeting.")
    participants: List[PersonEntity] = Field(default_factory=list, description="List of mentioned or implied participants.")
    location: Optional[LocationEntity] = Field(None, description="Proposed location for the meeting, if any.")

class DocumentReference(BaseModel):
    """Reference to a document mentioned in the text."""
    document_name: str = Field(..., description="The name or title of the document.")
    document_type: Optional[str] = Field(None, description="Type of document (e.g., 'report', 'slides', 'spreadsheet').")
    link: Optional[HttpUrl] = Field(None, description="A URL link to the document, if provided.")
    context: Optional[str] = Field(None, description="Context where the document was mentioned.")

class EmailAnalysis(BaseModel):
    """Comprehensive analysis of an email's content."""
    summary: str = Field(..., description="A concise summary of the email content.")
    extracted_entities: Optional[List[BaseModel]] = Field(default_factory=list, description="List of recognized entities (Person, Organization, Location). Use specific types like PersonEntity, OrganizationEntity, LocationEntity.")
    action_items: Optional[List[ActionItem]] = Field(default_factory=list, description="List of identified action items.")
    key_topics: Optional[List[Topic]] = Field(default_factory=list, description="List of key topics or keywords discussed.")
    dates_mentioned: Optional[List[DateMention]] = Field(default_factory=list, description="Dates and date ranges mentioned in the email.")
    overall_sentiment: Optional[Sentiment] = Field(None, description="Overall sentiment of the email.")
    reply_suggestions: Optional[List[str]] = Field(default_factory=list, description="Suggested brief reply phrases or points, if applicable.")
    meeting_references: Optional[List[MeetingReference]] = Field(default_factory=list, description="References to potential meetings.")
    document_references: Optional[List[DocumentReference]] = Field(default_factory=list, description="References to documents.")
    language: Optional[str] = Field(None, description="Detected language of the email text (e.g., 'en', 'es').")
    urgency_score: Optional[float] = Field(None, description="A score from 0.0 to 1.0 indicating the perceived urgency of the email.")
    retrieved_context_summary: Optional[str] = Field(None, description="A summary of externally retrieved context if RAG was performed, focusing on relevance to the email.")

    class Config:
        # For Pydantic V2, use model_config instead of Config
        # model_config = {
        #     "json_schema_extra": {
        #         "examples": [
        #             {
        #                 "summary": "The team discussed the project timeline and upcoming deadlines. Alice will send out the meeting notes by EOD Friday.",
        #                 "extracted_entities": [
        #                     {"name": "Alice", "context": "Alice will send out the meeting notes", "email": "alice@example.com", "role": "Team Lead"},
        #                     {"name": "Project Phoenix", "context": "discussed the project timeline", "industry": "Software Development"}
        #                 ],
        #                 "action_items": [
        #                     {
        #                         "task": "Send out meeting notes",
        #                         "assigned_to": [{"name": "Alice", "email": "alice@example.com"}],
        #                         "due_date": {"date_text": "by EOD Friday", "start_date": "2023-10-27T17:00:00"},
        #                         "priority": "high",
        #                         "context": "Alice will send out the meeting notes by EOD Friday.",
        #                         "status": "open"
        #                     }
        #                 ],
        #                 "key_topics": [
        #                     {"topic_name": "project timeline", "relevance_score": 0.9},
        #                     {"topic_name": "deadlines", "relevance_score": 0.8}
        #                 ],
        #                 "dates_mentioned": [
        #                     {"date_text": "EOD Friday", "start_date": "2023-10-27T17:00:00", "context": "by EOD Friday"}
        #                 ],
        #                 "overall_sentiment": {"polarity": 0.5, "subjectivity": 0.3, "label": "positive"},
        #                 "language": "en",
        #                 "urgency_score": 0.7
        #             }
        #         ]
        #     }
        # }
        # For Pydantic V1
        schema_extra = {
            "examples": [
                {
                    "summary": "The team discussed the project timeline and upcoming deadlines. Alice will send out the meeting notes by EOD Friday.",
                    "extracted_entities": [
                        {"name": "Alice", "context": "Alice will send out the meeting notes", "email": "alice@example.com", "role": "Team Lead"},
                        {"name": "Project Phoenix", "context": "discussed the project timeline", "industry": "Software Development"}
                    ],
                    "action_items": [
                        {
                            "task": "Send out meeting notes",
                            "assigned_to": [{"name": "Alice", "email": "alice@example.com"}],
                            "due_date": {"date_text": "by EOD Friday", "start_date": "2023-10-27T17:00:00Z"}, # Example with ISO format
                            "priority": "high",
                            "context": "Alice will send out the meeting notes by EOD Friday.",
                            "status": "open"
                        }
                    ],
                    "key_topics": [
                        {"topic_name": "project timeline", "relevance_score": 0.9},
                        {"topic_name": "deadlines", "relevance_score": 0.8}
                    ],
                    "dates_mentioned": [
                        {"date_text": "EOD Friday", "start_date": "2023-10-27T17:00:00Z", "context": "by EOD Friday"}
                    ],
                    "overall_sentiment": {"polarity": 0.5, "subjectivity": 0.3, "label": "positive"},
                    "meeting_references": [
                        {
                            "occasion": "Timeline Discussion", 
                            "proposed_times": [{"date_text":"next Monday morning", "context":"Let's sync next Monday morning"}],
                            "participants": [{"name":"Bob"}, {"name":"Alice"}]
                        }
                    ],
                    "document_references": [
                        {"document_name": "Q3 Report", "document_type": "report", "context": "Please review the Q3 Report"}
                    ],
                    "language": "en",
                    "urgency_score": 0.7,
                    "reply_suggestions": ["Thanks for the update!", "Will review the notes."],
                    "retrieved_context_summary": "Retrieved documents indicate the Q3 report is overdue and impacts the project timeline discussion."
                }
            ]
        }

# Example usage:
if __name__ == "__main__":
    sample_data = {
        "summary": "Email regarding the new marketing campaign launch. Key action items include finalizing the budget by tomorrow and scheduling a team sync for next week. Overall positive sentiment towards the proposed strategy.",
        "extracted_entities": [
            PersonEntity(name="Sarah", role="Marketing Manager", context="Sarah mentioned the budget"),
            OrganizationEntity(name="MarketingDept", context="new marketing campaign launch")
        ],
        "action_items": [
            ActionItem(
                task="Finalize the budget",
                due_date=DateMention(date_text="by tomorrow", context="finalizing the budget by tomorrow"),
                priority="high",
                assigned_to=[PersonEntity(name="John Doe")],
                context="Key action items include finalizing the budget by tomorrow"
            ),
            ActionItem(
                task="Schedule a team sync",
                due_date=DateMention(date_text="next week", context="scheduling a team sync for next week"),
                priority="medium",
                context="scheduling a team sync for next week"
            )
        ],
        "key_topics": [
            Topic(topic_name="marketing campaign", relevance_score=0.95),
            Topic(topic_name="budget finalization", relevance_score=0.88)
        ],
        "dates_mentioned": [
            DateMention(date_text="tomorrow", context="finalizing the budget by tomorrow"),
            DateMention(date_text="next week", context="scheduling a team sync for next week")
        ],
        "overall_sentiment": Sentiment(polarity=0.7, subjectivity=0.4, label="positive"),
        "language": "en",
        "urgency_score": 0.8,
        "reply_suggestions": ["Great! Let's get the budget finalized.", "Looking forward to the sync next week."]
    }
    
    try:
        email_analysis_instance = EmailAnalysis(**sample_data)
        print(email_analysis_instance.model_dump_json(indent=2)) # For Pydantic V2
        # print(email_analysis_instance.json(indent=2)) # For Pydantic V1
    except Exception as e:
        print(f"Error creating Pydantic model: {e}")

    # Example for parsing with LangChain (conceptual)
    # from langchain.output_parsers import PydanticOutputParser
    # parser = PydanticOutputParser(pydantic_object=EmailAnalysis)
    # print("\nLangChain Parser Instructions:")
    # print(parser.get_format_instructions())

```
