# Team Member Statistics

<cite>
**Referenced Files in This Document**
- [page.tsx](file://app/admin/team-reports/page.tsx)
- [team-reports.tsx](file://components/team-reports.tsx)
- [member-stats-tab.tsx](file://components/team/member-stats-tab.tsx)
- [member-filter.tsx](file://components/team/member-filter.tsx)
- [reports-tab.tsx](file://components/team/reports-tab.tsx)
- [overview-tab.tsx](file://components/team/overview-tab.tsx)
- [stats-content.tsx](file://components/stats-content.tsx)
- [route.ts](file://app/api/stats/commits/route.ts)
- [route.ts](file://app/api/admin/stats/team/route.ts)
- [route.ts](file://app/api/admin/team-reports/range/route.ts)
- [stats.ts](file://lib/stats.ts)
- [report.ts](file://lib/report.ts)
- [gitlab.ts](file://lib/gitlab.ts)
- [schema.prisma](file://prisma/schema.prisma)
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
This document explains the Team Member Statistics feature, which provides administrators with three primary capabilities:
- Individual member commit statistics with filtering and date range selection
- Team-wide daily report submission heatmaps and aggregated statistics
- Daily report review and approval workflows

The system integrates with GitLab via server-side APIs, computes conventional commit categories, and presents structured statistics with project-level breakdowns.

## Project Structure
The Team Member Statistics feature spans frontend React components, Next.js API routes, and backend libraries for data computation and GitLab integration.

```mermaid
graph TB
subgraph "Frontend"
TR["TeamReports<br/>components/team-reports.tsx"]
MST["MemberStatsTab<br/>components/team/member-stats-tab.tsx"]
RT["ReportsTab<br/>components/team/reports-tab.tsx"]
OT["OverviewTab<br/>components/team/overview-tab.tsx"]
SC["StatsContent<br/>components/stats-content.tsx"]
MF["MemberFilterBar<br/>components/team/member-filter.tsx"]
end
subgraph "Next.js API Routes"
AC["/api/stats/commits<br/>app/api/stats/commits/route.ts"]
ATS["/api/admin/stats/team<br/>app/api/admin/stats/team/route.ts"]
AR["/api/admin/team-reports/range<br/>app/api/admin/team-reports/range/route.ts"]
end
subgraph "Backend Libraries"
ST["computeUserStats<br/>lib/stats.ts"]
RP["filterCommits, parseConventional<br/>lib/report.ts"]
GL["listCommits, GitLab client<br/>lib/gitlab.ts"]
end
subgraph "Database"
PRISMA["Prisma Schema<br/>prisma/schema.prisma"]
end
TR --> MST
TR --> RT
TR --> OT
MST --> AC
OT --> ATS
OT --> AR
AC --> ST
ATS --> ST
ST --> RP
ST --> GL
ST --> PRISMA
AC --> PRISMA
AR --> PRISMA
```

**Diagram sources**
- [team-reports.tsx:1-70](file://components/team-reports.tsx#L1-L70)
- [member-stats-tab.tsx:1-241](file://components/team/member-stats-tab.tsx#L1-L241)
- [reports-tab.tsx:1-183](file://components/team/reports-tab.tsx#L1-L183)
- [overview-tab.tsx:1-310](file://components/team/overview-tab.tsx#L1-L310)
- [stats-content.tsx:1-225](file://components/stats-content.tsx#L1-L225)
- [member-filter.tsx:1-60](file://components/team/member-filter.tsx#L1-L60)
- [route.ts:1-54](file://app/api/stats/commits/route.ts#L1-L54)
- [route.ts:1-76](file://app/api/admin/stats/team/route.ts#L1-L76)
- [route.ts:1-70](file://app/api/admin/team-reports/range/route.ts#L1-L70)
- [stats.ts:1-144](file://lib/stats.ts#L1-L144)
- [report.ts:1-159](file://lib/report.ts#L1-L159)
- [gitlab.ts:1-172](file://lib/gitlab.ts#L1-L172)
- [schema.prisma:1-81](file://prisma/schema.prisma#L1-L81)

**Section sources**
- [page.tsx:1-22](file://app/admin/team-reports/page.tsx#L1-L22)
- [team-reports.tsx:1-70](file://components/team-reports.tsx#L1-L70)

## Core Components
- TeamReports container manages tab navigation among "Daily Reports", "Member Statistics", and "Team Overview".
- MemberStatsTab enables administrators to select a team member and view their commit statistics for a chosen date range.
- ReportsTab displays daily report submissions per member for a selected date.
- OverviewTab shows team-wide submission heatmaps and aggregated commit statistics across a date range.
- StatsContent renders detailed type distributions and per-project commit breakdowns.
- MemberFilterBar provides search and role-based filtering for member lists.
- API routes handle authentication, authorization, and data retrieval for statistics and reports.
- Backend libraries compute commit statistics, filter and categorize commits, and interact with GitLab.

**Section sources**
- [team-reports.tsx:1-70](file://components/team-reports.tsx#L1-L70)
- [member-stats-tab.tsx:1-241](file://components/team/member-stats-tab.tsx#L1-L241)
- [reports-tab.tsx:1-183](file://components/team/reports-tab.tsx#L1-L183)
- [overview-tab.tsx:1-310](file://components/team/overview-tab.tsx#L1-L310)
- [stats-content.tsx:1-225](file://components/stats-content.tsx#L1-L225)
- [member-filter.tsx:1-60](file://components/team/member-filter.tsx#L1-L60)

## Architecture Overview
The system follows a layered architecture:
- Presentation layer: Next.js App Router pages and client components
- API layer: Next.js route handlers under app/api
- Domain layer: Business logic in lib/stats.ts and lib/report.ts
- Data access: Prisma ORM queries against MySQL
- External integration: GitLab REST API client in lib/gitlab.ts

```mermaid
sequenceDiagram
participant Admin as "Admin User"
participant UI as "MemberStatsTab"
participant API as "GET /api/stats/commits"
participant Lib as "computeUserStats"
participant Repo as "Prisma User/Project"
participant GL as "GitLab API"
Admin->>UI : Select member and date range
UI->>API : Fetch commit stats (startDate, endDate, userId?)
API->>Lib : computeUserStats(targetUser, since, until)
Lib->>Repo : Load enabled projects for user
Lib->>GL : listCommits(project, since, until, branch)
GL-->>Lib : Commit list
Lib->>Lib : filterCommits + parseConventional + categorize
Lib-->>API : Aggregated stats (total, breakdown, byProject)
API-->>UI : JSON response
UI-->>Admin : Render summary cards and detailed charts
```

**Diagram sources**
- [member-stats-tab.tsx:52-72](file://components/team/member-stats-tab.tsx#L52-L72)
- [route.ts:16-53](file://app/api/stats/commits/route.ts#L16-L53)
- [stats.ts:69-143](file://lib/stats.ts#L69-L143)
- [gitlab.ts:143-171](file://lib/gitlab.ts#L143-L171)
- [schema.prisma:16-33](file://prisma/schema.prisma#L16-L33)

## Detailed Component Analysis

### Member Statistics Tab
The MemberStatsTab component allows administrators to:
- Load all team members for the current date
- Filter members by name or role
- Select a member and query commit statistics for a date range
- View summary cards and detailed breakdowns

```mermaid
flowchart TD
Start(["User selects member"]) --> Validate["Validate date range"]
Validate --> |Invalid| ToastError["Show error toast"]
Validate --> |Valid| FetchStats["Fetch /api/stats/commits"]
FetchStats --> ParseResp{"Response OK?"}
ParseResp --> |No| ShowError["Show error toast"]
ParseResp --> |Yes| Render["Render summary cards + StatsContent"]
Render --> End(["Done"])
```

**Diagram sources**
- [member-stats-tab.tsx:52-72](file://components/team/member-stats-tab.tsx#L52-L72)
- [route.ts:16-53](file://app/api/stats/commits/route.ts#L16-L53)
- [stats-content.tsx:56-224](file://components/stats-content.tsx#L56-L224)

**Section sources**
- [member-stats-tab.tsx:1-241](file://components/team/member-stats-tab.tsx#L1-L241)
- [member-filter.tsx:1-60](file://components/team/member-filter.tsx#L1-L60)
- [stats-content.tsx:1-225](file://components/stats-content.tsx#L1-L225)

### Team Overview Tab
The OverviewTab component provides:
- Team-wide daily report submission heatmap
- Aggregate commit statistics across all members
- Member ranking by total commits and categorized counts

```mermaid
sequenceDiagram
participant Admin as "Admin User"
participant UI as "OverviewTab"
participant API1 as "GET /api/admin/team-reports/range"
participant API2 as "GET /api/admin/stats/team"
Admin->>UI : Set startDate/endDate and click Query
UI->>API1 : Fetch heatmap data
UI->>API2 : Fetch team stats
API1-->>UI : {days, rows}
API2-->>UI : {total, breakdown, byUser}
UI-->>Admin : Render heatmap and aggregate table
```

**Diagram sources**
- [overview-tab.tsx:51-80](file://components/team/overview-tab.tsx#L51-L80)
- [route.ts:10-69](file://app/api/admin/team-reports/range/route.ts#L10-L69)
- [route.ts:13-75](file://app/api/admin/stats/team/route.ts#L13-L75)

**Section sources**
- [overview-tab.tsx:1-310](file://components/team/overview-tab.tsx#L1-L310)
- [route.ts:1-70](file://app/api/admin/team-reports/range/route.ts#L1-L70)
- [route.ts:1-76](file://app/api/admin/stats/team/route.ts#L1-L76)

### Daily Reports Tab
The ReportsTab component enables administrators to:
- Select a date and refresh report submissions
- Filter members by name or role
- Preview daily report content for selected members

```mermaid
flowchart TD
Start(["Select date and click Refresh"]) --> Load["Fetch /api/admin/team-reports?date=YYYY-MM-DD"]
Load --> RespOK{"HTTP 200?"}
RespOK --> |No| ErrorToast["Show error toast"]
RespOK --> |Yes| UpdateList["Update rows list"]
UpdateList --> Filter["Apply MemberFilterBar filters"]
Filter --> Select["Click member row"]
Select --> Preview["Render Markdown preview"]
Preview --> End(["Done"])
```

**Diagram sources**
- [reports-tab.tsx:54-78](file://components/team/reports-tab.tsx#L54-L78)
- [reports-tab.tsx:109-182](file://components/team/reports-tab.tsx#L109-L182)

**Section sources**
- [reports-tab.tsx:1-183](file://components/team/reports-tab.tsx#L1-L183)
- [member-filter.tsx:1-60](file://components/team/member-filter.tsx#L1-L60)

### Statistics Computation Pipeline
The computeUserStats function orchestrates commit aggregation:
- Loads enabled projects for a user
- Lists commits via GitLab API within the date range
- Filters commits by author email and noise regex
- Parses conventional commit messages and categorizes types
- Builds per-project and total breakdowns

```mermaid
flowchart TD
Start(["computeUserStats(user, since, until)"]) --> Projects["Load enabled projects for user"]
Projects --> Loop{"For each project"}
Loop --> ListCommits["listCommits(projectId, since, until, branch)"]
ListCommits --> Filter["filterCommits(dropMerges=true,<br/>authorEmail/noiseRegex)"]
Filter --> Parse["parseConventional(title/message)"]
Parse --> Categorize["categorize(type)"]
Categorize --> Accumulate["Accumulate totals and per-project stats"]
Accumulate --> Loop
Loop --> |Done| Sort["Sort byProject desc by total"]
Sort --> Return(["Return {total, breakdown, byProject}"])
```

**Diagram sources**
- [stats.ts:69-143](file://lib/stats.ts#L69-L143)
- [report.ts:52-75](file://lib/report.ts#L52-L75)
- [gitlab.ts:143-171](file://lib/gitlab.ts#L143-L171)

**Section sources**
- [stats.ts:1-144](file://lib/stats.ts#L1-L144)
- [report.ts:1-159](file://lib/report.ts#L1-L159)
- [gitlab.ts:1-172](file://lib/gitlab.ts#L1-L172)

## Dependency Analysis
The feature exhibits clear separation of concerns:
- Frontend components depend on API routes for data
- API routes depend on domain logic in lib/stats.ts
- Domain logic depends on lib/report.ts for commit parsing and filtering, and lib/gitlab.ts for external integration
- All persistence is handled by Prisma ORM using the schema in prisma/schema.prisma

```mermaid
graph LR
UI["React Components"] --> API["Next.js API Routes"]
API --> LIB["lib/stats.ts"]
LIB --> REPORT["lib/report.ts"]
LIB --> GITLAB["lib/gitlab.ts"]
API --> PRISMA["Prisma Schema"]
LIB --> PRISMA
```

**Diagram sources**
- [team-reports.tsx:1-70](file://components/team-reports.tsx#L1-L70)
- [route.ts:1-54](file://app/api/stats/commits/route.ts#L1-L54)
- [stats.ts:1-144](file://lib/stats.ts#L1-L144)
- [report.ts:1-159](file://lib/report.ts#L1-L159)
- [gitlab.ts:1-172](file://lib/gitlab.ts#L1-L172)
- [schema.prisma:1-81](file://prisma/schema.prisma#L1-L81)

**Section sources**
- [schema.prisma:1-81](file://prisma/schema.prisma#L1-L81)

## Performance Considerations
- Parallelization: The computeUserStats function uses Promise.all to fetch commits across projects concurrently, reducing total latency.
- Pagination limits: GitLab client enforces page caps to prevent excessive network requests.
- Filtering early: Commits are filtered and deduplicated before building detailed structures to minimize downstream processing.
- Caching: Responses are intentionally marked as no-store to avoid stale data in long-lived sessions.
- UI responsiveness: Client components debounce user interactions and show loading states during fetches.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Ensure the requesting user has ADMIN role for admin-only endpoints.
- Missing GitLab credentials: The stats computation returns null when required fields are missing; configure gitlabBaseUrl and gitlabToken.
- Invalid date range: API routes validate date formats and enforce startDate ≤ endDate; adjust accordingly.
- Rate limits and timeouts: GitLab API client sets timeouts; retry after a delay if encountering transient errors.
- No data returned: Verify that projects are enabled for the user and that commits exist within the selected date range.

**Section sources**
- [route.ts:16-53](file://app/api/stats/commits/route.ts#L16-L53)
- [route.ts:13-75](file://app/api/admin/stats/team/route.ts#L13-L75)
- [route.ts:10-69](file://app/api/admin/team-reports/range/route.ts#L10-L69)
- [stats.ts:69-74](file://lib/stats.ts#L69-L74)

## Conclusion
The Team Member Statistics feature provides a comprehensive toolkit for administrators to monitor team activity:
- Individual commit statistics with conventional commit categorization
- Team-wide submission heatmaps and aggregate rankings
- Daily report review and filtering

The modular architecture ensures maintainability, while server-side GitLab integration and robust filtering deliver accurate insights across multiple projects and timeframes.