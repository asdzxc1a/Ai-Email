# Email Productivity Tool

Next-generation email productivity tool with smart inbox and workflow automation, designed to integrate with Gmail.

## Project Overview

This project aims to build a tool that:
- Ingests and parses Gmail messages in real-time.
- Auto-summarizes emails and threads.
- Generates context-aware replies.
- Offers modes for auto-sending or reviewing drafts.
- Includes an admin dashboard for management and analytics.
- Collects user feedback on the quality of AI-generated content.

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

-   `/nextjs-app`: Contains the Next.js web application (frontend, backend APIs, integration tests).
-   `/apps-script-addon`: Contains the Google Workspace Add-on (Apps Script) for Gmail integration.
-   `/gcp-functions`: Contains Google Cloud Functions (e.g., for handling Pub/Sub messages, unit tests).

## Prerequisites

- Node.js (v18 or later recommended)
- npm
- Google Cloud Platform (GCP) account with billing enabled
- Google Workspace account (for testing Gmail Add-on)

## GCP Configuration Summary

Before running the application, ensure the following are set up in your GCP project:

1.  **New GCP Project:** Create one if you don't have one.
2.  **APIs Enabled:**
    *   Gmail API
    *   Google Cloud Pub/Sub API
    *   Cloud Firestore API
    *   Cloud Functions API (and related deployment APIs like Cloud Build)
3.  **OAuth 2.0 Credentials:**
    *   Configure OAuth consent screen.
    *   Create OAuth 2.0 Client ID for "Web application" (for Next.js app). Note the Client ID and Secret.
    *   Authorized JavaScript origins (e.g., `http://localhost:3000`).
    *   Authorized redirect URIs (e.g., `http://localhost:3000/api/auth/callback/google`).
    *   **IMPORTANT - Required Scopes:** Ensure your OAuth Consent Screen is configured with the necessary scopes. This includes `userinfo.profile`, `userinfo.email`, `gmail.readonly`, `gmail.modify`, and crucially, `https://www.googleapis.com/auth/gmail.send`.
        *   **Action Required for `gmail.send`:** The `https://www.googleapis.com/auth/gmail.send` scope is necessary for the "Auto Send" feature. If you are updating an existing consent screen, you **must manually add this scope**. Navigate to your GCP project's "OAuth consent screen" settings, edit your app registration, go to "Scopes," and add `https://www.googleapis.com/auth/gmail.send`. This change may require Google to re-verify your app if it's in production and will necessitate users to re-authenticate to grant this new permission.
4.  **Pub/Sub Topic:**
    *   Create a Pub/Sub topic (e.g., `ACTUAL_PUBSUB_TOPIC_NAME`). This name is referenced in the code.
    *   Grant the Gmail service account (`service-[PROJECT_NUMBER]@gcp-sa-gmail.iam.gserviceaccount.com`) the "Pub/Sub Publisher" role on this topic.
5.  **Firestore Database:**
    *   Create a Firestore database in Native mode.
    *   Set up basic security rules. Initial Firestore security rules have been refined to ensure users can only access and manage their own data, enhancing security.
    *   **Key Collections:**
        *   `users`: Stores user profiles, including encrypted OAuth tokens and admin status.
        *   `processedEmails`: Stores details of emails processed by the backend, including summaries.
        *   `promptLibrary`: (Manual setup required) Stores prompt templates for AI generation tasks.
            *   **Manual Setup - `promptLibrary` Collection:** For dynamic prompt management (currently backend API is ready, UI is placeholder), you need to manually create the `promptLibrary` collection in Firestore with the following initial documents:
                *   **Document 1 ID:** `emailSummarization`
                    *   `promptName` (string): "Default Email Summarization Prompt"
                    *   `promptContent` (string): "Summarize the following email concisely:\nFrom: {{emailDetails.from}}\nSubject: {{emailDetails.subject}}\nBody:\n{{truncatedBody}}"
                    *   `description` (string): "Standard prompt used by the backend to summarize emails."
                    *   `variables` (array): ["emailDetails.from", "emailDetails.subject", "truncatedBody"]
                    *   `updatedAt` (timestamp): Set to current time.
                    *   `lastUpdatedBy` (string): User ID of admin setting this up (e.g., "initial_setup").
                *   **Document 2 ID:** `replyGenerationDefault`
                    *   `promptName` (string): "Default Reply Generation Prompt"
                    *   `promptContent` (string): "You are an AI assistant helping a user draft a reply to an email.\nOriginal Email:\nFrom: {{emailDetails.from}}\nSubject: {{emailDetails.subject}}\nReceived At: {{emailDetails.date}}\nBody:\n{{emailDetails.body}}\n\nUser's Instructions/Context for Reply (if any):\n\"{{replyContext}}\"\n\nPlease draft a {{actualTone}} reply. Focus on being helpful and clear. Generate only the body of the reply, without greetings or sign-offs unless specified in the user's context."
                    *   `description` (string): "Default prompt for generating email replies. Variables like tone and context are inserted by the backend."
                    *   `variables` (array): ["emailDetails.from", "emailDetails.subject", "emailDetails.date", "emailDetails.body", "replyContext", "actualTone"]
                    *   `updatedAt` (timestamp): Set to current time.
                    *   `lastUpdatedBy` (string): User ID of admin setting this up.
        *   `summaryFeedback`: Stores user feedback on generated email summaries.
            *   **Purpose:** To collect user ratings (thumbs up/down) on the quality and usefulness of AI-generated summaries.
            *   **Document Structure (auto-generated ID):**
                *   `userId` (string): ID of the user providing feedback.
                *   `messageId` (string): ID of the Gmail message the summary pertains to.
                *   `summaryText` (string): The actual summary text that was rated.
                *   `feedback` (string): User's rating ("up" or "down").
                *   `timestamp` (timestamp): Server-side timestamp of when the feedback was submitted.
