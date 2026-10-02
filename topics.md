# Master Topic List

Extracted from the 33 JDs in `JD/`, plus topics added for current market demand (marked **★ Market**).
Prioritized for AI-native full-stack / forward-deployed engineer roles: `-ui` urgent and important, `-u` urgent, `-i` important. Subtopics are in `subtopics.md`, tagged with their topic's `#tag`.

**What the JDs look like:** mostly Lead / Principal / Staff / Forward-Deployed AI Engineer roles (agents, RAG, LLMOps), plus Java/full-stack lead roles, a frontend role, and engineering-manager / practice-lead roles. Nearly every role expects full-stack production engineering *and* AI engineering *and* leadership.

---

## Priority list

Python for production systems -ui
TypeScript, JavaScript & Node.js -i
Java & Spring Boot
A systems language: Go or Rust
Concurrency & parallelism
OOP, SOLID & design patterns -u
Low-level design (LLD)
Data structures -u
Algorithms & problem-solving patterns -ui
System design fundamentals -ui
Distributed systems
Microservices architecture
Event-driven architecture & messaging
API design & integration -i
Architecture styles & domain-driven design
Performance engineering & caching
Durable workflows & background processing
Classic system design case studies -u
GenAI & agentic system design case studies -ui
Scaling architecture patterns (advanced)
Relational databases & SQL -i
NoSQL databases
Data engineering & pipeline orchestration
Big data & lakehouse
Search & information retrieval
Advanced database internals & performance
Database scaling & high availability
React & Next.js -i
Angular
Vue.js & Nuxt
React Native
Modern full-stack TypeScript stack
Frontend engineering at scale
Real-time & streaming web
UX & interfaces for AI products
Full-stack AI application development -ui
AI SDKs for TypeScript & Java
LLM foundations -i
Foundation model APIs & model selection
Prompt & context engineering -i
Structured outputs & tool calling -i
RAG foundations -ui
Advanced retrieval -i
Vector databases & embedding strategies
Knowledge graphs & GraphRAG
Document AI & unstructured data ingestion
AI agent architecture & patterns -ui
Multi-agent systems & orchestration -i
Agent frameworks & SDKs -i
Model Context Protocol (MCP) -i
Agent memory & state management
Human-in-the-loop design
LLM & agent evaluation -ui
LLM observability & tracing -i
Guardrails & reliability for non-deterministic systems -i
LLM cost & latency optimization -i
Fine-tuning & model adaptation
LLM serving & inference infrastructure
LLMOps & AI platform engineering
Multimodal & voice AI
AI security -i
Responsible AI, governance & compliance
ML fundamentals
Deep learning & PyTorch
Statistics & experimentation
Applied ML problem types
MLOps
AI coding agents in daily engineering -i
Agentic SDLC & AI adoption at team / org level
AWS -i
AWS deep dive: IAM & security
AWS deep dive: serverless
AWS deep dive: containers (ECS & EKS)
AWS deep dive: data services
AWS deep dive: generative AI (Bedrock & AgentCore)
Azure & GCP for AI workloads
Docker & Kubernetes
Infrastructure as Code
CI/CD & GitOps
Observability
Reliability engineering & incident management
Cloud architecture & cost management
Application & API security
Identity & access management
Data protection & privacy
Testing strategy & test automation
Engineering standards & code review
Debugging & production troubleshooting
Technical leadership & strategy
Mentoring & raising team capability
People management
Stakeholder management & influence
Technical communication & writing
Execution & delivery management
Engineering excellence & org change
Behavioral interviews & leadership stories -ui
Product thinking & discovery
Requirements & product artifacts
Prioritization & roadmapping
Prototype to production -i
Forward-deployed & customer-facing engineering -i
Product metrics & ROI of AI
Building internal platforms & tools
Public technical presence -u

---

## 1. Programming & Engineering Craft

| # | Topic | Covers |
|---|-------|--------|
| 1 | Python for production systems | Advanced language features, async, typing, packaging, FastAPI / Django / Flask, pytest |
| 2 | TypeScript, JavaScript & Node.js | Language depth, Node runtime, NestJS / Express |
| 3 | Java & Spring Boot | Core Java, Spring Boot, Hibernate, JUnit, J2EE patterns |
| 4 | A systems language: Go or Rust | Working depth in one, and knowing when to reach for it |
| 5 | Concurrency & parallelism | Threads, event loops, async I/O, multiprocessing, synchronization |
| 6 | OOP, SOLID & design patterns | GoF patterns, composition, SOLID applied in real code |
| 7 | Low-level design (LLD) | Class/module design, machine-coding rounds, extensibility |

