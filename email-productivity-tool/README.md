# Email Productivity Tool

Next-generation email productivity tool with smart inbox and workflow automation, designed to integrate with Gmail.

## Project Overview

This project aims to build a tool that:
- Ingests and parses Gmail messages in real-time.
- Auto-summarizes emails and threads.
- Generates context-aware replies.
- Offers modes for auto-sending or reviewing drafts.
- Includes an admin dashboard for management, analytics, and feedback review.
- Collects user feedback on the quality of AI-generated content (summaries and draft replies).

This repository contains the code for Phase 1 (MVP), which includes core functionalities and placeholders for advanced features.

## Tech Stack

- **Frontend & Web App Backend:** Next.js (React framework)
- **Gmail Integration (Add-on):** Google Apps Script
- **Authentication:** NextAuth.js (with Google Provider)
- **Database:** Google Cloud Firestore
- **LLM:** DeepSeek (via Vercel AI SDK - using packages `@ai-sdk/deepseek` and `ai`)
- **Real-time Notifications:** Google Cloud Pub/Sub (for Gmail push notifications)
- **Serverless Functions:** Google Cloud Functions (for Pub/Sub message handling)
- **Deployment (examples):** Vercel/Netlify for Next.js, GCP for backend services.
- **Testing:** Jest for unit and integration tests.

## Project Structure
(Content unchanged)

## Prerequisites
(Content unchanged)

## GCP Configuration Summary
(Content for sections 1-4 unchanged)

5.  **Firestore Database:**
    *   Create a Firestore database in Native mode.
    *   Set up basic security rules. Initial Firestore security rules have been refined to ensure users can only access and manage their own data, enhancing security.
    *   **Key Collections:**
        *   `users`: Stores user profiles, including encrypted OAuth tokens and admin status.
        *   `processedEmails`: Stores details of emails processed by the backend, including summaries.
        *   `promptLibrary`: (Manual setup required) Stores prompt templates for AI generation tasks.
            *   (Details for manual setup of `emailSummarization` and `replyGenerationDefault` documents as per previous version of README)
        *   `summaryFeedback`: Stores user feedback on generated email summaries.
            *   (Purpose and Document Structure as per previous version of README)
        *   `replyFeedback`: Stores user feedback on AI-generated draft replies.
            *   (Purpose and Document Structure as per previous version of README)
6.  **Service Account for Firebase Admin (Next.js backend):**
    *   (Content unchanged)

## Setup Instructions
(Content unchanged)

## Features (Next.js App)

The Next.js web application provides the following main features for authenticated users:

-   **Processed Email Listing & AI Actions:** Displays a list of emails processed by the backend. Users can view details, including the full email body and AI-generated summary.
    -   **Summary Feedback:** Within the email detail view, users can provide "thumbs up" or "thumbs down" feedback on the quality of the AI-generated summary for that email.
    -   **Draft Reply & Feedback:** When an AI-generated draft reply is displayed (after clicking "Generate Reply for this Email" or "Generate Reply for Direct ID"), users can:
        *   Edit the draft directly in a textarea.
        *   Provide "thumbs up" or "thumbs down" feedback on the draft's quality/helpfulness.
        *   Submit this comprehensive feedback (edited draft, original draft, and thumbs rating) to the backend.
-   **AI Actions on Listed Emails:** (Existing features - "Generate Reply for this Email" now leads to the draft reply feedback UI)
-   **Direct AI Testing:** (Existing features - "Generate Reply for Direct ID" now leads to the draft reply feedback UI)
-   **Gmail Watch Setup:** (Existing features)
-   **User Settings (`/settings`):**
    -   (Content unchanged)

## Admin Dashboard

The Admin Dashboard (`/admin`) provides tools for application monitoring and management. Access is restricted to users marked as `isAdmin: true` in their Firestore user document.

### Features

-   **Dashboard Home, Manage Users, Processed Emails:** (Existing features, refer to previous README)
-   **Prompt Management (`/admin/prompts`):**
    -   (Content unchanged)
-   **Summary Feedback Page (`/admin/feedback/summaries`):**
    *   Allows administrators to view a paginated and filterable list of all user-submitted feedback on AI-generated email summaries.
    *   Displays key fields: Date/Time, User ID, Message ID, Summary Text (truncated, with full view on hover), and Feedback (👍 Up / 👎 Down).
    *   Supports filtering by feedback type ("All", "Up", "Down") and pagination.
