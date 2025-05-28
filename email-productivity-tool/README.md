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
    *   Create a Pub/Sub topic (e.g., `gmail-push-notifications-placeholder`). This name is referenced in the code.
    *   Grant the Gmail service account (`service-[PROJECT_NUMBER]@gcp-sa-gmail.iam.gserviceaccount.com`) the "Pub/Sub Publisher" role on this topic.
5.  **Firestore Database:**
    *   Create a Firestore database in Native mode.
    *   Set up basic security rules.
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
        FIREBASE_PROJECT_ID="YOUR_GCP_PROJECT_ID" # Should match the project where Firestore is
        FIREBASE_CLIENT_EMAIL="your-service-account-email@your-project-id.iam.gserviceaccount.com"
        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_COPIED_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n" # Ensure newlines are correctly escaped or use actual newlines if your system supports it
        ```

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
    ```bash
    # Usually not needed if package.json is simple and dependencies are in `dependencies` field.
    # npm install 
    ```
3.  **Deploy using `gcloud` CLI:**
    Replace `YOUR_GCP_PROJECT_ID` and `gmail-push-notifications-placeholder` with your actual project ID and Pub/Sub topic name.
    ```bash
    gcloud functions deploy handleGmailNotification \
      --project YOUR_GCP_PROJECT_ID \
      --region YOUR_PREFERRED_REGION \
      --runtime nodejs18 \ # Or your preferred Node.js runtime
      --trigger-topic gmail-push-notifications-placeholder \
      --entry-point handleGmailNotification \
      --source . \
      --allow-unauthenticated # If called directly by Pub/Sub (standard for Gmail push)
    ```
    *   The `--source .` assumes you are running the command from within the `handleGmailNotification` directory.

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

## Using the Application

1.  Start the Next.js application (`npm run dev`).
2.  Access the web app (default: `http://localhost:3000`).
3.  Sign in with your Google account.
4.  (Conceptually) Set up the Gmail watch via the UI button. This tells Gmail to send notifications to your Pub/Sub topic, which then triggers your Cloud Function.
5.  Install and authorize the Google Workspace Add-on in your Gmail account.
6.  Open an email in Gmail to see the add-on's contextual card.

This README provides a starting point for setting up and running the MVP.
```
