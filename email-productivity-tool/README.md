# Email Productivity Tool

Next-generation email productivity tool with smart inbox and workflow automation, designed to integrate with Gmail.

## Project Overview

This project aims to build a tool that:
- Ingests and parses Gmail messages in real-time.
- Auto-summarizes emails and threads.
- Generates context-aware replies.
- Offers modes for auto-sending or reviewing drafts.
- Includes an admin dashboard for management and analytics.

This repository contains the code for Phase 1 (MVP).

## Tech Stack

- **Frontend & Web App Backend:** Next.js (React framework)
- **Gmail Integration (Add-on):** Google Apps Script
- **Authentication:** NextAuth.js (with Google Provider)
- **Database:** Google Cloud Firestore
- **LLM:** DeepSeek (via Vercel AI SDK - using packages `@ai-sdk/deepseek` and `ai`)
- **Real-time Notifications:** Google Cloud Pub/Sub (for Gmail push notifications)
- **Serverless Functions:** Google Cloud Functions (for Pub/Sub message handling)
- **Deployment (examples):** Vercel/Netlify for Next.js, GCP for backend services.

## Project Structure

-   `/nextjs-app`: Contains the Next.js web application (frontend and backend APIs).
-   `/apps-script-addon`: Contains the Google Workspace Add-on (Apps Script) for Gmail integration.
-   `/gcp-functions`: Contains Google Cloud Functions (e.g., for handling Pub/Sub messages).

## Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
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
4.  **Pub/Sub Topic:**
    *   Create a Pub/Sub topic (e.g., `ACTUAL_PUBSUB_TOPIC_NAME`). This name is referenced in the code.
    *   Grant the Gmail service account (`service-[PROJECT_NUMBER]@gcp-sa-gmail.iam.gserviceaccount.com`) the "Pub/Sub Publisher" role on this topic.
5.  **Firestore Database:**
    *   Create a Firestore database in Native mode.
    *   Set up basic security rules. Initial Firestore security rules have been refined to ensure users can only access and manage their own data, enhancing security.
