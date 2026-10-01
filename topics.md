# Master Topic List

Extracted from the 33 JDs in `JD/`, plus topics added for current market demand (marked **★ Market**).
Not prioritized yet. Subtopics come in the next stage.

**What the JDs look like:** mostly Lead / Principal / Staff / Forward-Deployed AI Engineer roles (agents, RAG, LLMOps), plus Java/full-stack lead roles, a frontend role, and engineering-manager / practice-lead roles. Nearly every role expects full-stack production engineering *and* AI engineering *and* leadership.

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

## 4. Data & Databases

| # | Topic | Covers |
|---|-------|--------|
| 20 | Relational databases & SQL | PostgreSQL, indexing, query optimization, transactions, isolation levels |
| 21 | NoSQL databases | MongoDB, DynamoDB, Redis, document/key-value data modeling |
| 22 | Data engineering & pipeline orchestration | ETL/ELT, Airflow / Prefect, data quality, lineage |
| 23 | Big data & lakehouse | Spark / PySpark, Databricks, Dask, Parquet / Delta, Snowflake |
| 24 | Search & information retrieval | Elasticsearch, inverted indexes, BM25, relevance tuning |

## 5. Frontend & Full-Stack

| # | Topic | Covers |
|---|-------|--------|
| 25 | React & Next.js | React 18+, hooks, state management, routing, SSR / RSC; awareness of Angular / Vue |
| 26 | Frontend engineering at scale | Performance, bundling, testing, accessibility, component systems |
| 27 | Real-time & streaming web | WebSockets, SSE, streaming responses, full-duplex apps |
| 28 | UX & interfaces for AI products | Chat / copilot UIs, making agent work legible, review & approval queues, approval fatigue |

## 6. AI / LLM Engineering

| # | Topic | Covers |
|---|-------|--------|
| 29 | LLM foundations | Transformers, tokenization, embeddings, sampling, context windows, reasoning models, failure modes |
| 30 | Foundation model APIs & model selection | OpenAI, Anthropic, Bedrock, Azure OpenAI, Vertex, Hugging Face; open vs closed, small models, build vs buy |
| 31 | Prompt & context engineering | Prompt design, context shaping, pruning, compaction, prompt chaining |
| 32 | Structured outputs & tool calling | JSON schemas, function calling, parallel tool calls, validation |
| 33 | RAG foundations | Chunking, embeddings, vector search, end-to-end RAG pipelines |
| 34 | Advanced retrieval | Hybrid search, reranking, query rewriting, metadata and permission-aware filtering, response validation |
| 35 | Vector databases & embedding strategies | Pinecone, Weaviate, Milvus, FAISS, pgvector, MongoDB Atlas vector search |
| 36 | Knowledge graphs & GraphRAG | Graph modeling, graph-based retrieval, enterprise knowledge grounding |
| 37 | Document AI & unstructured data ingestion | PDF parsing, OCR, LLM extraction / classification / summarization, provenance |
| 38 | AI agent architecture & patterns | Agent loop, planning, ReAct, reflection, agentic vs deterministic workflows |
| 39 | Multi-agent systems & orchestration | Supervisor / handoff patterns, agent-to-agent (A2A) communication |
| 40 | Agent frameworks & SDKs | LangGraph, LangChain, LlamaIndex, CrewAI, AutoGen, Semantic Kernel, Claude Agent SDK, Google ADK, Strands |
| 41 | Model Context Protocol (MCP) | MCP servers & clients, tool design, FastMCP, MCP infrastructure |
| 42 | Agent memory & state management | Short/long-term memory, checkpoints, session state |
| 43 | Human-in-the-loop design | Approval gates, escalation, confidence-based routing, review workflows |
| 44 | LLM & agent evaluation | Offline eval sets, LLM-as-judge, RAG eval (Ragas), online eval, regression detection, error analysis |
| 45 | LLM observability & tracing | LangSmith, Langfuse, agent traces, output quality monitoring |
| 46 | Guardrails & reliability for non-deterministic systems | Validators, policy checks, self-correction, fallbacks, circuit breakers, graceful degradation |
| 47 | LLM cost & latency optimization | Token economics, caching, model routing, batching, streaming |
| 48 | Fine-tuning & model adaptation | PEFT / LoRA, continued pre-training, RLHF / preference tuning, synthetic data |
| 49 | LLM serving & inference infrastructure | Open-source model deployment, GPU-aware scaling, vLLM / BentoML / Ray |
| 50 | LLMOps & AI platform engineering | Prompt & model versioning, CI/CD for AI, AI gateways, AI control planes |
| 51 | Multimodal & voice AI | Vision, speech-to-text, text-to-speech, speech-to-speech, realtime voice |
| 52 | AI security | Prompt injection, output sanitization, least-privilege tool access, data leakage, red-teaming |
| 53 | Responsible AI, governance & compliance | AI governance frameworks, auditability, AI regulation, Responsible AI practices |

