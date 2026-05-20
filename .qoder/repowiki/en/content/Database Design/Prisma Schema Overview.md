# Prisma Schema Overview

<cite>
**Referenced Files in This Document**
- [schema.prisma](file://prisma/schema.prisma)
- [prisma.ts](file://lib/prisma.ts)
- [seed.ts](file://prisma/seed.ts)
- [package.json](file://package.json)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [README.md](file://README.md)
- [auth.ts](file://lib/auth.ts)
- [crypto.ts](file://lib/crypto.ts)
</cite>

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

## Introduction

Pingyun Report is a Next.js full-stack application that generates daily reports from GitLab commits. The application uses Prisma as its ORM layer with MySQL as the primary database backend. This documentation provides a comprehensive overview of the Prisma schema definition, including generator configuration, datasource setup, model definitions, and the complete data model architecture.

The application follows a multi-user architecture with role-based access control, supporting both individual developers and team administrators. The Prisma schema defines four core models: User, Project, Report, and Template, each serving specific purposes within the application's workflow.

## Project Structure

The Prisma configuration is organized within the `prisma/` directory alongside the main application code. The structure follows Next.js conventions with clear separation between schema definition, client initialization, and data seeding.

```mermaid
graph TB
subgraph "Prisma Configuration"
A[schema.prisma] --> B[Generator Config]
A --> C[Datasource Config]
A --> D[Enum Definitions]
A --> E[Model Definitions]
F[prisma.ts] --> G[Prisma Client Setup]
H[seed.ts] --> I[Initial Data Seeding]
J[package.json] --> K[Script Configuration]
L[docker-compose.yml] --> M[Environment Variables]
N[Dockerfile] --> O[Build Process]
end
subgraph "Application Integration"
P[lib/auth.ts] --> Q[User Authentication]
R[lib/crypto.ts] --> S[Data Encryption]
T[app/api/*] --> U[API Endpoints]
end
A --> F
F --> P
F --> R
```

**Diagram sources**
- [schema.prisma:1-80](file://prisma/schema.prisma#L1-L80)
- [prisma.ts:1-14](file://lib/prisma.ts#L1-L14)
- [seed.ts:1-63](file://prisma/seed.ts#L1-L63)

**Section sources**
- [schema.prisma:1-80](file://prisma/schema.prisma#L1-L80)
- [prisma.ts:1-14](file://lib/prisma.ts#L1-L14)
- [seed.ts:1-63](file://prisma/seed.ts#L1-L63)

## Core Components

### Generator Configuration

The Prisma generator is configured to produce the JavaScript client for database operations. The configuration specifies the `prisma-client-js` provider, which generates type-safe database access methods.

**Section sources**
- [schema.prisma:2-4](file://prisma/schema.prisma#L2-L4)

### Datasource Configuration

The datasource is configured for MySQL with dynamic URL loading from environment variables. This allows flexible deployment configurations across different environments.

**Section sources**
- [schema.prisma:6-9](file://prisma/schema.prisma#L6-L9)

### Enum Definitions

The Role enum defines two user roles: MEMBER and ADMIN. This enum is used throughout the User model to control access permissions and administrative capabilities.

**Section sources**
- [schema.prisma:11-14](file://prisma/schema.prisma#L11-L14)

## Architecture Overview

The Prisma schema implements a comprehensive data model supporting the application's core functionality. The architecture follows relational database principles while maintaining type safety through Prisma's code generation.

```mermaid
erDiagram
USER {
string id PK
string username UK
string passwordHash
string displayName
enum role
string gitlabBaseUrl
string gitlabToken
int gitlabUserId
string gitlabEmail
string noiseRegex
datetime createdAt
datetime updatedAt
}
PROJECT {
string id PK
string userId FK
int gitlabProjectId
string nameWithNamespace
string webUrl
string defaultBranch
boolean enabled
datetime createdAt
}
REPORT {
string id PK
string userId FK
date date
longtext content
json rawCommits
string templateId
datetime createdAt
datetime updatedAt
}
TEMPLATE {
string id PK
string userId FK
string name
text body
boolean isDefault
datetime createdAt
datetime updatedAt
}
USER ||--o{ PROJECT : "owns"
USER ||--o{ REPORT : "creates"
USER ||--o{ TEMPLATE : "creates"
REPORT }o--|| TEMPLATE : "uses"
```

**Diagram sources**
- [schema.prisma:16-79](file://prisma/schema.prisma#L16-L79)

## Detailed Component Analysis

### User Model

The User model serves as the foundation for the application's authentication and authorization system. It stores user credentials, profile information, and GitLab integration details.

Key characteristics:
- Unique identifier using cuid() for robust ID generation
- Username uniqueness constraint for authentication
- Role-based access control with MEMBER and ADMIN values
- GitLab integration fields for secure token storage
- Automatic timestamp tracking for audit trails

**Section sources**
- [schema.prisma:16-33](file://prisma/schema.prisma#L16-L33)

### Project Model

The Project model manages GitLab project associations for each user. It maintains synchronization between local records and remote GitLab repositories.

Key characteristics:
- Composite unique constraint combining user ID and GitLab project ID
- Index optimization for user-based queries
- Cascade deletion relationship with User model
- Support for custom branch selection per project

**Section sources**
- [schema.prisma:35-49](file://prisma/schema.prisma#L35-L49)

### Report Model

The Report model stores generated daily reports with comprehensive commit data and formatting options.

Key characteristics:
- Date-based uniqueness constraint for daily report generation
- JSON field support for raw commit data
- Long text storage for report content
- Relationship with Template model for content formatting
- Automatic timestamp tracking for creation and updates

**Section sources**
- [schema.prisma:51-65](file://prisma/schema.prisma#L51-L65)

### Template Model

The Template model provides customizable report formatting using Handlebars templating.

Key characteristics:
- User-specific template ownership
- Default template capability for new users
- Text field optimization for template content
- Index optimization for user-based template queries

**Section sources**
- [schema.prisma:67-79](file://prisma/schema.prisma#L67-L79)

## Dependency Analysis

The Prisma schema integrates with several application components through well-defined relationships and dependencies.

```mermaid
graph LR
subgraph "Prisma Layer"
A[schema.prisma] --> B[Generated Client]
B --> C[Type Safety]
end
subgraph "Application Layer"
D[lib/prisma.ts] --> B
E[lib/auth.ts] --> F[User Authentication]
G[lib/crypto.ts] --> H[Data Encryption]
I[prisma/seed.ts] --> J[Initial Data]
end
subgraph "Deployment Layer"
K[package.json] --> L[Build Scripts]
M[docker-compose.yml] --> N[Environment Config]
O[Dockerfile] --> P[Runtime Setup]
end
B --> D
F --> D
H --> D
J --> D
L --> B
N --> D
P --> D
```

**Diagram sources**
- [prisma.ts:1-14](file://lib/prisma.ts#L1-L14)
- [auth.ts:1-76](file://lib/auth.ts#L1-L76)
- [crypto.ts:1-45](file://lib/crypto.ts#L1-L45)
- [seed.ts:1-63](file://prisma/seed.ts#L1-L63)

**Section sources**
- [prisma.ts:1-14](file://lib/prisma.ts#L1-L14)
- [auth.ts:1-76](file://lib/auth.ts#L1-L76)
- [crypto.ts:1-45](file://lib/crypto.ts#L1-L45)
- [seed.ts:1-63](file://prisma/seed.ts#L1-L63)

## Performance Considerations

### Index Optimization

The schema includes strategic indexing to optimize common query patterns:
- Composite unique indexes on (userId, gitlabProjectId) for project lookups
- Composite unique indexes on (userId, date) for report retrieval
- Single-column indexes on userId for relationship queries

### Storage Optimization

Field type selections balance storage efficiency with functionality:
- Text fields for large content (templates, report content)
- LongText fields for extensive report data
- JSON fields for structured commit data
- Date fields for temporal queries

### Connection Management

The Prisma client implementation includes production-grade connection handling:
- Singleton pattern preventing multiple client instances
- Environment-aware logging configuration
- Graceful shutdown handling

**Section sources**
- [schema.prisma:47-48](file://prisma/schema.prisma#L47-L48)
- [schema.prisma:63-64](file://prisma/schema.prisma#L63-L64)
- [prisma.ts:7-13](file://lib/prisma.ts#L7-L13)

## Troubleshooting Guide

### Environment Variable Configuration

Critical environment variables required for proper operation:

**DATABASE_URL**: MySQL connection string in format `mysql://user:pass@host:3306/db`
**NEXTAUTH_URL**: External URL for NextAuth authentication
**NEXTAUTH_SECRET**: 32-byte base64-encoded secret for session encryption
**ENCRYPTION_KEY**: 64-character hex string for AES-256-GCM encryption

### Common Issues and Solutions

**Connection Failures**: Verify DATABASE_URL format and network connectivity
**Authentication Errors**: Check NEXTAUTH_SECRET validity and NEXTAUTH_URL accessibility
**Encryption Issues**: Ensure ENCRYPTION_KEY is exactly 64 hex characters
**Migration Problems**: Confirm Prisma client version compatibility

### Development vs Production Differences

Development environment enables verbose logging while production restricts logs to errors only. This helps in debugging during development without exposing sensitive information in production.

**Section sources**
- [README.md:54-63](file://README.md#L54-L63)
- [prisma.ts:9-11](file://lib/prisma.ts#L9-L11)

## Conclusion

The Prisma schema for Pingyun Report demonstrates a well-architected data model that supports the application's core functionality while maintaining type safety and performance. The schema successfully balances relational database principles with modern application requirements, providing:

- Comprehensive user management with role-based access control
- GitLab integration with secure token storage
- Flexible report generation with customizable templates
- Robust data validation through Prisma's type system
- Production-ready deployment configurations

The implementation showcases best practices in database design, including appropriate indexing strategies, efficient field typing, and secure data handling. The schema provides a solid foundation for future feature additions while maintaining backward compatibility and performance standards.