6.  **Service Account for Firebase Admin (Next.js backend):**
    *   Go to IAM & Admin > Service Accounts.
    *   Create a new service account or use an existing one.
    *   Grant it roles like "Cloud Datastore User" (for Firestore access).
    *   Download the JSON key file for this service account. You'll need its `project_id`, `client_email`, and `private_key` for the Next.js app's environment variables.

## Setup Instructions

### 1. Clone the Repository
(Content unchanged)

### 2. Next.js Web Application (`nextjs-app`)
(Content unchanged, environment variables section already covers necessary items)

### 3. Google Cloud Function (`gcp-functions/handleGmailNotification`)
(Content unchanged)

### 4. Google Apps Script Add-on (`apps-script-addon`)
(Content unchanged)

## Features (Next.js App)

The Next.js web application provides the following main features for authenticated users:

-   **Processed Email Listing & AI Actions:** Displays a list of emails processed by the backend. Users can view details, including the full email body and AI-generated summary.
    -   **Summary Feedback:** Within the email detail view, users can provide "thumbs up" or "thumbs down" feedback on the quality of the AI-generated summary for that email.
-   **AI Actions on Listed Emails:** (Existing features, refer to previous README)
-   **Direct AI Testing:** (Existing features, refer to previous README)
-   **Gmail Watch Setup:** (Existing features, refer to previous README)
-   **User Settings (`/settings`):**
    -   Provides a page for users to manage their application settings.
    -   **Auto Send Toggle:** Allows users to enable or disable the "Auto Send" feature.
        -   **Placeholder Status:** When enabled, the backend (`handleGmailNotification` Cloud Function) currently only logs the intent to auto-send an email and updates the email's status in Firestore to `summarized_auto_send_pending`.
        -   **Pending Implementation:** The actual sending of emails via the Gmail API and the creation of detailed audit log entries in the `outboundAudits` Firestore collection are pending future implementation.

## Admin Dashboard
(Content unchanged)

## Next.js Backend API Endpoints

The `nextjs-app` provides several backend API endpoints under `/api/`:

#### `GET /api/gmail/getEmailContent`
(Content unchanged)

#### `POST /api/ai/summarize`
(Content unchanged)

#### `POST /api/ai/generate-reply`
(Content unchanged)

#### `POST /api/feedback/summary`
Submits user feedback on an AI-generated email summary.
-   **Method:** `POST`
-   **Authentication:** User session required.
-   **Request Body (JSON):**
    ```json
    {
      "messageId": "<GMAIL_MESSAGE_ID>", 
      "summaryText": "<THE_ACTUAL_SUMMARY_TEXT_SHOWN_TO_USER>",
      "feedbackType": "<'up' or 'down'>"
    }
    ```
-   **Response (Success - 201 Created):**
    ```json
    {
      "success": true,
      "message": "Feedback submitted successfully.",
      "feedbackId": "<ID_OF_THE_NEW_FEEDBACK_DOCUMENT_IN_FIRESTORE>"
    }
    ```
-   **Error Responses:**
    -   `400 Bad Request`: If input validation fails (e.g., missing fields, invalid `feedbackType`).
    -   `401 Unauthorized`: If the user is not authenticated.
    -   `500 Internal Server Error`: If there's an issue saving the feedback to Firestore or a general server error.

(Other API endpoints like `/api/auth/*`, `/api/gmail/watch`, `/api/user/settings`, and admin endpoints also exist but are detailed elsewhere or can be inferred from their respective frontend features.)

## Running Tests
(Content unchanged)

## Security Considerations
(Content unchanged)

This README provides a starting point for setting up and running the MVP.
```
