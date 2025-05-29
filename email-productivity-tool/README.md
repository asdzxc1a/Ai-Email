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

## MVP Deployment and Testing Guide

This guide outlines the critical steps to deploy, configure, and test the MVP version of the Email Productivity Tool.

### Phase 1: Deployment & Critical Configuration

**A. Deploy the Next.js Application**

1.  **Choose Hosting Platform:** Recommended: Vercel, Netlify, AWS Amplify, Google Cloud Run. Follow platform-specific instructions for deploying a Next.js app (usually via Git repository connection).
2.  **Set Environment Variables (Next.js App):** During deployment setup, configure the following:
    *   `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
    *   `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
    *   `NEXTAUTH_SECRET`: A strong random string for NextAuth.js.
    *   `NEXTAUTH_URL`: The canonical URL of your deployed Next.js app (e.g., `https://your-app.vercel.app`).
    *   `TOKEN_ENCRYPTION_KEY`: A strong, random secret key (e.g., 32 or 64 chars) for encrypting OAuth tokens. **Must be identical to the key used in the Cloud Function.**
    *   `FIREBASE_PROJECT_ID`: Your Firebase project ID.
    *   `FIREBASE_CLIENT_EMAIL`: Client email from Firebase Admin SDK service account JSON.
    *   `FIREBASE_PRIVATE_KEY`: Private key from Firebase Admin SDK service account JSON (ensure correct formatting, e.g., replace literal `\n` with newlines if required by your platform).
    *   `DEEPSEEK_API_KEY`: API key for the DeepSeek LLM (or your chosen LLM).
    *   `GCP_PROJECT_ID_FOR_PUBSUB`: Your Google Cloud Project ID (for Pub/Sub).
    *   `PUBSUB_TOPIC_NAME_FOR_GMAIL`: Name of your Pub/Sub topic for Gmail notifications.
3.  **Build & Deploy:** Let the platform build and deploy your app.
4.  **Obtain Deployed URL:** Note the public URL of your deployed Next.js app. This is needed for other configurations.

**B. Google Cloud Function Deployment (`handleGmailNotification`)**

1.  **Navigate to Google Cloud Console:** Go to your GCP Project -> Cloud Functions.
2.  **Create/Update Cloud Function:**
    *   **Name:** e.g., `handleGmailNotification`.
    *   **Region:** Choose your preferred region.
    *   **Trigger:** "Cloud Pub/Sub." Select the Pub/Sub topic created for Gmail notifications.
    *   **Source Code:** Upload or link the contents of `email-productivity-tool/gcp-functions/handleGmailNotification/`. Ensure `package.json`, `index.js`, `cfGmailUtils.js`, `cfCryptoUtils.js` are included.
    *   **Runtime:** Node.js (e.g., Node.js 20 or 18).
    *   **Entry point:** `handleGmailNotification`.
3.  **Set Environment Variables (Cloud Function):** Under "Runtime, build and connections settings" -> "Runtime" -> "Runtime environment variables":
    *   `TOKEN_ENCRYPTION_KEY`: **Exact same key** as used in the Next.js app.
    *   `FIREBASE_PROJECT_ID`: Your Firebase project ID.
    *   `FIREBASE_CLIENT_EMAIL`: Firebase Admin SDK client email.
    *   `FIREBASE_PRIVATE_KEY`: Firebase Admin SDK private key (formatted correctly).
    *   `DEEPSEEK_API_KEY`: LLM API key.
4.  **Service Account Permissions:** Ensure the Cloud Function's runtime service account has permissions for Pub/Sub (subscriber), Firestore (read/write), and any other GCP services it might interact with. (Gmail API calls are made using user tokens, not the function's service account identity directly for Gmail).
5.  **Deploy.**

**C. Google Apps Script Add-on Deployment**

1.  **Open/Create Apps Script Project:** Associated with your add-on.
2.  **Copy Files:**
    *   Populate `appsscript.json` with the content from `email-productivity-tool/apps-script-addon/appsscript.json`.
    *   Populate `Code.gs` with the content from `email-productivity-tool/apps-script-addon/Code.gs`.
3.  **CRITICAL: Update `NEXTJS_APP_BASE_URL` in `Code.gs`:**
    *   Change the placeholder `const NEXTJS_APP_BASE_URL = "https://your-nextjs-app-deployment-url.com";` to the **actual deployed URL of your Next.js application** (from Part A, step 4).
4.  **Set GCP Project:** In Apps Script editor -> Project Settings (gear icon) -> "Google Cloud Platform (GCP) Project," associate it with the same GCP Project used for Pub/Sub, Firestore, etc.
5.  **Deploy:** Click "Deploy" -> "New deployment." Select type "Add-on."

**D. CRITICAL: Update Pub/Sub Topic in Next.js `watch.js` API**

1.  **File:** `email-productivity-tool/nextjs-app/pages/api/gmail/watch.js`
2.  **Action:** Modify the `pubSubTopicName` variable to use the environment variables set in Part A, step 2:
    ```javascript
    const gcpProjectId = process.env.GCP_PROJECT_ID_FOR_PUBSUB;
    const topicName = process.env.PUBSUB_TOPIC_NAME_FOR_GMAIL;
    const pubSubTopicName = `projects/${gcpProjectId}/topics/${topicName}`;
    if (!gcpProjectId || !topicName) {
      console.error("Critical: GCP_PROJECT_ID_FOR_PUBSUB or PUBSUB_TOPIC_NAME_FOR_GMAIL environment variables not set in Next.js app!");
      // Potentially return an error response to the client
    }
    ```