6.  **Service Account for Firebase Admin (Next.js backend):**
    *   Go to IAM & Admin > Service Accounts.
    *   Create a new service account or use an existing one.
    *   Grant it roles like "Firestore User" (or more specific ones).
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
    # or
    yarn install
    ```
3.  **Set up Environment Variables:**
    *   **Manually create a file named `.env.local` in the `nextjs-app` directory.**
        *This step is manual due to limitations in programmatically creating this file in some environments.*
    *   Add the following variables, replacing placeholders with your actual values:

        ```env
        # Google OAuth Credentials (from GCP Console)
        GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
        GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"

        # NextAuth Configuration
        NEXTAUTH_URL="http://localhost:3000" # Change for production
        NEXTAUTH_SECRET="GENERATE_A_STRONG_SECRET_HERE" # e.g., openssl rand -base64 32

        # Firebase Admin SDK Credentials (from downloaded service account JSON key)
        FIREBASE_PROJECT_ID="ACTUAL_GCP_PROJECT_ID_FOR_FIRESTORE" # Should match the project where Firestore is
        FIREBASE_CLIENT_EMAIL="your-service-account-email@your-project-id.iam.gserviceaccount.com"
        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_COPIED_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n" # Ensure newlines are correctly escaped or use actual newlines if your system supports it
        
        # DeepSeek API Key
        DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY_HERE" # Your API key for DeepSeek LLM
        ```
    *   **Note on Project IDs**: The `FIREBASE_PROJECT_ID` in `.env.local` is used by the Firebase Admin SDK and should correspond to the project where your Firestore database is. The `ACTUAL_GCP_PROJECT_ID` placeholder in `nextjs-app/pages/api/gmail/watch.js` and in the Cloud Function deployment refers to the project ID for Pub/Sub and Cloud Functions. These may or may not be the same project depending on your setup. The `ACTUAL_GCP_PROJECT_ID` and `ACTUAL_PUBSUB_TOPIC_NAME` placeholders in `nextjs-app/pages/api/gmail/watch.js` and the `gcloud` deployment command for the Cloud Function need to be replaced directly in the code or ideally managed via environment variables in future development.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

5.  **Build for production:**
    ```bash
    npm run build
    ```

6.  **Start production server:**
    ```bash
    npm run start
    ```

### 3. Google Cloud Function (`gcp-functions/handleGmailNotification`)

This function is designed to be triggered by Pub/Sub messages from Gmail.

1.  **Navigate to the function directory:**
    ```bash
    cd ../gcp-functions/handleGmailNotification 
    # (Assuming you are in nextjs-app or project root)
    # cd email-productivity-tool/gcp-functions/handleGmailNotification (from anywhere)
    ```
2.  **Install dependencies (if any specific ones are needed for deployment packaging, though for simple functions, GCP handles it):**
    The `package.json` within the `gcp-functions/handleGmailNotification` directory lists the necessary dependencies (`@google-cloud/pubsub`, `@google-cloud/firestore`, `@ai-sdk/deepseek`, `ai`). These will be installed by GCP during deployment.
    ```bash
    # Manual npm install is usually not needed before deployment if package.json is correct.
    ```
3.  **Environment Variables**

    When deploying the `handleGmailNotification` Cloud Function, you need to set the following environment variables:

    -   `DEEPSEEK_API_KEY`: Your API key for the DeepSeek LLM service.
    -   `FIRESTORE_PROJECT_ID`: (Optional, but recommended for clarity) The GCP Project ID where your Firestore database is located. This is often the same as your main `ACTUAL_GCP_PROJECT_ID`. The Cloud Function's runtime usually has access to this if it's in the same project, but explicit configuration can be useful.

    These can be set during deployment using the `--set-env-vars` flag in the `gcloud` command, or via the GCP Console.

4.  **Required IAM Permissions**

    The service account used by this Cloud Function (e.g., `ACTUAL_GCP_PROJECT_ID@appspot.gserviceaccount.com` or a custom service account) needs the following IAM roles in your GCP project:

    -   **`Cloud Datastore User`**: To read from the `users` collection (to get Gmail tokens) and write to the `processedEmails` collection in Firestore.
    -   **`Pub/Sub Subscriber`**: (Usually configured automatically by the Pub/Sub trigger) To receive messages from the Pub/Sub topic.
    -   *(Outbound internet access is typically enabled by default and is required to call Google APIs and the DeepSeek API.)*
    
5.  **Deploy using `gcloud` CLI:**
    Replace `ACTUAL_GCP_PROJECT_ID` and `ACTUAL_PUBSUB_TOPIC_NAME` with your actual project ID and Pub/Sub topic name.
    Also, replace `YOUR_DEEPSEEK_API_KEY_HERE` with your actual key.
    If running from the project root directory (`email-productivity-tool`):
    ```bash
    gcloud functions deploy handleGmailNotification \
      --project ACTUAL_GCP_PROJECT_ID \
      --region YOUR_PREFERRED_REGION \
      --runtime nodejs18 \ # Or nodejs20, etc.
      --trigger-topic ACTUAL_PUBSUB_TOPIC_NAME \
      --entry-point handleGmailNotification \
      --source ./gcp-functions/handleGmailNotification \
      --set-env-vars DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY_HERE",FIRESTORE_PROJECT_ID="ACTUAL_GCP_PROJECT_ID" \
      --allow-unauthenticated
    ```
    *   The `--source ./gcp-functions/handleGmailNotification` assumes you are running the command from the project root. If running from within the `handleGmailNotification` directory, use `--source .`.
    *   *(Note: `allow-unauthenticated` is for the Pub/Sub trigger invocation, not general public access to an HTTP function).*

#### Features (Next.js App)

The Next.js web application provides the following main features for authenticated users:

-   **Processed Email Listing:** Displays a list of emails that have been automatically processed by the backend system (fetched and summarized). Shows key information like subject, sender, date, and a snippet or initial summary.
-   **Email Detail View:** Users can click on any email in the list to expand a detailed view. This view shows:
    -   The full fetched body of the email (`plainBody`).
    -   The complete AI-generated summary (if available).
-   **AI Actions on Listed Emails:** Within the detail view of a selected email, users can:
    -   **Re-summarize:** Trigger a new summarization for the selected email.
    -   **Generate Reply:** Draft a reply for the selected email. The reply generation uses the "Reply Context" and "Reply Tone" input fields currently located in the "Test AI Functions (with Direct Message ID)" section of the page.
-   **Direct AI Testing:** A separate section allows users to test summarization and reply generation by directly inputting a Gmail Message ID, along with context and tone for replies.
-   **Gmail Watch Setup:** A button to initiate the Gmail `watch` process for real-time notifications (requires backend Pub/Sub and Cloud Function to be fully configured).


### 4. Google Apps Script Add-on (`apps-script-addon`)

1.  **Using `clasp` (Command Line Apps Script Project manager):**
    *   Install `clasp`: `npm install -g @google/clasp`
    *   Log in: `clasp login`
    *   Clone an existing Apps Script project or create a new one:
        *   To create a new project: `clasp create --type standalone --title "Email Productivity Tool Addon"` (then copy `Code.gs` and `appsscript.json` content into it)
        *   Or, from within the `apps-script-addon` directory: `clasp push -f` (if a `.clasp.json` file pointing to an Apps Script project is configured).
2.  **Manual Setup (alternative to `clasp`):**
    *   Go to [script.google.com](https://script.google.com).
    *   Create a new project.
    *   Copy the content of `apps-script-addon/Code.gs` into the `Code.gs` file in the Apps Script editor.
    *   Open the manifest file by selecting `View > Show manifest file` (`appsscript.json`). Copy the content of `apps-script-addon/appsscript.json` into it.
3.  **Deploy the Add-on:**
    *   In the Apps Script editor, go to `Deploy > New deployment`.
    *   Choose "Add-on" as the deployment type.
    *   Follow the prompts to configure and deploy.
    *   You'll need to grant OAuth scopes during the authorization process when testing.

        #### Critical Configuration: Backend URL

        Before the add-on can function, you **must** edit the `apps-script-addon/Code.gs` file:
        -   Locate the line at the top: `const NEXTJS_APP_BASE_URL = "https://your-nextjs-app-deployment-url.com";`
        -   Replace `"https://your-nextjs-app-deployment-url.com"` with the actual deployed URL of your Next.js application.

        #### Functionality

        Once deployed and configured with the correct backend URL, the add-on provides the following features directly within Gmail when you open an email:

        -   **Summarize Email Button:** Clicking this button will send the current email's content (via its Message ID) to the backend service, which uses an LLM (DeepSeek) to generate a summary. The summary is then displayed in the add-on sidebar.
        -   **Draft Reply Button:** Users can input optional "Reply Context" (specific instructions) and select a "Tone" directly within the add-on sidebar. Clicking the button sends the current email's content along with this context and tone to the backend to generate a draft reply using the LLM. The draft reply is then displayed in the add-on.
        -   **Insert into Reply Composer:** After a draft reply is generated and shown, an "Insert into Reply Composer" button appears. Clicking this will take the generated text and open it directly in Gmail's native reply window for the current email thread, ready for review and sending.

        Authentication between the add-on and the Next.js backend is handled using Google Identity Tokens (`ScriptApp.getIdentityToken()`), which are verified by the backend.

        #### OAuth Scopes & Re-authorization

        The add-on requires specific permissions to function. The necessary OAuth scopes are listed in the `appsscript.json` file (including `https://www.googleapis.com/auth/gmail.addons.execute`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/script.container.ui`, `https://www.googleapis.com/auth/script.external_request`). 
        **Important:** With the addition of the "Insert into Reply Composer" feature, the scope `https://www.googleapis.com/auth/gmail.compose` has been added. Users who had previously authorized the add-on will need to **re-authorize it** to grant this new permission. This usually happens automatically when they try to use the add-on, or they might need to manage it via their Google account's third-party app settings if they encounter permission errors.

