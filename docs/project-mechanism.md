# File Sharing Platform - Project Mechanism

```mermaid
graph TD
    %% User Interface Layer
    subgraph UI["User Interface"]
        Landing["Landing Page (/)"]
        Auth["Authentication Pages"]
        Dashboard["Dashboard (/dashboard)"]
        MyFiles["My Files (/my-files)"]
        SharedFiles["Shared Files (/shared-files)"]
        Profile["Profile (/profile)"]
        Settings["Settings (/settings)"]
    end

    %% Core Features
    subgraph Features["Core Features"]
        FileUpload["File Upload System"]
        FileShare["File Sharing System"]
        AccessControl["Access Control"]
        Notifications["Notification System"]
        Search["Search System"]
    end

    %% Backend Services
    subgraph Backend["Backend Services"]
        AuthService["Authentication Service"]
        FileService["File Service"]
        ShareService["Share Service"]
        NotifyService["Notification Service"]
        SearchService["Search Service"]
    end

    %% Storage & Database
    subgraph Infrastructure["Infrastructure"]
        SupabaseAuth["Supabase Auth"]
        SupabaseDB["Supabase Database"]
        SupabaseStorage["Supabase Storage"]
    end

    %% User Flow Connections
    Landing --> Auth
    Auth --> SupabaseAuth
    Auth --> Dashboard

    %% Dashboard Connections
    Dashboard --> MyFiles
    Dashboard --> SharedFiles
    Dashboard --> Profile
    Dashboard --> Settings

    %% Feature Connections
    MyFiles --> FileUpload
    MyFiles --> FileShare
    MyFiles --> Search
    SharedFiles --> AccessControl
    SharedFiles --> Search

    %% Service Connections
    FileUpload --> FileService
    FileShare --> ShareService
    AccessControl --> ShareService
    Notifications --> NotifyService
    Search --> SearchService

    %% Infrastructure Connections
    FileService --> SupabaseStorage
    FileService --> SupabaseDB
    ShareService --> SupabaseDB
    NotifyService --> SupabaseDB
    SearchService --> SupabaseDB
    AuthService --> SupabaseAuth

    %% Data Tables
    subgraph Database["Database Tables"]
        Profiles["profiles
        - id
        - email
        - full_name
        - avatar_url"]
        
        Files["files
        - id
        - name
        - path
        - size
        - type
        - user_id
        - shared"]
        
        Access["file_access_requests
        - id
        - file_id
        - requester_id
        - owner_id
        - status"]
        
        UserSettings["user_settings
        - id
        - two_factor_enabled
        - private_files_default
        - require_approval"]
        
        NotificationTable["notifications
        - id
        - user_id
        - type
        - message
        - read"]
    end

    %% Database Relationships
    SupabaseDB --> Profiles
    SupabaseDB --> Files
    SupabaseDB --> Access
    SupabaseDB --> UserSettings
    SupabaseDB --> NotificationTable

    %% Key Processes
    subgraph Processes["Key Processes"]
        direction TB
        Upload["File Upload Process
        1. Select file
        2. Upload to storage
        3. Create DB record
        4. Generate preview"]

        Share["File Sharing Process
        1. Generate share link
        2. Set permissions
        3. Create access record
        4. Send notification"]

        Access["Access Control Process
        1. Verify permissions
        2. Check expiration
        3. Validate password
        4. Grant access"]
    end

    %% Process Connections
    FileUpload --> Upload
    FileShare --> Share
    AccessControl --> Access

    %% Component Features
    subgraph Components["UI Components"]
        direction TB
        Layout["Layout Components
        - Navbar
        - Sidebar
        - Footer"]
        
        FileComps["File Components
        - FileCard
        - FileUpload
        - ShareModal"]
        
        AuthComps["Auth Components
        - LoginForm
        - RegisterForm
        - VerificationAlert"]
        
        UIComps["UI Components
        - Buttons
        - Inputs
        - Modals
        - Toast"]
    end

    %% Component Usage
    UI --> Components