3.  **Re-deploy Next.js Application** if you made code changes to `watch.js`.

### Phase 2: Firestore `promptLibrary` Setup

1.  **Navigate to Firestore Database** in your Firebase project console.
2.  **Create `promptLibrary` Collection** (if it doesn't exist).
    *   Collection ID: `promptLibrary`
3.  **Create `defaultReplyPrompt` Document:**
    *   Document ID: `defaultReplyPrompt`
    *   Fields:
        *   `template` (string):
            ```text
            You are an AI assistant helping a user draft a reply to an email.
            The original email was received from: {{originalFrom}}
            The subject of the original email is: "{{originalSubject}}"
            The original email was received on: {{originalDate}}

            Original email body:
            {{originalEmailBody}}

            ---
            The user has provided the following context or instructions for the reply: "{{userContext}}"
            ---

            Please draft a {{tone}} reply to the original email based on the user's context.
            If the original email asks a question, try to answer it.
            If it's a statement, acknowledge it appropriately.
            Keep the reply concise and relevant.
            Do not invent information not present in the original email or user's context.
            Generate only the body of the reply, without any greetings like "Hi [User's Name]," or sign-offs like "Best regards, [User's Name]", unless the user's context specifically instructs you to add them.
            ```
        *   `description` (string, Optional): `Default template for generating email replies.`
        *   `lastUpdated` (timestamp, Optional): Current timestamp.
4.  **Create `defaultSummaryPrompt` Document:**
    *   Document ID: `defaultSummaryPrompt`
    *   Fields:
        *   `template` (string):
            ```text
            Summarize the following email concisely. Extract key information and main points.
            Original sender: {{originalFrom}}
            Original subject: "{{originalSubject}}"

            Email body:
            {{originalEmailBody}}

            Summary:
            ```
        *   `description` (string, Optional): `Default template for generating email summaries.`
        *   `lastUpdated` (timestamp, Optional): Current timestamp.

### Phase 3: End-to-End Testing Guidance

**Prerequisites:** Test Google account, secondary email account, all components deployed and configured, `promptLibrary` set up.

**Key Flows & Verification Points:**

1.  **User Authentication & Initial Setup (Web App):**
    *   Flow: Sign in, grant OAuth.
    *   Verify: Successful login, user doc in Firestore (with encrypted tokens).
2.  **Gmail Watch Setup (Web App):**
    *   Flow: Click "Setup Gmail Watch."
    *   Verify: UI success, `watchExpiration` & `gmailHistoryId` in user's Firestore doc. Next.js server logs for `/api/gmail/watch`.
3.  **Real-Time Email Ingestion, Processing, Summarization:**
    *   Flow: Send email to test Gmail account.
    *   Verify:
        *   Cloud Function (`handleGmailNotification`) logs: Pub/Sub trigger, user lookup, token decryption, Gmail history call, LLM summarization call (using dynamic prompt), Firestore `processedEmails` write.
        *   Firestore `processedEmails`: New doc with summary, status `summarized` (if auto-send off).
        *   Web App: New email & summary appear.
4.  **On-Demand Summarization (Web App & Add-on):**
    *   Flow: Use "Re-summarize" (web) or "Summarize Email" (add-on).
    *   Verify: UI displays summary. Next.js server logs for `/api/ai/summarize` (check for dynamic prompt usage).
5.  **On-Demand Reply Generation & Review (Web App & Add-on):**
    *   Flow: Generate reply (web/add-on), provide context/tone.
    *   Verify: UI displays draft. Next.js server logs for `/api/ai/generate-reply` (check dynamic prompt).
    *   Add-on: "Insert into Reply Composer" works.
    *   Web App: "Send via Gmail" works (email sent, appears in "Sent," correct threading). Next.js server logs for `/api/gmail/send`.
6.  **Feedback Submission (Web App):**
    *   Flow: Submit thumbs up/down for summaries & replies.
    *   Verify: UI confirmation. Firestore `summaryFeedback` & `replyFeedback` collections updated. Next.js server logs for feedback APIs.
7.  **Auto-Send Functionality:**
    *   Flow: Enable "Auto Send" in web app settings. Send new email to test account.
    *   Verify:
        *   Cloud Function logs: `autoSendEnabled: true`, LLM reply generation, MIME construction, Gmail API send call.
        *   Firestore `processedEmails` status `auto_sent`.
        *   Gmail "Sent" folder: Auto-reply present. Recipient receives it (check threading).
        *   Firestore `outboundAudits`: New audit log entry.
8.  **Dynamic Prompts Test:**
    *   Flow: Modify `template` in `promptLibrary` docs. Trigger new summary/reply.
    *   Verify: AI output reflects template changes.
9.  **Error Handling Tests (Examples):**
    *   Revoke app's Google OAuth access, then try using app/add-on.
    *   Temporarily use an invalid LLM API key.
    *   Try actions with invalid inputs (e.g., fake message ID).
```