## Using the Application

1.  Start the Next.js application (`npm run dev`).
2.  Access the web app (default: `http://localhost:3000`).
3.  Sign in with your Google account.
4.  (Conceptually) Set up the Gmail watch via the UI button. This tells Gmail to send notifications to your Pub/Sub topic, which then triggers your Cloud Function.
5.  Install and authorize the Google Workspace Add-on in your Gmail account.
6.  Open an email in Gmail to see the add-on's contextual card.

## Testing the Notification Pipeline

After setting up all components:

1.  **Ensure Configurations are Live:**
    *   The Next.js application (`nextjs-app`) should be running (e.g., `npm run dev`).
    *   The Google Cloud Function (`handleGmailNotification`) must be deployed with the correct, actual values for `ACTUAL_GCP_PROJECT_ID` and `ACTUAL_PUBSUB_TOPIC_NAME`.
    *   Crucially, `nextjs-app/pages/api/gmail/watch.js` must have its `ACTUAL_GCP_PROJECT_ID` and `ACTUAL_PUBSUB_TOPIC_NAME` placeholders replaced with your real values, or these should be correctly sourced from environment variables if you've adapted the code to do so.
2.  **Trigger Watch Setup:**
    *   Log into the Next.js web application.
    *   Click the "Setup Gmail Watch" button. Verify any UI feedback for success.
