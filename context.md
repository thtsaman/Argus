# Project Context

## Project Overview

An evidence-first investigation intelligence platform built as an internal hackathon MVP. The application helps investigators explore fragmented information, discover entity relationships, analyze geographic and temporal patterns, identify bridge entities, and use GenAI for evidence-grounded explanations. All data is synthetic — no real individuals or criminal activity are implied.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: PostgreSQL via Docker Compose, accessed through Prisma ORM
- **AI**: Hugging Face Inference API with provider abstraction and fallback extraction
- **Graph**: react-force-graph-2d with custom canvas rendering for relationship states
- **Maps**: Leaflet with OpenStreetMap tiles
- **Animation**: Framer Motion for Bridge View progressive revelation
- **Auth**: Cookie-based demo sessions with centralized RBAC permission checks
- **Audit**: SHA-256 tamper-evident audit chain (not blockchain)
- **Styling**: Warm beige/paper aesthetic with Lora serif + Source Sans 3, no gradients

Centralized branding in `src/lib/config.ts` — product name is configurable.

## Feature Status

### Project setup

Status: Complete

Next.js application scaffolded with TypeScript, Tailwind CSS v4, App Router, and centralized configuration.
Main implementation: `package.json`, `src/lib/config.ts`, `src/app/layout.tsx`

### Database and Docker

Status: Complete

PostgreSQL 16 runs via Docker Compose on port 5432. Connection via `DATABASE_URL` environment variable.
Main implementation: `docker-compose.yml`, `.env.example`

### Prisma schema

Status: Complete

Full schema covering users, investigations, entities, relationships, evidence, events, locations, candidates, AI insights, and audit logs.
Main implementation: `prisma/schema.prisma`

### Prisma migrations

Status: Complete

Database schema applied via `prisma db push`. Migration workflow configured.
Main implementation: `prisma/schema.prisma`, `package.json` scripts

### Seed data generator

Status: Complete

Configurable seed system with presets (demo, small, medium, large). Generates clusters, bridge entities, noise, mixed relationship states, timeline and geographic variation across West Bengal locations.
Main implementation: `prisma/seed/index.ts`, `prisma/seed.ts`

### Investigation overview

Status: Complete

Investigation entry point showing scope, evidence summary, network stats, review items, and analysis entry points.
Main implementation: `src/app/investigations/[id]/page.tsx`

### Evidence intake

Status: Complete

File upload (PDF, DOCX, TXT, CSV, JSON) and paste text with content extraction, structured parsing, and GenAI-assisted extraction.
Main implementation: `src/app/investigations/[id]/intake/page.tsx`, `src/lib/evidence/parser.ts`, `src/app/api/investigations/[id]/evidence/route.ts`

### Evidence Space

Status: Complete

Interactive force-directed graph with progressive focus, entity selection, relationship provenance, and connection path finding.
Main implementation: `src/app/investigations/[id]/evidence-space/page.tsx`, `src/components/graph/EvidenceGraph.tsx`

### Relationship analysis

Status: Complete

Entity detail panels show related relationships with status badges, confidence, and supporting evidence references.
Main implementation: `src/app/api/investigations/[id]/entities/[entityId]/route.ts`

### Connection Path

Status: Complete

Select two entities to find and highlight shortest paths through the relationship graph with visual fading of irrelevant content.
Main implementation: `src/lib/graph/analysis.ts`, Evidence Space page integration

### Bridge analysis

Status: Complete

Betweenness centrality computation identifies structurally important bridge entities connecting separate clusters.
Main implementation: `src/lib/graph/analysis.ts`, `src/app/api/investigations/[id]/bridges/route.ts`

### Bridge View

Status: Complete

Progressive revelation flow: select bridge → graph focus → path → timeline → geographic context with staged animations.
Main implementation: `src/app/investigations/[id]/bridge/page.tsx`

### Geographic visualization

Status: Complete

Leaflet map showing investigation locations with event counts, connected by sequential paths.
Main implementation: `src/app/investigations/[id]/map/page.tsx`, `src/components/map/InvestigationMap.tsx`

### Timeline

Status: Complete

Chronological event visualization with filtering, entity associations, and location context from database events.
Main implementation: `src/app/investigations/[id]/timeline/page.tsx`

### Investigation Replay

Status: Complete

Play/pause/scrub through investigation evolution driven by event timestamps and relationship discovery dates.
Main implementation: `src/app/investigations/[id]/replay/page.tsx`, `src/app/api/investigations/[id]/replay/route.ts`

### GenAI integration

Status: Complete

Hugging Face provider abstraction with environment configuration, fallback responses when API key not set.
Main implementation: `src/lib/ai/provider.ts`

### Structured AI extraction

Status: Complete

GenAI extraction with Zod schema validation, rule-based fallback, and prompt injection detection.
Main implementation: `src/lib/ai/provider.ts`, `src/lib/validation/schemas.ts`

### Evidence provenance

Status: Complete

Relationships link to supporting evidence with excerpts. Entity panels show evidence references.
Main implementation: `prisma/schema.prisma` (RelationshipEvidence), entity detail API

### Verification workflow

Status: Complete

Candidate findings from evidence intake can be verified or rejected, persisting entities/relationships/events to the investigation.
Main implementation: `src/app/investigations/[id]/review/page.tsx`, candidates API

### RBAC

Status: Complete

Four roles (INVESTIGATOR, ANALYST, SUPERVISOR, ADMIN) with centralized permission checks on protected API operations.
Main implementation: `src/lib/auth/permissions.ts`, `src/app/security/page.tsx`

### Audit logging

Status: Complete

Server-side audit logging for sensitive actions with reusable `createAuditLog` function.
Main implementation: `src/lib/audit/chain.ts`

### Tamper-evident audit chain

Status: Complete

SHA-256 linked audit records with verification endpoint reporting chain integrity.
Main implementation: `src/lib/audit/chain.ts`, `src/app/api/security/audit/verify/route.ts`

### Prompt injection handling

Status: Complete

Explicit separation of system instructions and untrusted evidence content. Suspicious pattern detection and flagging.
Main implementation: `src/lib/ai/provider.ts`

### Input validation

Status: Complete

Zod schemas for API request validation across AI queries, verification actions, connection paths, and evidence upload.
Main implementation: `src/lib/validation/schemas.ts`

### Reusable UI component system

Status: Complete

AppShell, PageHeader, SectionHeader, RelationshipStatus badges, common states (Empty, Loading, Error), EvidenceGraph.
Main implementation: `src/components/`

### Final integration and demo readiness

Status: Needs Review

Production build passes. PostgreSQL via Docker is required at runtime — Docker was not available in the build environment. Run `npm run setup` after starting Docker Desktop.
Main implementation: full application

## Setup

```bash
npm install
npm run setup          # Docker + DB push + seed
npm run dev
```

Demo users (password: password123):
- investigator@demo.local (INVESTIGATOR)
- analyst@demo.local (ANALYST)
- supervisor@demo.local (SUPERVISOR)
- admin@demo.local (ADMIN)

Seed presets: `npm run db:seed -- --preset=demo` or `--size=small|medium|large`