-   **Reply Feedback Page (`/admin/feedback/replies`):**
    *   Allows administrators to view a paginated and filterable list of all user-submitted feedback on AI-generated draft replies.
    *   Displays key fields: Date/Time, User ID, Message ID, Original AI Draft (truncated), Final User Draft (truncated), Edited (Yes/No), and Thumbs (👍 Up / 👎 Down / None).
    *   Includes a modal to view and compare the full text of the original AI draft and the final user-edited draft.
    *   Supports filtering by thumbs feedback ("All", "Up", "Down", "None") and by whether the draft was edited ("All", "Yes", "No"), along with pagination.


## Next.js Backend API Endpoints

The `nextjs-app` provides several backend API endpoints under `/api/`:

(Existing API endpoint documentation unchanged)

#### `POST /api/feedback/summary`
(Content unchanged)

#### `POST /api/feedback/reply`
(Content unchanged)

---
**Admin API Endpoints (Require Admin Authentication)**
---

#### `GET /api/admin/feedback/summaries`
Retrieves a paginated and filterable list of summary feedback entries.
-   **Method:** `GET`
-   **Authentication:** Admin user session required.
-   **Query Parameters:**
    -   `page` (Number, optional, default 1): Page number for pagination.
    -   `limit` (Number, optional, default 10, max 50): Number of records per page.
    -   `feedbackType` (String, optional): Filter by feedback type ("up" or "down").
    -   `sortBy` (String, optional, default "timestamp"): Field to sort by.
    -   `sortOrder` (String, optional, default "desc"): Sort order ("asc" or "desc").
    -   `startAfterDocId` (String, optional): Document ID for cursor-based pagination (for fetching next page).
-   **Response (Success - 200 OK):**
    ```json
    {
      "success": true,
      "data": [ 
        // Array of summary feedback documents, each with id, userId, messageId, summaryText, feedback, timestamp 
      ],
      "pagination": {
        "currentPage": 1,
        "limit": 10,
        "totalPages": 5, 
        "totalRecords": 50,
        "lastDocId": "<ID_OF_LAST_DOCUMENT_IN_CURRENT_SET_OR_NULL>" 
      }
    }
    ```
-   **Error Responses:**
    -   `403 Forbidden`: If the user is not an administrator.
    -   `500 Internal Server Error`: For server-side issues.

#### `GET /api/admin/feedback/replies`
Retrieves a paginated and filterable list of reply feedback entries.
-   **Method:** `GET`
-   **Authentication:** Admin user session required.
-   **Query Parameters:**
    -   `page` (Number, optional, default 1).
    -   `limit` (Number, optional, default 10, max 50).
    *   `thumbsFeedback` (String, optional): Filter by thumbs rating ("up", "down", or "none" for null values).
    *   `hasBeenEdited` (String, optional): Filter by whether the draft was edited ("true" or "false").
    -   `sortBy` (String, optional, default "timestamp").
    -   `sortOrder` (String, optional, default "desc").
    -   `startAfterDocId` (String, optional).
-   **Response (Success - 200 OK):**
    ```json
    {
      "success": true,
      "data": [
        // Array of reply feedback documents, each with id, userId, messageId, originalAiDraft, finalUserDraft, hasBeenEdited, thumbsFeedback, timestamp
      ],
      "pagination": {
        "currentPage": 1,
        "limit": 10,
        "totalPages": 5,
        "totalRecords": 50,
        "lastDocId": "<ID_OF_LAST_DOCUMENT_IN_CURRENT_SET_OR_NULL>"
      }
    }
    ```
-   **Error Responses:**
    -   `403 Forbidden`: If the user is not an administrator.
    -   `500 Internal Server Error`: For server-side issues.

(Other API endpoints like `/api/auth/*`, `/api/gmail/watch`, `/api/user/settings`, and other admin endpoints also exist but are detailed elsewhere or can be inferred from their respective frontend features.)

## Running Tests
(Content unchanged)

## Security Considerations
(Content unchanged)

This README provides a starting point for setting up and running the MVP.
```