3.  **Send Test Email:**
    *   Send a new email to the Gmail account you used to sign in and set up the watch.
4.  **Check Cloud Function Logs:**
    *   Navigate to your Cloud Function logs in the GCP console.
    *   Look for logs from `handleGmailNotification` indicating it received a Pub/Sub message (e.g., "Received Gmail notification:", followed by email and history ID). This confirms the pipeline from Gmail to Pub/Sub to your function is working.

### Testing the Next.js Web App UI

1.  **Prerequisites:**
    *   Ensure the Next.js application is running (`npm run dev`).
    *   Ensure you have signed in with your Google account.
    *   For email listing to show results, the real-time processing Cloud Function (`handleGmailNotification`) must have run and successfully processed some emails, storing them in the `processedEmails` Firestore collection.
    *   Ensure your `DEEPSEEK_API_KEY` (and other necessary environment variables like Google OAuth credentials and Firebase service account details) are correctly set in `nextjs-app/.env.local`.

2.  **Viewing Processed Emails:**
    *   Navigate to the application's homepage.
    *   The "Processed Emails" section should display a list of emails if any have been processed for your account.
    *   If the list is loading or an error occurs, appropriate messages will be shown.

3.  **Viewing Email Details:**
    *   Click on any email item in the list (or its "View Details" button).
    *   The item will expand to show the full email body and its summary.
    *   Click again (or "Hide Details") to collapse.

4.  **Using AI Actions on Listed Emails:**
    *   With an email's detail view expanded:
        *   Click "Re-summarize" to generate a new summary for that email. The result will appear in the "AI Action Response" section within that email's detail view.
        *   To generate a reply:
            *   Optionally, fill in the "Reply Context" textarea and select a "Reply Tone" from the dropdowns (these are currently located in the "Test AI Functions (with Direct Message ID)" section).
            *   Click the "Generate Reply for this Email" button.
            *   The draft reply will appear in the "AI Action Response" section within the detail view.