## 2. DSA & Problem Solving

| # | Topic | Covers |
|---|-------|--------|
| 8 | Data structures | Arrays to graphs, heaps, tries, hash maps, complexity analysis |
| 9 | Algorithms & problem-solving patterns | Two pointers, sliding window, DP, graphs, greedy, binary search, interview patterns |

## 3. System Design & Architecture

| # | Topic | Covers |
|---|-------|--------|
| 10 | System design fundamentals | Scalability, load balancing, caching, CDNs, partitioning, estimation |
| 11 | Distributed systems | Consistency models, replication, consensus, idempotency, distributed transactions |
| 12 | Microservices architecture | Service boundaries, inter-service communication, resilience patterns |
| 13 | Event-driven architecture & messaging | Kafka, queues, pub/sub, streaming, outbox, CQRS |
| 14 | API design & integration | REST, GraphQL, gRPC, OpenAPI, versioning, webhooks, API gateways, BFF, third-party integrations (Salesforce, Slack, Jira) |
| 15 | Architecture styles & domain-driven design | Hexagonal / clean architecture, modular monolith, DDD |
| 16 | Performance engineering & caching | Redis, profiling, latency budgets, load testing, tuning against SLOs |
| 17 | Durable workflows & background processing | Job queues, schedulers, long-running workflows, Temporal / Step Functions, sagas |
| 18 | Classic system design case studies ★ Market | Interview-style designs: chat, feed, notifications, payments, rate limiter, etc. |
| 19 | GenAI & agentic system design case studies ★ Market | Interview-style designs: enterprise RAG, copilot, multi-agent platform, AI gateway |
| | Scaling architecture patterns (advanced) | Scaling 0 → millions of users, multi-region active-active, cell-based architecture, hot keys, thundering herd, autoscaling |

## 4. Data & Databases

| # | Topic | Covers |
|---|-------|--------|
| 20 | Relational databases & SQL | PostgreSQL, indexing, query optimization, transactions, isolation levels |
| 21 | NoSQL databases | MongoDB, DynamoDB, Redis, document/key-value data modeling |
| 22 | Data engineering & pipeline orchestration | ETL/ELT, Airflow / Prefect, data quality, lineage |
| 23 | Big data & lakehouse | Spark / PySpark, Databricks, Dask, Parquet / Delta, Snowflake |
| 24 | Search & information retrieval | Elasticsearch, inverted indexes, BM25, relevance tuning |
| | Advanced database internals & performance | Storage engines (B-tree vs LSM), WAL, query planner, vacuum, buffer cache, advanced tuning |
| | Database scaling & high availability | Connection pooling, read replicas, sharding at scale, distributed SQL, multi-region, failover, backups / PITR |

## 5. Frontend, Full-Stack & AI Full-Stack

| # | Topic | Covers |
|---|-------|--------|
| 25 | React & Next.js | React 18/19, hooks, state management, routing, SSR / RSC, server actions |
| 26 | Angular | Standalone components, signals, RxJS, change detection, NgRx, routing, forms |
| 27 | Vue.js & Nuxt | Composition API, reactivity, Pinia, Nuxt rendering modes |
| 28 | React Native | Mobile apps with React Native & Expo, navigation, performance, releases |
| 29 | Modern full-stack TypeScript stack | tRPC, Zod, Prisma / Drizzle, Auth.js, Turborepo, Vercel / edge deployment |
| 30 | Frontend engineering at scale | Performance, bundling, testing, accessibility, component systems |
| 31 | Real-time & streaming web | WebSockets, SSE, streaming responses, full-duplex apps |
| 32 | UX & interfaces for AI products | Chat / copilot UIs, making agent work legible, review & approval queues, approval fatigue |
| 33 | Full-stack AI application development ★ Market | End-to-end AI apps: streaming chat, RAG web apps, chat persistence, per-user isolation, quotas, AI in existing CRUD apps |
| 34 | AI SDKs for TypeScript & Java ★ Market | Vercel AI SDK, LangChain.js, LangGraph.js, Mastra, Spring AI, LangChain4j |

