# AIBMS - System Architecture

This document provides a comprehensive overview of the AIBMS system architecture, illustrating the interactions between the client layer, backend application services, asynchronous workers, data storage, and external AI integrations.

## Architecture Diagram

```mermaid
flowchart LR
    %% Subgraphs for logical grouping
    subgraph Client ["Client Tier"]
        Web["Web Application (React / Vite)"]
    end

    subgraph Core ["Application Tier (Django)"]
        API["REST API Gateway"]
        Auth["Authentication (JWT)"]
        Biz["Business & Branches"]
        Cash["Digital Cashbook"]
        Doc["Document Intelligence"]
        Chat["CA Assistant (Chatbot)"]
        
        API --> Auth
        API --> Biz
        API --> Cash
        API --> Doc
        API --> Chat
    end

    subgraph Async ["Async Task Processing"]
        Worker["Celery Workers"]
        Beat["Celery Scheduler"]
    end

    subgraph Data ["Data & Persistence"]
        DB[("PostgreSQL")]
        Cache[("Redis Cache/Broker")]
        S3[("AWS S3 Storage")]
    end

    subgraph AI ["External AI Services"]
        Gemini["Google Gemini"]
        Speech["AssemblyAI & Murf"]
    end

    %% Connections between main layers
    Client -- "HTTPS / JSON" --> API
    
    %% Backend to Data
    Core -- "Read/Write Data" --> DB
    Core -- "Store Files" --> S3
    Core -- "Read/Write Cache" --> Cache
    
    %% Async interactions
    Core -- "Enqueue Task" --> Cache
    Cache -- "Consume Task" --> Worker
    Worker -- "Update Status" --> DB
    Beat -- "Trigger Schedule" --> Cache
    
    %% AI Interactions
    Chat -- "Voice I/O" --> Speech
    Chat -- "Natural Language" --> Gemini
    Doc -- "Document OCR" --> Gemini
    Worker -- "Background Analysis" --> Gemini

    %% Styling
    classDef client fill:#E1F5FE,stroke:#0288D1,stroke-width:2px,color:#000
    classDef core fill:#E8F5E9,stroke:#388E3C,stroke-width:2px,color:#000
    classDef async fill:#FFF3E0,stroke:#F57C00,stroke-width:2px,color:#000
    classDef data fill:#FFEBEE,stroke:#D32F2F,stroke-width:2px,color:#000
    classDef ai fill:#ECEFF1,stroke:#455A64,stroke-width:2px,color:#000

    class Web client
    class API,Auth,Biz,Cash,Doc,Chat core
    class Worker,Beat async
    class DB,Cache,S3 data
    class Gemini,Speech ai
```

## Component Breakdown

### 1. Client Tier
- **React/Vite SPA**: The frontend application built with React 18 and Vite. It handles complex UI states (Dashboards, Chat interfaces) and securely stores the JWT in local storage.

### 2. API Gateway
- **NGINX**: Serves as the reverse proxy and load balancer. It handles SSL termination, static file serving (if required), and routes incoming RESTful API requests to the Django backend.

### 3. Application Tier (Django Backend)
- **Django REST Framework (DRF)**: The core API engine handling all incoming requests, validating data, and returning JSON responses.
- **JWT Authentication**: Secures endpoints and enforces Role-Based Access Control logic (e.g., verifying if a user is an Owner vs. Staff).
- **Core Modules**: Independent, decoupled Django apps (Business, Cashbook, Documents, Chatbot) that contain the specific business logic for AIBMS.

### 4. Asynchronous Task Processing
- **Celery & Redis**: For heavy, time-consuming operations (e.g., AI document parsing, batch data processing), the backend offloads tasks to Celery workers. Redis acts as both the message broker to queue these tasks and a caching layer to speed up recurring database queries.

### 5. Data & Persistence Tier
- **PostgreSQL**: The primary relational database ensuring ACID compliance for critical financial ledgers and user data.
- **AWS S3**: Cloud object storage handling the persistence of uploaded invoices, receipts, and system-generated audio files (Murf AI responses).

### 6. External AI Services
- **Google Gemini**: The generative AI backbone responsible for interpreting natural language intents, answering knowledge queries, and extracting structured financial data from uploaded documents.
- **AssemblyAI**: Converts user audio streams into text for the chatbot.
- **Murf AI**: Generates natural, conversational audio responses from the chatbot's text replies.