5.  **Direct AI Testing (Using Message ID Input):**
    *   You can still use the "Test AI Functions (with Direct Message ID)" section to test summarization or reply generation by manually entering a known Gmail Message ID. The "Reply Context" and "Reply Tone" fields in this section will be used for this direct test. The results will appear in the "API Response" section at the bottom if no specific email detail is expanded, or within the detail view if an email is selected and an action is taken there.

### Testing the Deployed Add-on

1.  **Deploy Next.js App:** Ensure your Next.js application is deployed to a public URL.
2.  **Configure Add-on:** Update the `NEXTJS_APP_BASE_URL` in `apps-script-addon/Code.gs` with your Next.js app's public URL.
3.  **Deploy Apps Script Add-on:** Deploy the add-on from the Apps Script editor (see setup instructions above).
4.  **Install/Enable Add-on in Gmail:** Install the deployed add-on for your Google Workspace account or enable it if it's a test deployment. If you've updated the add-on, you might be prompted to re-authorize it due to new permissions (like `gmail.compose` for inserting drafts). Please grant these permissions.
5.  **Open Gmail:** Refresh Gmail and open any email.
6.  **Use Add-on Buttons:**
    *   Click the "Summarize Email" button. After a moment, a summary should appear in the sidebar.
    *   To draft a reply: Optionally, fill in the 'Reply Context' textarea and select a 'Tone' from the dropdown within the add-on sidebar before clicking 'Generate Draft Reply'. A draft reply should appear.
    *   After a draft reply is shown, click the 'Insert into Reply Composer' button. Verify that a Gmail compose window opens with the draft reply pre-filled.
7.  **Verify Backend Calls:** Check the logs of your deployed Next.js application and the Apps Script project logs (in GCP or Apps Script editor) if you encounter issues.

## Next.js Backend API Endpoints

The `nextjs-app` provides several backend API endpoints under `/api/`:

#### `GET /api/gmail/getEmailContent`
Fetches the detailed content of a specific email message.
-   **Authentication:** User session required.
-   **Query Parameters:**
    -   `messageId` (string): The ID of the Gmail message to fetch.
-   **Response:**
    ```json
    {
      "docId": "messageId_as_doc_id",
      "messageId": "actual_message_id",
      "subject": "Email Subject",
      "from": "Sender <sender@example.com>",
      "date": "Email Date (ISO String or other consistent format)",
      "snippet": "Email snippet...",
      "summary": "AI-generated summary, if available",
      "status": "processing_status (e.g., summarized, summarization_failed)",
      "plainBody": "Full plain text body of the email...",
      "processedAt": "Timestamp of processing (ISO String)"
    }
    ```
(The response is an object `{ emails: [...] }` containing an array of such email objects.)

#### `POST /api/ai/summarize`
Summarizes the content of a given email message ID using the configured LLM (DeepSeek).
-   **Authentication:** User session required.
-   **Request Body:**
    ```json
    {
      "messageId": "<GMAIL_MESSAGE_ID>"
    }
    ```
-   **Response:**
    ```json
    {
      "summary": "Generated summary of the email."
    }
    ```

#### `POST /api/ai/generate-reply`
Generates a draft reply for a given email message ID using the configured LLM (DeepSeek).
-   **Authentication:** User session required.
-   **Request Body:**
    ```json
    {
      "messageId": "<GMAIL_MESSAGE_ID>",
      "replyContext": "<Optional: Specific instructions for the reply>",
      "tone": "<Optional: Desired tone, e.g., 'professional', 'casual'>"
    }
    ```
-   **Response:**
    ```json
    {
      "draftReply": "Generated draft reply text."
    }
    ```
(Other API endpoints like `/api/auth/*` and `/api/gmail/watch` also exist but are detailed elsewhere.)


### Testing Email Summarization