## 6. AI / LLM Engineering

| # | Topic | Covers |
|---|-------|--------|
| 35 | LLM foundations | Transformers, tokenization, embeddings, sampling, context windows, reasoning models, failure modes |
| 36 | Foundation model APIs & model selection | OpenAI, Anthropic, Bedrock, Azure OpenAI, Vertex, Hugging Face; open vs closed, small models, build vs buy |
| 37 | Prompt & context engineering | Prompt design, context shaping, pruning, compaction, prompt chaining |
| 38 | Structured outputs & tool calling | JSON schemas, function calling, parallel tool calls, validation |
| 39 | RAG foundations | Chunking, embeddings, vector search, end-to-end RAG pipelines |
| 40 | Advanced retrieval | Hybrid search, reranking, query rewriting, metadata and permission-aware filtering, response validation |
| 41 | Vector databases & embedding strategies | Pinecone, Weaviate, Milvus, FAISS, pgvector, MongoDB Atlas vector search |
| 42 | Knowledge graphs & GraphRAG | Graph modeling, graph-based retrieval, enterprise knowledge grounding |
| 43 | Document AI & unstructured data ingestion | PDF parsing, OCR, LLM extraction / classification / summarization, provenance |
| 44 | AI agent architecture & patterns | Agent loop, planning, ReAct, reflection, agentic vs deterministic workflows |
| 45 | Multi-agent systems & orchestration | Supervisor / handoff patterns, agent-to-agent (A2A) communication |
| 46 | Agent frameworks & SDKs | LangGraph, LangChain, LlamaIndex, CrewAI, AutoGen, Semantic Kernel, Claude Agent SDK, Google ADK, Strands |
| 47 | Model Context Protocol (MCP) | MCP servers & clients, tool design, FastMCP, MCP infrastructure |
| 48 | Agent memory & state management | Short/long-term memory, checkpoints, session state |
| 49 | Human-in-the-loop design | Approval gates, escalation, confidence-based routing, review workflows |
| 50 | LLM & agent evaluation | Offline eval sets, LLM-as-judge, RAG eval (Ragas), online eval, regression detection, error analysis |
| 51 | LLM observability & tracing | LangSmith, Langfuse, agent traces, output quality monitoring |
| 52 | Guardrails & reliability for non-deterministic systems | Validators, policy checks, self-correction, fallbacks, circuit breakers, graceful degradation |
| 53 | LLM cost & latency optimization | Token economics, caching, model routing, batching, streaming |
| 54 | Fine-tuning & model adaptation | PEFT / LoRA, continued pre-training, RLHF / preference tuning, synthetic data |
| 55 | LLM serving & inference infrastructure | Open-source model deployment, GPU-aware scaling, vLLM / BentoML / Ray |
| 56 | LLMOps & AI platform engineering | Prompt & model versioning, CI/CD for AI, AI gateways, AI control planes |
| 57 | Multimodal & voice AI | Vision, speech-to-text, text-to-speech, speech-to-speech, realtime voice |
| 58 | AI security | Prompt injection, output sanitization, least-privilege tool access, data leakage, red-teaming |
| 59 | Responsible AI, governance & compliance | AI governance frameworks, auditability, AI regulation, Responsible AI practices |

## 7. Machine Learning

| # | Topic | Covers |
|---|-------|--------|
| 60 | ML fundamentals | Supervised / unsupervised learning, feature engineering, model evaluation |
| 61 | Deep learning & PyTorch | Neural networks, training, PyTorch / TensorFlow |
| 62 | Statistics & experimentation | Probability, hypothesis testing, experiment design, A/B testing |
| 63 | Applied ML problem types | NLP, computer vision, ranking / recommendations, forecasting, anomaly detection |
| 64 | MLOps | Experiment tracking (MLflow), model registry, feature stores, drift monitoring |

## 8. AI-Driven SDLC

| # | Topic | Covers |
|---|-------|--------|
| 65 | AI coding agents in daily engineering | Claude Code, Copilot (incl. Cloud Agent), Cursor, Codex; effective agentic workflows |
| 66 | Agentic SDLC & AI adoption at team / org level | AI usage guidelines, traceability, human validation, adoption metrics |

## 9. Cloud, DevOps & Production