## 7. Machine Learning

| # | Topic | Covers |
|---|-------|--------|
| 54 | ML fundamentals | Supervised / unsupervised learning, feature engineering, model evaluation |
| 55 | Deep learning & PyTorch | Neural networks, training, PyTorch / TensorFlow |
| 56 | Statistics & experimentation | Probability, hypothesis testing, experiment design, A/B testing |
| 57 | Applied ML problem types | NLP, computer vision, ranking / recommendations, forecasting, anomaly detection |
| 58 | MLOps | Experiment tracking (MLflow), model registry, feature stores, drift monitoring |

## 8. AI-Driven SDLC

| # | Topic | Covers |
|---|-------|--------|
| 59 | AI coding agents in daily engineering | Claude Code, Copilot (incl. Cloud Agent), Cursor, Codex; effective agentic workflows |
| 60 | Agentic SDLC & AI adoption at team / org level | AI usage guidelines, traceability, human validation, adoption metrics |

## 9. Cloud, DevOps & Production

| # | Topic | Covers |
|---|-------|--------|
| 61 | AWS | ECS / EKS, Lambda, S3, DynamoDB, Step Functions, IAM, Bedrock / AgentCore, SageMaker |
| 62 | Azure & GCP for AI workloads | Azure OpenAI, Azure AI Foundry, Azure ML, Vertex AI |
| 63 | Docker & Kubernetes | Containers, Kubernetes, Helm, scaling |
| 64 | Infrastructure as Code | Terraform, CloudFormation, reusable modules |
| 65 | CI/CD & GitOps | GitHub Actions, Jenkins, release strategies, GitOps |
| 66 | Observability | Logs, metrics, traces, OpenTelemetry, Datadog / Prometheus / Grafana |
| 67 | Reliability engineering & incident management | SLOs, on-call, P1/P2 incidents, RCA, runbooks |
| 68 | Cloud architecture & cost management | Networking, identity, environments, serverless, FinOps |

## 10. Security

| # | Topic | Covers |
|---|-------|--------|
| 69 | Application & API security | OWASP Top 10, secure coding, threat modeling |
| 70 | Identity & access management | OAuth2 / OIDC, JWT, SSO, RBAC / ABAC, multi-tenancy |
| 71 | Data protection & privacy | Encryption, secrets (Vault), PII / PHI, HIPAA, GDPR, India DPDP |

## 11. Quality & Engineering Practices

| # | Topic | Covers |
|---|-------|--------|
| 72 | Testing strategy & test automation | Unit / integration / e2e, pytest, Jest, Cypress, testability, shift-left |
| 73 | Engineering standards & code review | Coding standards, review practices, linting, monorepos, quality gates |
| 74 | Debugging & production troubleshooting | Tracing issues across services, root-causing, working in unfamiliar codebases |

## 12. Leadership & Technical Decision-Making

| # | Topic | Covers |
|---|-------|--------|
| 75 | Technical leadership & strategy | Technical vision, roadmaps, ADRs, tech debt, trade-off decisions |
| 76 | Mentoring & raising team capability | Coaching, design / code review as teaching, growing engineers to independence |
| 77 | People management | Hiring, performance, career growth, team building |
| 78 | Stakeholder management & influence | Influence without authority, cross-team alignment, executive / client communication |
| 79 | Technical communication & writing | Design docs, RFCs, documentation, presenting, storytelling |
| 80 | Execution & delivery management | Agile / SAFe, scoping, estimation, risks & dependencies, breaking work into increments |
| 81 | Engineering excellence & org change | Standards adoption, RACI, change management, delivery metrics (DORA) |
| 82 | Behavioral interviews & leadership stories ★ Market | STAR stories, conflict, failure, ownership, ambiguity |

## 13. Product & Business

| # | Topic | Covers |
|---|-------|--------|
| 83 | Product thinking & discovery | Problem framing, user pain points, user value |
| 84 | Requirements & product artifacts | User stories, acceptance criteria, PRDs, success metrics |
| 85 | Prioritization & roadmapping | Backlog management, prioritization frameworks, roadmaps |
| 86 | Prototype to production | PoC, MVP, hardening, iterating on real usage |
| 87 | Forward-deployed & customer-facing engineering | Client discovery, demos, deploying into client environments, enablement & adoption |
| 88 | Product metrics & ROI of AI | Telemetry, adoption, value dashboards, measuring AI impact |
| 89 | Building internal platforms & tools | Tools and platforms others extend, low-code / template systems, developer platforms |

## 14. Career Assets

| # | Topic | Covers |
|---|-------|--------|
| 90 | Public technical presence ★ Market | Open-source contributions, portfolio projects, technical blogging, talks |