1.  **Ensure API Key is Set:** Verify that your `DEEPSEEK_API_KEY` is correctly set in `nextjs-app/.env.local`.
2.  **Run the Application:** Start the Next.js development server (`npm run dev` from the `nextjs-app` directory).
3.  **Log In:** Open the application in your browser (e.g., `http://localhost:3000`) and sign in with your Google account.
4.  **Obtain a Gmail Message ID:**
    *   Open Gmail in your web browser for the account you logged in with.
    *   Find an email you want to summarize.
    *   Click the three vertical dots ("More options") on the email and select "Show original".
    *   In the "Original Message" view, look for the `Message-ID:` header (e.g., `Message-ID: <CAMsA7+-c50G_R_SUB_EXAMPLE_ID@mail.gmail.com>`).
    *   Copy the ID *without* the angle brackets (e.g., `CAMsA7+-c50G_R_SUB_EXAMPLE_ID@mail.gmail.com`).
5.  **Test Summarization:**
    *   On the application's homepage, paste the copied Message ID into the "Enter Gmail Message ID" input field.
    *   Click the "Get Summary" button.
    *   The generated summary from DeepSeek should appear in the "API Response" section. If there are errors, they will be displayed there.

### Testing Email Reply Generation

1.  **Ensure API Key is Set:** Verify that your `DEEPSEEK_API_KEY` is correctly set in `nextjs-app/.env.local`.
2.  **Run the Application:** Start the Next.js development server (`npm run dev` from the `nextjs-app` directory).
3.  **Log In:** Open the application in your browser (e.g., `http://localhost:3000`) and sign in with your Google account.
4.  **Obtain a Gmail Message ID:** Follow the steps outlined in "Testing Email Summarization" to get a Message ID for an email you wish to reply to.
5.  **Test Reply Generation:**
    *   On the application's homepage, paste the copied Message ID into the "Enter Gmail Message ID" input field.
    *   Optionally, enter specific instructions in the "Optional: Specific instructions for the reply" textarea (e.g., "Ask for clarification on their budget.").
    *   Optionally, select a desired "Tone for the reply" from the dropdown (e.g., "Casual").
    *   Click the "Generate Reply" button.
    *   The generated draft reply from DeepSeek should appear in the "API Response" section, formatted as "Draft Reply: ...".

## Admin Dashboard

The Admin Dashboard provides administrators with tools for application monitoring, user management, and viewing processed data. It is accessible via the `/admin` route for authorized admin users.

### Becoming an Administrator

To access the Admin Dashboard, a user must be designated as an administrator. This is done by manually setting a field in their user document within Firestore:

1.  **Open Firestore:** Navigate to your Firebase project in the Google Cloud Console, then go to "Firestore Database".
2.  **Locate the `users` Collection:** Find the `users` collection.
3.  **Identify the User Document:** User documents are named with their unique Google User ID (`sub`). Find the document for the user you wish to make an admin (you can identify them by the `email` field within the document).
4.  **Add/Set `isAdmin` Field:**
    *   Select the user document.
    *   Click "Add field" (or edit if the field exists).
        *   **Field name:** `isAdmin`
        *   **Field type:** `boolean`
        *   **Field value:** `true`
    *   Save/Update the document.

The Next.js middleware protecting `/admin/*` routes will check this field upon login.

### Features

The initial version of the Admin Dashboard includes:

-   **Dashboard Home (`/admin`):** A landing page with placeholder statistics.
-   **Manage Users (`/admin/users`):**
    -   Displays a paginated list of all registered users with their ID (Google SUB), name, email, admin status, and join date.
    -   Powered by the `GET /api/admin/users/list` API endpoint.
-   **Processed Emails (`/admin/processedEmails`):**
    -   Displays a paginated list of all emails processed by the system's backend.
    -   Shows Message ID, associated User ID, subject, sender, processing status, a snippet of the summary, and the processed date.
    -   Includes options to filter the list by User ID and by processing status.
    -   Powered by the `GET /api/admin/emails/listAll` API endpoint.

This README provides a starting point for setting up and running the MVP.
```
