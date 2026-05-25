# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [pnpm-workspace.yaml](file://pnpm-workspace.yaml)
- [pnpm-lock.yaml](file://pnpm-lock.yaml)
- [prisma/schema.prisma](file://prisma/schema.prisma)
- [prisma/seed.ts](file://prisma/seed.ts)
- [lib/auth.ts](file://lib/auth.ts)
- [lib/crypto.ts](file://lib/crypto.ts)
- [lib/gitlab.ts](file://lib/gitlab.ts)
- [lib/prisma.ts](file://lib/prisma.ts)
- [next.config.mjs](file://next.config.mjs)
- [app/api/gitlab/validate-token/route.ts](file://app/api/gitlab/validate-token/route.ts)
- [app/api/gitlab/projects/route.ts](file://app/api/gitlab/projects/route.ts)
</cite>

## Update Summary
**Changes Made**
- Updated installation instructions to reflect migration from npm to pnpm package manager
- Updated prerequisite requirements to specify pnpm as the package manager
- Updated Docker build process to use pnpm for dependency installation
- Added pnpm workspace configuration information
- Updated troubleshooting guidance to address pnpm-specific issues

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
**Updated** The project has been rebranded as "极报" (Extreme Report), a Next.js 14 full-stack application that generates daily reports from self-hosted GitLab commits. It supports multi-user accounts, MySQL persistence, optional AI polish via an OpenAI-compatible LLM, and secure storage of GitLab tokens. This guide walks you through prerequisites, installation, local development, first-time configuration, and production deployment with Docker Compose.

**Section sources**
- [README.md:1-3](file://README.md#L1-L3)

## Project Structure
At a high level, the project consists of:
- Frontend pages under app/ (Next.js App Router)
- API routes under app/api/ (Next.js App Router)
- Shared libraries under lib/
- Database schema and seed logic under prisma/
- Build and runtime configuration files (Dockerfile, docker-compose.yml, next.config.mjs, package.json)
- Workspace configuration under pnpm-workspace.yaml

```mermaid
graph TB
subgraph "App Router Pages"
P1["app/page.tsx"]
P2["app/settings/page.tsx"]
P3["app/history/page.tsx"]
P4["app/login/page.tsx"]
end
subgraph "API Routes"
A1["app/api/gitlab/validate-token/route.ts"]
A2["app/api/gitlab/projects/route.ts"]
A3["app/api/reports/route.ts"]
A4["app/api/templates/route.ts"]
A5["app/api/admin/users/route.ts"]
end
subgraph "Libraries"
L1["lib/auth.ts"]
L2["lib/crypto.ts"]
L3["lib/gitlab.ts"]
L4["lib/prisma.ts"]
end
subgraph "Database"
D1["prisma/schema.prisma"]
D2["prisma/seed.ts"]
end
subgraph "Runtime Config"
C1["next.config.mjs"]
C2["Dockerfile"]
C3["docker-compose.yml"]
C4["package.json"]
C5["pnpm-workspace.yaml"]
end
P1 --> A3
P2 --> A1
P2 --> A2
A1 --> L2
A1 --> L3
A1 --> L4
A2 --> L4
A3 --> L4
A4 --> L4
A5 --> L4
L1 --> L4
L3 --> L4
D1 --> L4
D2 --> L4
C1 --> C2
C2 --> C3
C4 --> C2
C5 --> C2
```

**Diagram sources**
- [next.config.mjs:1-11](file://next.config.mjs#L1-L11)
- [Dockerfile:1-44](file://Dockerfile#L1-L44)
- [docker-compose.yml:1-21](file://docker-compose.yml#L1-L21)
- [package.json:1-51](file://package.json#L1-L51)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)
- [prisma/schema.prisma:1-81](file://prisma/schema.prisma#L1-L81)
- [prisma/seed.ts:1-63](file://prisma/seed.ts#L1-L63)
- [lib/auth.ts:1-77](file://lib/auth.ts#L1-L77)
- [lib/crypto.ts:1-46](file://lib/crypto.ts#L1-L46)
- [lib/gitlab.ts:1-172](file://lib/gitlab.ts#L1-L172)
- [lib/prisma.ts:1-14](file://lib/prisma.ts#L1-L14)
- [app/api/gitlab/validate-token/route.ts:1-88](file://app/api/gitlab/validate-token/route.ts#L1-L88)
- [app/api/gitlab/projects/route.ts:1-163](file://app/api/gitlab/projects/route.ts#L1-L163)

**Section sources**
- [README.md:130-180](file://README.md#L130-L180)
- [package.json:1-51](file://package.json#L1-L51)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)
- [next.config.mjs:1-11](file://next.config.mjs#L1-L11)

## Core Components
- Authentication and sessions powered by NextAuth.js with JWT strategy and credentials provider.
- Database ORM via Prisma targeting MySQL with a generated client.
- GitLab integration through server-side route handlers that proxy API calls and securely store tokens.
- Encryption utilities for GitLab personal access tokens at rest.
- Seed script that provisions an initial admin user and default template.
- Workspace configuration managed through pnpm workspace.

Key implementation references:
- Authentication configuration and JWT/session callbacks
- Encryption/decryption and token masking
- GitLab client helpers for user, projects, and commits
- Prisma client initialization and logging behavior
- Seed script for admin and default template creation
- pnpm workspace configuration for dependency management

**Section sources**
- [lib/auth.ts:30-77](file://lib/auth.ts#L30-L77)
- [lib/crypto.ts:7-46](file://lib/crypto.ts#L7-L46)
- [lib/gitlab.ts:45-172](file://lib/gitlab.ts#L45-L172)
- [lib/prisma.ts:7-14](file://lib/prisma.ts#L7-L14)
- [prisma/seed.ts:19-53](file://prisma/seed.ts#L19-L53)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)

## Architecture Overview
The system follows a layered architecture:
- Presentation: Next.js App Router pages and components
- API Layer: Route handlers under app/api/ implementing CRUD and integrations
- Domain Services: Authentication, encryption, GitLab client
- Persistence: Prisma client with MySQL
- Package Management: pnpm workspace for efficient dependency management

```mermaid
graph TB
UI["Browser UI<br/>app/pages"] --> API["API Routes<br/>app/api/*"]
API --> AUTH["Auth<br/>lib/auth.ts"]
API --> GIT["GitLab Client<br/>lib/gitlab.ts"]
API --> ENC["Encryption<br/>lib/crypto.ts"]
API --> PRISMA["Prisma Client<br/>lib/prisma.ts"]
PRISMA --> DB["MySQL Database"]
AUTH --> PRISMA
ENC --> PRISMA
GIT --> GLAPI["GitLab REST API"]
PKG["Package Management<br/>pnpm workspace"] --> UI
PKG --> API
PKG --> PRISMA
```

**Diagram sources**
- [lib/auth.ts:30-77](file://lib/auth.ts#L30-L77)
- [lib/crypto.ts:17-38](file://lib/crypto.ts#L17-L38)
- [lib/gitlab.ts:45-80](file://lib/gitlab.ts#L45-L80)
- [lib/prisma.ts:7-14](file://lib/prisma.ts#L7-L14)
- [prisma/schema.prisma:6-9](file://prisma/schema.prisma#L6-L9)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)

## Detailed Component Analysis

### Prerequisites
- Node.js 20.x
- pnpm (package manager for dependency management)
- MySQL 5.7+ or compatible
- Docker and Docker Compose for production deployment

Verification steps:
- Confirm Node.js and pnpm versions
- Verify MySQL connectivity and database availability
- Ensure Docker daemon is running for production deployment

**Section sources**
- [README.md:50-55](file://README.md#L50-L55)
- [package.json:5-14](file://package.json#L5-L14)
- [docker-compose.yml:1-21](file://docker-compose.yml#L1-L21)

### Step-by-Step Installation
1. Install dependencies
   - Run `pnpm install` to install dependencies using pnpm package manager.
2. Prepare environment variables
   - Copy the example environment file and configure required variables.
3. Apply database migrations
   - Run the Prisma migration command to create tables.
4. Seed the database
   - Execute the seed script to create the initial admin user and default template.
5. Start the development server
   - Launch the Next.js dev server.

Verification:
- Access the app at the development port and log in with the seeded admin credentials.

**Section sources**
- [README.md:56-75](file://README.md#L56-L75)
- [package.json:5-14](file://package.json#L5-L14)

### Environment Configuration
Required environment variables (see the project's documentation):
- DATABASE_URL: MySQL connection string
- NEXTAUTH_URL: External URL of the application
- NEXTAUTH_SECRET: Secret for NextAuth
- ENCRYPTION_KEY: 64-character hex string for encrypting tokens at rest
- LLM_API_BASE / LLM_API_KEY / LLM_MODEL: Optional for AI polish
- ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_DISPLAY_NAME: Seed-only initial admin

Notes:
- The encryption key must be exactly 64 hex characters.
- The seed script uses ADMIN_* variables to provision the initial admin.

**Section sources**
- [README.md:114-128](file://README.md#L114-L128)
- [lib/crypto.ts:8-15](file://lib/crypto.ts#L8-L15)
- [prisma/seed.ts:20-22](file://prisma/seed.ts#L20-L22)

### Local Development Setup
- Database migration: apply Prisma migrations for the development schema.
- Seeding: run the seed script to create the admin user and default template.
- Development server: start the Next.js dev server.

```mermaid
flowchart TD
Start(["Start"]) --> Install["Run pnpm install"]
Install --> Migrate["Run Prisma migrate dev"]
Migrate --> Seed["Run seed script"]
Seed --> Dev["Start Next.js dev server"]
Dev --> Verify["Open app in browser"]
Verify --> End(["Ready"])
```

**Diagram sources**
- [README.md:56-75](file://README.md#L56-L75)
- [package.json:11-14](file://package.json#L11-L14)

**Section sources**
- [README.md:50-75](file://README.md#L50-L75)
- [package.json:11-14](file://package.json#L11-L14)

### First-Time Configuration Workflow
After launching the app:
1. Log in with the seeded admin credentials.
2. Navigate to Settings and configure GitLab:
   - Enter the GitLab base URL.
   - Provide a Personal Access Token with required scopes.
   - Save and validate to persist the base URL and optionally the token.
3. Select projects:
   - The system fetches your project list; select projects you commit to.
   - Optionally set a non-default branch per project.
4. Customize templates:
   - Optionally edit the noise regex and create custom Handlebars templates.

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "Settings Page"
participant API as "API : validate-token"
participant GL as "GitLab API"
participant DB as "Prisma"
U->>UI : "Enter GitLab base URL and token"
UI->>API : "POST validate-token"
API->>GL : "Validate token and fetch user"
GL-->>API : "User info"
API->>DB : "Persist base URL, optional token, user info"
API->>GL : "Fetch projects"
GL-->>API : "Project list"
API->>DB : "Upsert project cache"
API-->>UI : "Validation result"
UI-->>U : "Show project list and branches"
```

**Diagram sources**
- [app/api/gitlab/validate-token/route.ts:13-80](file://app/api/gitlab/validate-token/route.ts#L13-L80)
- [lib/gitlab.ts:87-111](file://lib/gitlab.ts#L87-L111)
- [lib/crypto.ts:18-38](file://lib/crypto.ts#L18-L38)
- [lib/prisma.ts:7-14](file://lib/prisma.ts#L7-L14)

**Section sources**
- [README.md:91-98](file://README.md#L91-L98)
- [app/api/gitlab/validate-token/route.ts:13-80](file://app/api/gitlab/validate-token/route.ts#L13-L80)
- [app/api/gitlab/projects/route.ts:6-41](file://app/api/gitlab/projects/route.ts#L6-L41)

### Production Deployment with Docker Compose
- Build and start the service using the provided compose file.
- The container applies Prisma migrations on startup and runs the standalone server.
- Configure environment variables via the compose file's environment block.

```mermaid
flowchart TD
DC["docker-compose.yml"] --> Build["Build image"]
Build --> Run["Start container"]
Run --> Migrate["Prisma migrate deploy"]
Migrate --> Start["Start Next.js server"]
Start --> Listen["Listen on port 3000"]
```

**Diagram sources**
- [docker-compose.yml:1-21](file://docker-compose.yml#L1-L21)
- [Dockerfile:43-44](file://Dockerfile#L43-L44)

**Section sources**
- [README.md:99-113](file://README.md#L99-L113)
- [docker-compose.yml:10-20](file://docker-compose.yml#L10-L20)
- [Dockerfile:43-44](file://Dockerfile#L43-L44)

### Security Considerations During Initial Setup
- GitLab tokens are encrypted at rest using AES-256-GCM and never exposed to the browser.
- All GitLab API calls are proxied server-side through route handlers.
- Passwords are stored as bcrypt hashes.
- Rotate the encryption key carefully: re-encrypt existing tokens or require users to re-enter their PAT.

**Section sources**
- [README.md:210-216](file://README.md#L210-L216)
- [lib/crypto.ts:18-38](file://lib/crypto.ts#L18-L38)
- [lib/gitlab.ts:3-4](file://lib/gitlab.ts#L3-L4)

## Dependency Analysis
- Next.js 14 App Router with TypeScript
- Prisma client for MySQL
- NextAuth.js for credentials-based JWT sessions
- GitLab REST API integration via server-side route handlers
- Tailwind CSS and react-md-editor for UI
- Optional OpenAI-compatible LLM for AI polish
- pnpm workspace for efficient dependency management

```mermaid
graph LR
Next["Next.js 14"] --> Auth["NextAuth.js"]
Next --> UI["Tailwind + react-md-editor"]
Next --> Prisma["@prisma/client"]
Next --> Git["GitLab API"]
Next --> LLM["Optional LLM"]
PNPM["pnpm workspace"] --> Next
PNPM --> Prisma
PNPM --> Auth
PNPM --> Git
```

**Diagram sources**
- [package.json:16-31](file://package.json#L16-L31)
- [next.config.mjs:1-11](file://next.config.mjs#L1-L11)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)

**Section sources**
- [package.json:16-45](file://package.json#L16-L45)
- [next.config.mjs:1-11](file://next.config.mjs#L1-L11)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)

## Performance Considerations
- Use the production-ready standalone output and minimal base image for containerized deployments.
- Keep Prisma client logs scoped to errors in production to reduce overhead.
- Limit pagination and safety caps when fetching GitLab resources to avoid long-running requests.
- pnpm provides improved performance and workspace configuration compared to npm.

## Troubleshooting Guide
Common setup issues and resolutions:
- Database connection failures
  - Verify DATABASE_URL format and network accessibility.
  - Ensure the database exists and credentials are correct.
- Migration errors
  - Re-run the Prisma migration command and check schema correctness.
- Authentication failures
  - Confirm NEXTAUTH_SECRET length and NEXTAUTH_URL reachability.
  - Ensure bcrypt compatibility and correct credential input.
- Encryption key errors
  - The encryption key must be a 64-character hex string; regenerate if invalid.
- GitLab token validation failures
  - Confirm token scopes and base URL correctness.
  - Check network timeouts and rate limits.
- Docker build or runtime issues
  - Ensure Docker daemon is running and images build successfully.
  - Verify environment variables passed via compose.
- pnpm-specific issues
  - Clear pnpm cache if encountering dependency conflicts: `pnpm store prune`
  - Use `pnpm install --frozen-lockfile` to ensure lockfile integrity
  - Check for workspace configuration issues in pnpm-workspace.yaml

Verification steps:
- After setup, log in, validate GitLab configuration, and confirm project list loading.
- Generate a test report and review the history view.

**Section sources**
- [README.md:50-55](file://README.md#L50-L55)
- [README.md:114-128](file://README.md#L114-L128)
- [lib/crypto.ts:8-15](file://lib/crypto.ts#L8-L15)
- [lib/gitlab.ts:58-80](file://lib/gitlab.ts#L58-L80)
- [docker-compose.yml:10-20](file://docker-compose.yml#L10-L20)
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)

## Conclusion
You now have the essentials to install, configure, and run 极报 (Extreme Report) locally and in production using pnpm as the package manager. Complete the first-time configuration by connecting GitLab, selecting projects, and customizing templates. For production, rely on the provided Docker Compose setup and ensure environment variables are correctly configured. The pnpm workspace configuration provides improved performance and dependency management compared to traditional npm setups.

## Appendices

### Environment Variables Reference
- DATABASE_URL: MySQL connection string
- NEXTAUTH_URL: External URL of the app
- NEXTAUTH_SECRET: Secret for NextAuth
- ENCRYPTION_KEY: 64-character hex string for token encryption
- LLM_API_BASE / LLM_API_KEY / LLM_MODEL: Optional for AI polish
- ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_DISPLAY_NAME: Seed-only initial admin

**Section sources**
- [README.md:114-128](file://README.md#L114-L128)
- [docker-compose.yml:10-20](file://docker-compose.yml#L10-L20)

### pnpm Workspace Configuration
The project uses pnpm workspace for efficient dependency management:
- Workspace allows for monorepo-style dependency sharing
- Build optimization enabled for Prisma and related packages
- Lockfile ensures consistent dependency versions across environments

**Section sources**
- [pnpm-workspace.yaml:1-7](file://pnpm-workspace.yaml#L1-L7)
- [pnpm-lock.yaml:1-800](file://pnpm-lock.yaml#L1-L800)