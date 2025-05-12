# File Sharing Platform - Workflow Diagrams

## 1. File Upload and Sharing Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant API as API Routes
    participant Storage as Supabase Storage
    participant DB as Supabase DB
    participant Notify as Notification Service

    %% Upload Flow
    User->>UI: Select File(s)
    UI->>API: Upload Request
    API->>Storage: Store File
    Storage-->>API: File URL
    API->>DB: Create File Record
    DB-->>API: Success
    API-->>UI: Upload Complete
    UI-->>User: Show Success

    %% Sharing Flow
    User->>UI: Click Share
    UI->>UI: Show Share Modal
    User->>UI: Configure Share Settings
    UI->>API: Generate Share Link
    API->>DB: Create Access Record
    DB-->>API: Access Token
    API->>Notify: Create Share Notification
    API-->>UI: Return Share Link
    UI-->>User: Display Share Link
```

## 2. Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant Auth as Auth API
    participant Supabase as Supabase Auth
    participant DB as Database

    %% Registration
    User->>UI: Enter Registration Details
    UI->>Auth: Submit Registration
    Auth->>Supabase: Create User
    Supabase->>User: Send Verification Email
    User->>Supabase: Click Verify Link
    Supabase-->>Auth: Confirm Email
    Auth->>DB: Create User Profile
    Auth-->>UI: Registration Complete
    UI-->>User: Show Dashboard

    %% Login
    User->>UI: Enter Login Details
    UI->>Auth: Submit Login
    Auth->>Supabase: Verify Credentials
    Supabase-->>Auth: Return JWT
    Auth->>DB: Get User Profile
    DB-->>Auth: Profile Data
    Auth-->>UI: Login Success
    UI-->>User: Show Dashboard
```

## 3. Access Control Mechanism

```mermaid
sequenceDiagram
    actor Recipient
    participant UI as Frontend
    participant API as API Routes
    participant Access as Access Control
    participant DB as Database
    participant Storage as File Storage

    %% Access Request
    Recipient->>UI: Open Share Link
    UI->>API: Verify Access
    API->>Access: Check Permissions
    Access->>DB: Query Access Rules
    DB-->>Access: Access Settings

    alt Password Protected
        Access-->>UI: Request Password
        Recipient->>UI: Enter Password
        UI->>Access: Validate Password
    end

    alt Requires Approval
        Access-->>UI: Show Request Form
        Recipient->>UI: Submit Request
        UI->>API: Send Access Request
        API->>DB: Store Request
        API->>Access: Notify Owner
    else Direct Access
        Access->>Storage: Get File
        Storage-->>API: File Data
        API-->>UI: File Content
        UI-->>Recipient: Show/Download File
    end
```

## 4. Notification System

```mermaid
flowchart TD
    subgraph Events["Event Types"]
        FileShare["File Shared"]
        AccessRequest["Access Requested"]
        AccessGranted["Access Granted"]
        AccessDenied["Access Denied"]
    end

    subgraph Handler["Notification Handler"]
        Process["Process Event"]
        Create["Create Notification"]
        Store["Store in Database"]
    end

    subgraph Delivery["Delivery Methods"]
        InApp["In-App Alert"]
        Email["Email"]
        Push["Push Notification"]
    end

    Events --> Handler
    Handler --> Delivery

    Process --> Create
    Create --> Store
    Store --> InApp
    Store --> Email
    Store --> Push