| # | Topic | Covers |
|---|-------|--------|
| 67 | AWS | ECS / EKS, Lambda, S3, DynamoDB, Step Functions, IAM, Bedrock / AgentCore, SageMaker |
| | AWS deep dive: IAM & security | Advanced IAM policies, cross-account roles, permission boundaries, KMS, security services |
| | AWS deep dive: serverless | Lambda internals & tuning, API Gateway, Step Functions, EventBridge, serverless patterns |
| | AWS deep dive: containers (ECS & EKS) | ECS / Fargate and EKS in production: networking, scaling, IAM for pods, deployments |
| | AWS deep dive: data services | Aurora, DynamoDB advanced, ElastiCache, S3 at scale |
| | AWS deep dive: generative AI (Bedrock & AgentCore) | Bedrock models, knowledge bases, agents, guardrails, AgentCore runtime / gateway / memory |
| 68 | Azure & GCP for AI workloads | Azure OpenAI, Azure AI Foundry, Azure ML, Vertex AI |
| 69 | Docker & Kubernetes | Containers, Kubernetes, Helm, scaling |
| 70 | Infrastructure as Code | Terraform, CloudFormation, reusable modules |
| 71 | CI/CD & GitOps | GitHub Actions, Jenkins, release strategies, GitOps |
| 72 | Observability | Logs, metrics, traces, OpenTelemetry, Datadog / Prometheus / Grafana |
| 73 | Reliability engineering & incident management | SLOs, on-call, P1/P2 incidents, RCA, runbooks |
| 74 | Cloud architecture & cost management | Networking, identity, environments, serverless, FinOps |

## 10. Security

| # | Topic | Covers |
|---|-------|--------|
| 75 | Application & API security | OWASP Top 10, secure coding, threat modeling |
| 76 | Identity & access management | OAuth2 / OIDC, JWT, SSO, RBAC / ABAC, multi-tenancy |
| 77 | Data protection & privacy | Encryption, secrets (Vault), PII / PHI, HIPAA, GDPR, India DPDP |

## 11. Quality & Engineering Practices

| # | Topic | Covers |
|---|-------|--------|
| 78 | Testing strategy & test automation | Unit / integration / e2e, pytest, Jest, Cypress, testability, shift-left |
| 79 | Engineering standards & code review | Coding standards, review practices, linting, monorepos, quality gates |
| 80 | Debugging & production troubleshooting | Tracing issues across services, root-causing, working in unfamiliar codebases |

## 12. Leadership & Technical Decision-Making

| # | Topic | Covers |
|---|-------|--------|
| 81 | Technical leadership & strategy | Technical vision, roadmaps, ADRs, tech debt, trade-off decisions |
| 82 | Mentoring & raising team capability | Coaching, design / code review as teaching, growing engineers to independence |
| 83 | People management | Hiring, performance, career growth, team building |
| 84 | Stakeholder management & influence | Influence without authority, cross-team alignment, executive / client communication |
| 85 | Technical communication & writing | Design docs, RFCs, documentation, presenting, storytelling |
| 86 | Execution & delivery management | Agile / SAFe, scoping, estimation, risks & dependencies, breaking work into increments |
| 87 | Engineering excellence & org change | Standards adoption, RACI, change management, delivery metrics (DORA) |
| 88 | Behavioral interviews & leadership stories ★ Market | STAR stories, conflict, failure, ownership, ambiguity |

## 13. Product & Business

| # | Topic | Covers |
|---|-------|--------|
| 89 | Product thinking & discovery | Problem framing, user pain points, user value |
| 90 | Requirements & product artifacts | User stories, acceptance criteria, PRDs, success metrics |
| 91 | Prioritization & roadmapping | Backlog management, prioritization frameworks, roadmaps |
| 92 | Prototype to production | PoC, MVP, hardening, iterating on real usage |
| 93 | Forward-deployed & customer-facing engineering | Client discovery, demos, deploying into client environments, enablement & adoption |
| 94 | Product metrics & ROI of AI | Telemetry, adoption, value dashboards, measuring AI impact |
| 95 | Building internal platforms & tools | Tools and platforms others extend, low-code / template systems, developer platforms |

## 14. Career Assets

| # | Topic | Covers |
|---|-------|--------|
| 96 | Public technical presence ★ Market | Open-source contributions, portfolio projects, technical blogging, talks |
