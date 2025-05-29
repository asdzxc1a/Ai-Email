# Email Productivity Tool

Next-generation email productivity tool with smart inbox and workflow automation, designed to integrate with Gmail.

## Project Overview

This project aims to build a tool that:
- Ingests and parses Gmail messages in real-time.
- Auto-summarizes emails and threads.
- Generates context-aware replies.
- Offers modes for auto-sending or reviewing drafts.
- Includes an admin dashboard for management and analytics.

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
6.  **Service Account for Firebase Admin (Next.js backend):**
    *   Go to IAM & Admin > Service Accounts.
    *   Create a new service account or use an existing one.
    *   Grant it roles like "Cloud Datastore User" (for Firestore access).
    *   Download the JSON key file for this service account. You'll need its `project_id`, `client_email`, and `private_key` for the Next.js app's environment variables.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd email-productivity-tool
```

### 2. Next.js Web Application (`nextjs-app`)

1.  **Navigate to the directory:**
    ```bash
    cd nextjs-app
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    *   **Manually create a file named `.env.local` in the `nextjs-app` directory.**
    *   Add the following variables, replacing placeholders with your actual values:

        ```env
        # Google OAuth Credentials (from GCP Console)
        GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
        GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"

        # NextAuth Configuration
        NEXTAUTH_URL="http://localhost:3000" # Change for production
        NEXTAUTH_SECRET="GENERATE_A_STRONG_SECRET_HERE" # e.g., openssl rand -base64 32

        # Firebase Admin SDK Credentials (from downloaded service account JSON key)
        FIREBASE_PROJECT_ID="ACTUAL_GCP_PROJECT_ID_FOR_FIRESTORE" 
        FIREBASE_CLIENT_EMAIL="your-service-account-email@your-project-id.iam.gserviceaccount.com"
        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_COPIED_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n"
        
        # DeepSeek API Key
        DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY_HERE" 

        # Token Encryption Key (IMPORTANT - KEEP SECRET & CONSISTENT)
        # Used for AES encryption of stored OAuth tokens (accessToken, refreshToken).
        # Must be a strong, random 32-byte string (e.g., `openssl rand -hex 32` gives a 64-char hex string, which is 32 bytes).
        # THIS KEY MUST BE IDENTICAL to the one used for the 'handleGmailNotification' Cloud Function.
        TOKEN_ENCRYPTION_KEY="YOUR_STRONG_32_BYTE_SECRET_KEY_HERE" 
        ```

### 3. Google Cloud Function (`gcp-functions/handleGmailNotification`)

This function is designed to be triggered by Pub/Sub messages from Gmail.

1.  **Navigate to the function directory:**
    ```bash
    cd ../gcp-functions/handleGmailNotification 
    # (Assuming you are in nextjs-app or project root)
    ```
2.  **Environment Variables for Deployment**

    When deploying the `handleGmailNotification` Cloud Function, you need to set the following environment variables:

    -   `DEEPSEEK_API_KEY`: Your API key for the DeepSeek LLM service.
    -   `FIRESTORE_PROJECT_ID`: (Optional, but recommended) The GCP Project ID where your Firestore database is.
    -   `TOKEN_ENCRYPTION_KEY`: The same 32-byte secret key used by the Next.js application for encrypting and decrypting OAuth tokens. **This key must be identical to the one in `nextjs-app/.env.local`.**

3.  **Deploy using `gcloud` CLI:**
    (Refer to previous README section for detailed `gcloud functions deploy` command, ensuring environment variables including `TOKEN_ENCRYPTION_KEY` are set.)

### 4. Google Apps Script Add-on (`apps-script-addon`)
(Refer to previous README section for setup instructions.)

## Features (Next.js App)

The Next.js web application provides the following main features for authenticated users:

-   **Processed Email Listing & AI Actions:** (Existing features, refer to previous README)
-   **Direct AI Testing:** (Existing features, refer to previous README)
-   **Gmail Watch Setup:** (Existing features, refer to previous README)
-   **User Settings (`/settings`):**
    -   Provides a page for users to manage their application settings.
    -   **Auto Send Toggle:** Allows users to enable or disable the "Auto Send" feature.
        -   **Placeholder Status:** When enabled, the backend (`handleGmailNotification` Cloud Function) currently only logs the intent to auto-send an email and updates the email's status in Firestore to `summarized_auto_send_pending`.
        -   **Pending Implementation:** The actual sending of emails via the Gmail API and the creation of detailed audit log entries in the `outboundAudits` Firestore collection are pending future implementation.

## Admin Dashboard

The Admin Dashboard (`/admin`) provides tools for application monitoring and management. Access is restricted to users marked as `isAdmin: true` in their Firestore user document.

### Features

-   **Dashboard Home, Manage Users, Processed Emails:** (Existing features, refer to previous README)
-   **Prompt Management (`/admin/prompts`):**
    -   **Placeholder Status:** This page is currently a placeholder for managing prompt templates stored in the `promptLibrary` collection in Firestore.
    -   **Read-Only Preview:** It displays a read-only list of available prompts (e.g., `emailSummarization`, `replyGenerationDefault`) fetched from the backend.
    -   **Backend Ready:** The backend API (`/api/admin/prompts`) for CRUD operations on prompts is implemented.
    -   **Pending Implementation:** The UI for creating, editing, and deleting prompts, as well as the integration of these dynamic prompts into the summarization and reply generation services, is pending.
    -   Requires manual setup of initial prompts in Firestore as described in "GCP Configuration Summary."

## Running Tests

### Cloud Function Tests (Unit Tests)

Unit tests are available for utility functions within the `handleGmailNotification` Cloud Function.

1.  Navigate to the function's directory:
    ```bash
    cd email-productivity-tool/gcp-functions/handleGmailNotification
    ```
2.  Install dependencies (including devDependencies like Jest):
    ```bash
    npm install
    ```
3.  Run the tests:
    ```bash
    npm test
    ```
    This will execute tests defined in files like `cfCryptoUtils.test.js`.

### Next.js App Tests (Integration Tests)

Integration tests are available for the Next.js API endpoints.

1.  Navigate to the Next.js app directory:
    ```bash
    cd email-productivity-tool/nextjs-app
    ```
2.  Install dependencies (if not already done):
    ```bash
    npm install
    ```
3.  Run the tests:
    ```bash
    npm test
    ```
    This command (using the `test: "jest"` script added to `package.json`) will execute integration tests for API routes, such as those found in `pages/api/user/__tests__/settings.test.js` and `pages/api/admin/__tests__/prompts.test.js`.

## Security Considerations

-   **Environment Variables:** All secrets (API keys, OAuth client secrets, encryption keys) must be stored securely as environment variables.
-   **OAuth Token Encryption:** Google OAuth tokens are encrypted using AES via `TOKEN_ENCRYPTION_KEY`. This key must be a strong, unique 32-byte secret and identical across the Next.js app and Cloud Function.
-   **Admin Privileges:** Ensure `isAdmin` flag in Firestore is managed securely.
-   **OAuth Scopes:** Users grant specific permissions. The addition of `gmail.send` for auto-send requires user re-consent.

This README provides a starting point for setting up and running the MVP.
```
