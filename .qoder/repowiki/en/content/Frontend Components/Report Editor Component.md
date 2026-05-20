# Report Editor Component

<cite>
**Referenced Files in This Document**
- [report-editor.tsx](file://components/report-editor.tsx)
- [page.tsx](file://app/page.tsx)
- [report.ts](file://lib/report.ts)
- [gitlab.ts](file://lib/gitlab.ts)
- [generate.route.ts](file://app/api/reports/generate/route.ts)
- [reports.route.ts](file://app/api/reports/route.ts)
- [templates.route.ts](file://app/api/templates/route.ts)
- [projects.route.ts](file://app/api/gitlab/projects/route.ts)
- [polish.route.ts](file://app/api/ai/polish/route.ts)
- [settings-form.tsx](file://components/settings-form.tsx)
- [utils.ts](file://lib/utils.ts)
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
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive documentation for the ReportEditor component, the core UI component responsible for report generation and editing. It covers state management for date selection, template selection, project filtering, and content editing, along with integration patterns for the markdown editor, API integrations for report generation, saving, copying, and AI polishing, project selection with enable/disable functionality and branch information display, error handling, loading states, user feedback mechanisms, lifecycle hooks, dependency management, performance optimizations, and customization patterns.

## Project Structure
The ReportEditor component is located under components and integrates with several backend APIs and shared libraries. The frontend component manages UI state and user interactions, while the backend APIs handle data fetching, report generation, persistence, and AI enhancement.

```mermaid
graph TB
FE_ReportEditor["components/report-editor.tsx"]
BE_Generate["app/api/reports/generate/route.ts"]
BE_Reports["app/api/reports/route.ts"]
BE_Templates["app/api/templates/route.ts"]
BE_Projects["app/api/gitlab/projects/route.ts"]
BE_AI_Polish["app/api/ai/polish/route.ts"]
Lib_Report["lib/report.ts"]
Lib_GitLab["lib/gitlab.ts"]
Prisma_Schema["prisma/schema.prisma"]
FE_ReportEditor --> BE_Generate
FE_ReportEditor --> BE_Reports
FE_ReportEditor --> BE_Templates
FE_ReportEditor --> BE_Projects
FE_ReportEditor --> BE_AI_Polish
BE_Generate --> Lib_Report
BE_Generate --> Lib_GitLab
BE_Generate --> Prisma_Schema
BE_Reports --> Prisma_Schema
BE_Templates --> Prisma_Schema
BE_Projects --> Prisma_Schema
BE_AI_Polish --> Prisma_Schema
```

**Diagram sources**
- [report-editor.tsx:1-284](file://components/report-editor.tsx#L1-L284)
- [generate.route.ts:1-133](file://app/api/reports/generate/route.ts#L1-L133)
- [reports.route.ts:1-90](file://app/api/reports/route.ts#L1-L90)
- [templates.route.ts:1-96](file://app/api/templates/route.ts#L1-L96)
- [projects.route.ts:1-42](file://app/api/gitlab/projects/route.ts#L1-L42)
- [polish.route.ts:1-63](file://app/api/ai/polish/route.ts#L1-L63)
- [report.ts:1-159](file://lib/report.ts#L1-L159)
- [gitlab.ts:1-149](file://lib/gitlab.ts#L1-L149)
- [schema.prisma:1-80](file://prisma/schema.prisma#L1-L80)

**Section sources**
- [report-editor.tsx:1-284](file://components/report-editor.tsx#L1-L284)
- [page.tsx:1-20](file://app/page.tsx#L1-L20)
- [schema.prisma:1-80](file://prisma/schema.prisma#L1-L80)

## Core Components
- ReportEditor: The primary UI component managing date selection, template selection, project filtering, content editing, and actions (generate, save, copy, AI polish).
- Shared utilities: Markdown editor integration, state management, and UI helpers.
- Backend APIs: Report generation, saving, templates, project management, and AI polishing.

Key responsibilities:
- Manage local state for date, content, templates, projects, selections, loading, saving, polishing, errors, and saved status.
- Fetch configuration (templates and projects) and existing reports on mount and date change.
- Generate report content via API with optional template and project filters.
- Persist edited content to the database.
- Provide AI-powered content polishing.
- Display project errors encountered during generation.

**Section sources**
- [report-editor.tsx:19-284](file://components/report-editor.tsx#L19-L284)

## Architecture Overview
The ReportEditor component orchestrates user interactions and API calls. It dynamically loads the markdown editor to provide live preview editing capabilities. The backend APIs handle GitLab integration, template rendering, report persistence, and AI enhancement.

```mermaid
sequenceDiagram
participant User as "User"
participant Editor as "ReportEditor"
participant API_Gen as "GET /api/reports/generate"
participant API_Rep as "GET/POST /api/reports"
participant API_Tpl as "GET /api/templates"
participant API_Proj as "GET /api/gitlab/projects"
participant API_AI as "POST /api/ai/polish"
participant MD as "@uiw/react-md-editor"
User->>Editor : Select date/template/project(s)
Editor->>API_Tpl : Load templates
Editor->>API_Proj : Load projects
Editor->>API_Rep : Load existing report (if any)
Editor->>API_Gen : Generate report (with date, templateId, projectIds)
API_Gen-->>Editor : {content, errors, templateId}
Editor->>MD : Render live preview
User->>Editor : Edit content
User->>Editor : Click Save
Editor->>API_Rep : POST report content
API_Rep-->>Editor : {report}
User->>Editor : Click AI Polish
Editor->>API_AI : POST content for polishing
API_AI-->>Editor : {content}
Editor->>MD : Update content
```

**Diagram sources**
- [report-editor.tsx:39-164](file://components/report-editor.tsx#L39-L164)
- [generate.route.ts:23-132](file://app/api/reports/generate/route.ts#L23-L132)
- [reports.route.ts:9-76](file://app/api/reports/route.ts#L9-L76)
- [templates.route.ts:7-24](file://app/api/templates/route.ts#L7-L24)
- [projects.route.ts:6-12](file://app/api/gitlab/projects/route.ts#L6-L12)
- [polish.route.ts:10-62](file://app/api/ai/polish/route.ts#L10-L62)

## Detailed Component Analysis

### State Management
The component maintains the following state:
- Date selection: controlled via an HTML date input.
- Content editing: managed by the markdown editor.
- Templates: fetched and selectable from the backend.
- Projects: fetched with enable/disable flags and default branch information.
- Selected projects: a subset of enabled projects used for generation.
- Loading/saving/polishing flags: control UI state and button availability.
- Errors: aggregated from failed project fetches during generation.
- Saved status: indicates whether the current content is persisted.

State initialization and updates:
- Date defaults to today’s date.
- Templates and projects are loaded concurrently on mount.
- Existing report content is loaded for the selected date; otherwise, auto-generation occurs.
- Selected projects default to all enabled projects.

```mermaid
flowchart TD
Start(["Mount"]) --> LoadConfig["Load templates and projects"]
LoadConfig --> LoadExisting["Load existing report for selected date"]
LoadExisting --> HasExisting{"Existing report?"}
HasExisting --> |Yes| SetContent["Set content and saved flag"]
HasExisting --> |No| Generate["Auto-generate report"]
Generate --> SetContent
SetContent --> Ready(["Ready"])
```

**Diagram sources**
- [report-editor.tsx:39-107](file://components/report-editor.tsx#L39-L107)

**Section sources**
- [report-editor.tsx:19-107](file://components/report-editor.tsx#L19-L107)

### Markdown Editor Integration
The component uses a dynamic import of the markdown editor to disable server-side rendering. The editor is configured for live preview mode and fixed height, enabling real-time editing and review.

Key integration points:
- Dynamic import with SSR disabled ensures client-only rendering.
- Live preview mode provides immediate feedback as users type.
- Height is fixed for consistent UX across devices.

**Section sources**
- [report-editor.tsx:9-280](file://components/report-editor.tsx#L9-L280)

### API Integration Patterns
The component interacts with multiple backend endpoints:

- Report generation:
  - Endpoint: GET /api/reports/generate
  - Parameters: date, templateId (optional), projectIds (optional)
  - Behavior: Fetches commits for selected projects, builds context, renders template, and returns content with potential errors.
  - Error handling: Displays project-specific errors in the UI.

- Report persistence:
  - Endpoint: GET /api/reports (query by date/month)
  - Endpoint: POST /api/reports (create/update)
  - Endpoint: DELETE /api/reports (delete by date)
  - Behavior: Upserts report content and template association.

- Templates:
  - Endpoint: GET /api/templates
  - Behavior: Returns user templates, creates default template if none exist.

- Projects:
  - Endpoint: GET /api/gitlab/projects
  - Endpoint: PATCH /api/gitlab/projects (enable/disable, set default branch)
  - Behavior: Manages project enablement and branch preferences.

- AI Polishing:
  - Endpoint: POST /api/ai/polish
  - Behavior: Sends content to external LLM API for refinement.

**Section sources**
- [report-editor.tsx:67-164](file://components/report-editor.tsx#L67-L164)
- [generate.route.ts:23-132](file://app/api/reports/generate/route.ts#L23-L132)
- [reports.route.ts:9-76](file://app/api/reports/route.ts#L9-L76)
- [templates.route.ts:7-24](file://app/api/templates/route.ts#L7-L24)
- [projects.route.ts:6-41](file://app/api/gitlab/projects/route.ts#L6-L41)
- [polish.route.ts:10-62](file://app/api/ai/polish/route.ts#L10-L62)

### Project Selection Mechanism
The component displays enabled projects and allows toggling inclusion in the report generation. Branch information is shown alongside project names and can be configured in the settings.

- Enabled projects are filtered from the full project list.
- Users can click project buttons to include/exclude them.
- Selected projects are passed to the generation endpoint as a comma-separated list when not equal to all enabled projects.

Integration with settings:
- SettingsForm updates project enablement and default branches via PATCH requests.
- The editor reflects these changes immediately upon reload.

**Section sources**
- [report-editor.tsx:166-258](file://components/report-editor.tsx#L166-L258)
- [settings-form.tsx:109-134](file://components/settings-form.tsx#L109-L134)
- [projects.route.ts:21-41](file://app/api/gitlab/projects/route.ts#L21-L41)

### Error Handling and User Feedback
The component implements robust error handling and user feedback:
- Toast notifications for success/error states across actions (generate, save, copy, polish).
- Dedicated error banner for project fetch failures during generation.
- Loading indicators for long-running operations (generate/save/polish).
- Disabled states for buttons when actions are not applicable.

**Section sources**
- [report-editor.tsx:260-271](file://components/report-editor.tsx#L260-L271)
- [report-editor.tsx:67-164](file://components/report-editor.tsx#L67-L164)

### Lifecycle Hooks and Dependencies
- useEffect for initial configuration loading and date-based report loading.
- useCallback for memoized handlers to prevent unnecessary re-renders.
- useMemo for derived enabled projects to optimize rendering.

Performance considerations:
- Concurrent loading of templates and projects.
- Conditional generation only when needed (today’s date vs. existing report).
- Debounced or deferred generation to avoid blocking the UI thread.

**Section sources**
- [report-editor.tsx:93-107](file://components/report-editor.tsx#L93-L107)
- [report-editor.tsx:39-53](file://components/report-editor.tsx#L39-L53)

### Data Flow and Processing Logic
The backend pipeline for report generation:
- Validates query parameters and user session.
- Determines date range based on the selected date.
- Loads user GitLab credentials and filters enabled projects.
- Fetches commits per project within the date range and branch.
- Builds a structured context for templating.
- Renders the template using Handlebars.
- Aggregates project errors and returns content with metadata.

```mermaid
flowchart TD
Q["Parse query params<br/>date, templateId, projectIds"]
U["Require user session"]
D["Compute date range (since/until)"]
P["Load enabled projects for user"]
C["Fetch commits per project"]
CTX["Build report context"]
R["Render template"]
E["Collect project errors"]
RESP["Return {content, errors, templateId, context}"]
Q --> U --> D --> P --> C --> CTX --> R --> E --> RESP
```

**Diagram sources**
- [generate.route.ts:14-132](file://app/api/reports/generate/route.ts#L14-L132)
- [report.ts:115-144](file://lib/report.ts#L115-L144)
- [gitlab.ts:120-148](file://lib/gitlab.ts#L120-L148)

**Section sources**
- [generate.route.ts:23-132](file://app/api/reports/generate/route.ts#L23-L132)
- [report.ts:115-144](file://lib/report.ts#L115-L144)
- [gitlab.ts:120-148](file://lib/gitlab.ts#L120-L148)

### Class Model for Data Types
The component and backend share several data models that define the shape of state and API payloads.

```mermaid
classDiagram
class Template {
+string id
+string name
+boolean isDefault
}
class Project {
+string id
+string nameWithNamespace
+boolean enabled
+string defaultBranch
}
class ReportContext {
+string date
+ProjectGroup[] projects
+number total
+User user
}
class ProjectGroup {
+string name
+string webUrl
+CleanCommit[] commits
}
class CleanCommit {
+string id
+string short_id
+string title
+string message
+string author_email
+string authored_date
+string web_url
+string type
+string scope
}
class GitLabCommit {
+string id
+string short_id
+string title
+string message
+string author_name
+string author_email
+string authored_date
+string committed_date
+string[] parent_ids
+string web_url
}
class GitLabProject {
+number id
+string name
+string path_with_namespace
+string name_with_namespace
+string default_branch
+string web_url
}
class ReportEditorState {
+string date
+string content
+Template[] templates
+string templateId
+Project[] projects
+string[] selectedProjects
+boolean loading
+boolean saving
+boolean polishing
+{string project; string error}[] errors
+boolean hasSaved
}
```

**Diagram sources**
- [report-editor.tsx:11-17](file://components/report-editor.tsx#L11-L17)
- [report.ts:4-27](file://lib/report.ts#L4-L27)
- [gitlab.ts:14-34](file://lib/gitlab.ts#L14-L34)

**Section sources**
- [report-editor.tsx:11-17](file://components/report-editor.tsx#L11-L17)
- [report.ts:4-27](file://lib/report.ts#L4-L27)
- [gitlab.ts:14-34](file://lib/gitlab.ts#L14-L34)

### UI Composition and Layout
The component organizes controls and content in a responsive layout:
- Top toolbar: date selector, template dropdown, action buttons (generate, AI polish, copy, save).
- Project selection panel: enabled projects with branch indicators and toggle buttons.
- Error banner: aggregated project errors during generation.
- Markdown editor: live preview with fixed height.

Styling utilities:
- Tailwind classes for spacing, borders, and color states.
- cn helper for conditional class merging.

**Section sources**
- [report-editor.tsx:172-280](file://components/report-editor.tsx#L172-L280)
- [utils.ts:4-6](file://lib/utils.ts#L4-L6)

### Integration with Settings and Project Management
Project enablement and branch settings are managed in the settings page and reflected in the editor:
- SettingsForm toggles project enablement and sets default branches.
- Changes propagate to the database and are immediately visible in the editor.
- The editor’s project panel shows enabled projects and branch information.

**Section sources**
- [settings-form.tsx:109-134](file://components/settings-form.tsx#L109-L134)
- [projects.route.ts:21-41](file://app/api/gitlab/projects/route.ts#L21-L41)
- [report-editor.tsx:231-258](file://components/report-editor.tsx#L231-L258)

## Dependency Analysis
The component depends on:
- React hooks for state and effects.
- Dynamic import for the markdown editor to avoid SSR.
- External libraries for date handling, UI notifications, and class merging.
- Backend APIs for configuration, generation, persistence, templates, projects, and AI polishing.

External dependencies:
- @uiw/react-md-editor for markdown editing with live preview.
- dayjs for date manipulation.
- react-hot-toast for user feedback.
- clsx and tailwind-merge for class composition.

```mermaid
graph LR
RE["ReportEditor"]
MD["@uiw/react-md-editor"]
DJ["dayjs"]
RT["react-hot-toast"]
CN["lib/utils.cn"]
RE --> MD
RE --> DJ
RE --> RT
RE --> CN
```

**Diagram sources**
- [report-editor.tsx:3-9](file://components/report-editor.tsx#L3-L9)
- [utils.ts:4-6](file://lib/utils.ts#L4-L6)

**Section sources**
- [report-editor.tsx:3-9](file://components/report-editor.tsx#L3-L9)
- [utils.ts:4-6](file://lib/utils.ts#L4-L6)

## Performance Considerations
- Concurrent loading: Templates and projects are fetched in parallel to reduce initial load time.
- Memoization: Derived values (enabled projects) are computed with useMemo to avoid unnecessary recalculations.
- Conditional generation: Auto-generation is deferred until configuration is loaded and only performed when no existing report exists for the selected date.
- Debounced operations: Generation is triggered after configuration load to prevent race conditions.
- UI responsiveness: Loading states and disabled buttons prevent concurrent operations and improve perceived performance.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- No GitLab token configured: The generation endpoint requires user GitLab credentials; configure them in settings.
- Template rendering errors: The renderer wraps errors in the generated content; check template syntax.
- AI polish failures: Ensure LLM API base and key are configured; verify network connectivity.
- Project fetch errors: Review the error banner for specific project failures; check project enablement and branch settings.
- Save failures: Verify content length and date format; ensure the backend responds successfully.

**Section sources**
- [generate.route.ts:36-43](file://app/api/reports/generate/route.ts#L36-L43)
- [report.ts:137-144](file://lib/report.ts#L137-L144)
- [polish.route.ts:14-22](file://app/api/ai/polish/route.ts#L14-L22)
- [report-editor.tsx:260-271](file://components/report-editor.tsx#L260-L271)

## Conclusion
The ReportEditor component provides a cohesive, efficient solution for daily report generation and editing. Its state-driven architecture, robust API integrations, and thoughtful UI feedback deliver a smooth user experience. The modular design enables easy customization and extension, while the backend pipeline ensures reliable data processing and templating.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API Definitions

- GET /api/reports/generate
  - Query parameters: date (YYYY-MM-DD), templateId (optional), projectIds (comma-separated, optional)
  - Response: { date, content, templateId, context, errors }
  - Errors: 400 if GitLab credentials missing, 404 if user not found

- GET /api/reports
  - Query parameters: date (YYYY-MM-DD) or month (YYYY-MM)
  - Response: { report } or { reports }

- POST /api/reports
  - Body: { date, content, templateId (optional) }
  - Response: { report }

- DELETE /api/reports
  - Query parameters: date (YYYY-MM-DD)
  - Response: { ok }

- GET /api/templates
  - Response: { templates }

- POST /api/templates
  - Body: { name, body, isDefault (optional) }
  - Response: { template }

- PATCH /api/templates
  - Body: { id, name (optional), body (optional), isDefault (optional) }
  - Response: { template }

- DELETE /api/templates
  - Query parameters: id
  - Response: { ok }

- GET /api/gitlab/projects
  - Response: { projects }

- PATCH /api/gitlab/projects
  - Body: { id, enabled (optional), defaultBranch (optional) }
  - Response: { project }

- POST /api/ai/polish
  - Body: { content, language (optional) }
  - Response: { content }
  - Errors: 400 if LLM API not configured, 502 if LLM returns empty or fails

**Section sources**
- [generate.route.ts:14-132](file://app/api/reports/generate/route.ts#L14-L132)
- [reports.route.ts:9-89](file://app/api/reports/route.ts#L9-L89)
- [templates.route.ts:7-95](file://app/api/templates/route.ts#L7-L95)
- [projects.route.ts:6-41](file://app/api/gitlab/projects/route.ts#L6-L41)
- [polish.route.ts:5-62](file://app/api/ai/polish/route.ts#L5-L62)

### Data Models

- ReportContext
  - date: string
  - projects: ProjectGroup[]
  - total: number
  - user: { displayName: string; email?: string }

- ProjectGroup
  - name: string
  - webUrl?: string
  - commits: CleanCommit[]

- CleanCommit
  - id: string
  - short_id: string
  - title: string
  - message: string
  - author_email: string
  - authored_date: string
  - web_url: string
  - type?: string
  - scope?: string

- GitLabCommit
  - id: string
  - short_id: string
  - title: string
  - message: string
  - author_name: string
  - author_email: string
  - authored_date: string
  - committed_date: string
  - parent_ids: string[]
  - web_url: string

- GitLabProject
  - id: number
  - name: string
  - path_with_namespace: string
  - name_with_namespace: string
  - default_branch: string | null
  - web_url: string

**Section sources**
- [report.ts:22-104](file://lib/report.ts#L22-L104)
- [gitlab.ts:23-21](file://lib/gitlab.ts#L23-L21)

### Customization and Extension Patterns
- Template customization: Add/edit/delete templates via the templates API; default templates are created automatically if none exist.
- Project filtering: Enable/disable projects and set default branches; only enabled projects contribute to report generation.
- AI enhancement: Configure LLM environment variables to enable AI polishing; customize system prompts for desired output style.
- Styling: Extend Tailwind classes and the cn helper to adapt the UI to brand guidelines.
- State expansion: Add new state fields for additional filters or metadata; ensure proper validation and error handling.

**Section sources**
- [templates.route.ts:27-95](file://app/api/templates/route.ts#L27-L95)
- [projects.route.ts:15-41](file://app/api/gitlab/projects/route.ts#L15-L41)
- [polish.route.ts:14-30](file://app/api/ai/polish/route.ts#L14-L30)
- [utils.ts:4-6](file://lib/utils.ts#L4-L6)