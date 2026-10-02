# Python -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Advanced language features, async, typing, packaging, FastAPI / Django / Flask, pytest
python data model and dunder methods
python iterators, generators and yield from -i
python decorators with functools.wraps and parameterized decorators -i
python context managers and contextlib
python type hints, generics and protocols -i
python strict type checking with mypy or pyright
python dataclasses vs pydantic models
pydantic v2 validation and settings management -i
python asyncio event loop, coroutines and tasks -ui
python asyncio gather, taskgroups and cancellation -i
python gil: threading vs multiprocessing vs asyncio -ui
python memory management and garbage collection
python performance profiling with cprofile and py-spy
python packaging with pyproject.toml and uv -u
python dependency management and virtual environments with uv or poetry
python logging configuration and structured logging
fastapi routing, dependency injection and request validation -ui
fastapi async endpoints, background tasks and lifespan events -i
fastapi middleware, error handling and openapi docs
django orm models, querysets and n+1 query avoidance

# TypeScript & Node.js -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Language depth, Node runtime, NestJS / Express
javascript closures, scope and hoisting -i
javascript prototypes and this binding
javascript promises and async/await error handling -i
javascript event loop: microtasks vs macrotasks -ui
typescript unions, intersections and type narrowing -i
typescript generics and constraints -i
typescript utility types and mapped types
typescript conditional types and infer
typescript tsconfig strict mode and module resolution
esm vs commonjs modules in node.js
node.js event loop phases and libuv -i
node.js streams and backpressure
node.js worker threads and cluster module
node.js error handling and graceful shutdown
node.js memory leak diagnosis with heap snapshots
express middleware pipeline and error handlers
nestjs modules, providers and dependency injection
nestjs guards, interceptors and pipes

# Java & Spring
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Core Java, Spring Boot, Hibernate, JUnit, J2EE patterns
java collections internals: hashmap, arraylist, treemap
java generics and type erasure
java streams api and functional interfaces
java records, sealed classes and pattern matching
java exception handling best practices
jvm memory model: heap, stack and metaspace
jvm garbage collectors: g1 and zgc tuning basics
java concurrency with executorservice and completablefuture
java virtual threads (project loom)
spring boot auto-configuration and starters
spring dependency injection and bean lifecycle
spring boot rest controllers and request validation
spring data jpa and hibernate entity mapping
hibernate n+1 problem, lazy loading and fetch strategies
spring transaction management with @transactional
spring boot actuator, profiles and externalized config
spring security filter chain basics
junit 5 and mockito testing in spring boot

# Go or Rust
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Working depth in one, and knowing when to reach for it
go syntax, types and structs
go interfaces and composition
go error handling patterns
go goroutines and channels
go select, context cancellation and timeouts
go sync package: mutex, waitgroup, once
go modules and project layout
go net/http server and middleware
go testing and benchmarking
go profiling with pprof
rust ownership, borrowing and lifetimes basics
when to choose go or rust over python for a service

# Concurrency -u
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Threads, event loops, async I/O, multiprocessing, synchronization
concurrency vs parallelism fundamentals
race conditions and critical sections -i
mutexes, semaphores and condition variables
deadlocks: causes, detection and prevention -i
atomic operations, compare-and-swap and lock-free programming
producer-consumer problem with bounded queues -i
thread pool sizing for cpu-bound vs io-bound work
async io and the event-driven concurrency model
actor model concurrency
reader-writer locks and starvation
debugging and testing concurrency bugs
classic concurrency interview problems: dining philosophers, print in order
thread-safe token bucket rate limiter implementation

# Design Patterns -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## GoF patterns, composition, SOLID applied in real code
oop pillars: encapsulation, abstraction, inheritance, polymorphism -u
composition over inheritance
solid: single responsibility and open-closed principles -ui
solid: liskov substitution, interface segregation, dependency inversion -ui
factory method and abstract factory design patterns -ui
builder design pattern
singleton design pattern and its pitfalls
adapter and facade design patterns
decorator design pattern
proxy design pattern
composite design pattern
strategy design pattern -ui
observer design pattern -ui
command design pattern
state design pattern
template method and chain of responsibility design patterns
dependency injection and inversion of control -i
design anti-patterns: god object, anemic domain model, premature abstraction

# Low-Level Design -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Class/module design, machine-coding rounds, extensibility
low-level design interview approach and framework -i
uml class diagrams and sequence diagrams for lld
lld: parking lot system
lld: elevator system
lld: rate limiter -i
lld: lru cache -i
lld: library management system
lld: splitwise expense sharing
lld: chess game
lld: vending machine with state pattern
lld: notification service
lld: in-memory key-value store with ttl
lld: logging framework
lld: movie ticket booking with concurrent seat locking
lld: in-memory pub-sub message queue
lld: snake and ladder game

# Data Structures -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Arrays to graphs, heaps, tries, hash maps, complexity analysis
big-o time and space complexity analysis -u
arrays and dynamic arrays -u
string manipulation techniques for interviews -i
hash maps and hash sets: hashing and collisions -ui
linked lists: singly, doubly, fast and slow pointers -i
stacks and monotonic stack -i
queues, deques and monotonic queue
binary trees and tree traversals -ui
binary search tree operations
heaps and priority queues -ui
tries (prefix trees)
graph representation: adjacency list and matrix -u
union-find (disjoint set union)
segment trees and fenwick trees
balanced trees intuition: avl and red-black trees
bit manipulation basics

# Algorithms -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Two pointers, sliding window, DP, graphs, greedy, binary search, interview patterns
two pointers pattern -ui
sliding window pattern -ui
prefix sums and difference arrays -i
binary search on sorted arrays -ui
binary search on answer space
sorting algorithms: merge sort, quick sort, counting sort
recursion fundamentals -u
backtracking: permutations, combinations, subsets -ui
bfs on graphs and grids -ui
dfs on graphs and grids -ui
topological sort -i
shortest paths: dijkstra and bellman-ford
minimum spanning tree: kruskal and prim
dynamic programming: 1d problems -ui
dynamic programming: 2d and grid problems -i
dynamic programming on subsequences: lcs, lis, knapsack
dynamic programming on intervals and trees
greedy algorithms and interval scheduling -i
top-k and k-way merge with heaps -ui
intervals pattern: merge, insert, overlap -i

# System Design -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Scalability, load balancing, caching, CDNs, partitioning, estimation
system design interview framework: requirements, estimates, api, data model, deep dives -ui
back-of-the-envelope capacity estimation -i
vertical vs horizontal scaling
load balancers: l4 vs l7 and balancing algorithms -i
reverse proxy and api gateway roles
caching strategies: cache-aside, write-through, write-back -ui
cache invalidation and eviction policies -i
cdn and edge caching
database replication: leader-follower and multi-leader -i
database sharding and partitioning strategies -ui
consistent hashing -i
sql vs nosql selection trade-offs -ui
rate limiting algorithms: token bucket, leaky bucket, sliding window -i
blob and object storage design
stateless services and session management
high availability and failover design -i
unique id generation: snowflake, uuid, ulid

# Distributed Systems -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Consistency models, replication, consensus, idempotency, distributed transactions
cap theorem and pacelc -i
consistency models: strong, eventual, causal, read-your-writes -i
replication and quorum reads/writes
raft consensus algorithm
leader election in distributed systems
logical clocks: lamport and vector clocks
idempotency and idempotency keys -i
exactly-once vs at-least-once delivery semantics
two-phase commit for distributed transactions
saga pattern: choreography vs orchestration
distributed locking with redis and zookeeper
failure detection, heartbeats and gossip protocols
split brain and fencing tokens
retries with exponential backoff and jitter -i
designing for partial failure

# Microservices -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Service boundaries, inter-service communication, resilience patterns
monolith vs microservices trade-offs
identifying service boundaries with bounded contexts
synchronous vs asynchronous inter-service communication
service discovery and service registry
api gateway pattern for microservices
circuit breaker, bulkhead and timeout patterns -i
database per service and data ownership
data consistency across microservices
service mesh basics: istio, linkerd and sidecars
microservices observability and correlation ids
strangler fig pattern for monolith migration
contract testing between microservices with pact
microservices deployment and versioning strategies

# Event-Driven -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Kafka, queues, pub/sub, streaming, outbox, CQRS
event-driven architecture fundamentals: events, commands, notifications
message queues vs event streams -i
kafka architecture: brokers, topics, partitions, replication
kafka producers: acks, idempotence and batching
kafka consumer groups, offsets and rebalancing
kafka ordering guarantees and partition keys
kafka exactly-once semantics and transactions
rabbitmq exchanges, queues and routing
aws sqs, sns and eventbridge messaging patterns
dead letter queues and poison message handling
transactional outbox pattern
change data capture with debezium
event sourcing fundamentals
cqrs pattern
schema evolution with avro and schema registry
backpressure and consumer lag management

# API Design -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## REST, GraphQL, gRPC, OpenAPI, versioning, webhooks, API gateways, BFF, third-party integrations (Salesforce, Slack, Jira)
rest api design principles and resource modeling -ui
http methods, status codes and idempotency -i
api pagination: offset vs cursor -i
api versioning strategies
api error response design with rfc 7807 problem details
spec-first api design with openapi/swagger
graphql schema design, resolvers and dataloader for n+1
grpc and protocol buffers
webhook design: delivery, retries and signatures -ui
api gateway configuration: auth, throttling, routing (apigee, aws api gateway)
backend-for-frontend (bff) pattern
third-party api integration: rate limits, retries and sync strategies -i
salesforce rest api and platform events integration basics
slack app and bot integration basics
jira api integration and automation
api documentation and developer experience

# Architecture & DDD -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Hexagonal / clean architecture, modular monolith, DDD
layered architecture
hexagonal architecture (ports and adapters)
clean architecture
modular monolith design
ddd strategic design: bounded contexts and context mapping
ddd ubiquitous language
ddd tactical patterns: entities, value objects, aggregates
ddd domain events and repositories
anti-corruption layer pattern
serverless architecture style trade-offs
architecture characteristics and non-functional requirements analysis
evolutionary architecture and fitness functions

# Performance & Caching -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Redis, profiling, latency budgets, load testing, tuning against SLOs
performance fundamentals: latency, throughput, percentiles
latency budgets and tail latency (p99)
cpu profiling and flame graphs
memory profiling and leak detection
database query profiling with explain analyze
redis data structures and use cases
redis caching patterns and ttl design -i
redis persistence, eviction and clustering
connection pooling for databases and http clients
load testing with k6 or locust
performance tuning against slos
http performance: keep-alive, compression, http/2
async processing and batching to improve throughput

# Durable Workflows -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Job queues, schedulers, long-running workflows, Temporal / Step Functions, sagas
background jobs and task queue fundamentals
celery task queue with redis or rabbitmq
bullmq job queues in node.js
cron scheduling and distributed schedulers
retry policies and idempotent job design
temporal workflows and activities basics
temporal durable execution for long-running ai agents -i
aws step functions state machines
workflow orchestration vs choreography
long-running job progress tracking and resumability

# System Design Cases -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Interview-style designs: chat, feed, notifications, payments, rate limiter, etc.
system design: url shortener -i
system design: rate limiter service -ui
system design: chat application like whatsapp -ui
system design: news feed like twitter or instagram -i
system design: notification system -ui
system design: payment system -i
system design: ride hailing like uber
system design: video streaming like youtube or netflix
system design: distributed key-value store
system design: search autocomplete / typeahead
system design: web crawler
system design: file storage and sync like dropbox
system design: ticket booking with high contention
system design: distributed job scheduler -i
system design: metrics and logging platform
system design: e-commerce order management
system design: collaborative document editing like google docs
system design: real-time leaderboard

# GenAI System Design -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Interview-style designs: enterprise RAG, copilot, multi-agent platform, AI gateway
genai system design interview framework -ui
ai system design: enterprise rag knowledge assistant -ui
ai system design: customer support agent with human escalation -ui
ai system design: coding assistant / copilot -i
ai system design: multi-agent research system -i
ai system design: llm gateway with routing, rate limits and fallbacks -ui
ai system design: document extraction pipeline at scale -ui
ai system design: semantic search for e-commerce
ai system design: ai-powered recommendation system
ai system design: realtime voice agent
ai system design: agentic sdlc platform with human approval gates
ai system design: multi-tenant llm saas platform -i
ai system design: evaluation and observability platform for llm apps -i
ai system design: text-to-sql analytics assistant -i
ai system design: aiops agent for cloud incident remediation

# Scaling Patterns -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Scaling 0 → millions of users, multi-region active-active, cell-based architecture, hot keys, thundering herd, autoscaling
scaling a web app from zero to a million users step by step -i
read-heavy vs write-heavy scaling strategies
read/write splitting and handling replication lag in the app
hot keys and hot partitions mitigation
thundering herd and cache stampede prevention
request coalescing and cache warming
queue-based load leveling
autoscaling strategies: reactive, scheduled, predictive
multi-region architecture: active-passive vs active-active
global traffic routing with geo-dns and anycast
cell-based architecture and blast radius reduction
shuffle sharding
data locality and geo-partitioning
scaling stateful services
backpressure and admission control at scale
fan-out on write vs fan-out on read
real-world scaling case studies: discord, slack, netflix

# SQL -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## PostgreSQL, indexing, query optimization, transactions, isolation levels
sql joins: inner, outer, self, cross
sql aggregations, group by and having
sql window functions -i
sql ctes and recursive queries
sql subqueries vs joins performance
database normalization and denormalization
postgresql index types: b-tree, hash, gin, gist -i
composite indexes and index selectivity -i
reading postgresql query plans with explain analyze -ui
acid properties of transactions
transaction isolation levels and read anomalies -ui
mvcc in postgresql -i
row locks, deadlocks and select for update in postgresql
postgresql jsonb usage and indexing
postgresql table partitioning
zero-downtime database migrations and schema changes -i
postgresql replication and read replicas
sql interview problems practice -ui

# NoSQL -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## MongoDB, DynamoDB, Redis, document/key-value data modeling
nosql database types and when to use each -i
mongodb document modeling: embedding vs referencing
mongodb indexes and query optimization
mongodb aggregation pipeline
mongodb transactions and consistency
mongodb replica sets and sharding
dynamodb partition key and sort key design
dynamodb single-table design
dynamodb gsi, lsi and access patterns
dynamodb streams and ttl
cassandra data model and write path basics
redis as a primary datastore: use cases and limits

# Data Engineering
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## ETL/ELT, Airflow / Prefect, data quality, lineage
etl vs elt
batch vs streaming data pipelines
dimensional modeling and star schema for analytics
airflow dags, operators and scheduling
airflow sensors, xcom and task dependencies
airflow deployment on kubernetes (eks)
prefect flows and tasks
data quality checks with great expectations
data lineage and metadata management
incremental loads and idempotent data pipelines
slowly changing dimensions
dbt models and transformations

# Big Data
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Spark / PySpark, Databricks, Dask, Parquet / Delta, Snowflake
spark architecture: driver, executors and dag
pyspark dataframes api
spark transformations, actions and lazy evaluation
spark shuffles, partitioning and join optimization
spark structured streaming
databricks workspace, clusters and jobs
delta lake: acid tables and time travel
medallion architecture: bronze, silver, gold layers
parquet columnar format and file sizing
snowflake architecture and virtual warehouses
dask for parallel python processing
lakehouse vs data warehouse vs data lake
apache flink stream processing basics

# Search -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Elasticsearch, inverted indexes, BM25, relevance tuning
inverted index fundamentals
tf-idf and bm25 ranking -i
text analysis: tokenizers, stemming and analyzers
elasticsearch architecture: indexes, shards, replicas
elasticsearch mappings and query dsl
elasticsearch aggregations
search relevance tuning and boosting
search evaluation metrics: precision, recall, mrr, ndcg
autocomplete and fuzzy search
vector knn search in elasticsearch / opensearch

# Database Internals
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Storage engines (B-tree vs LSM), WAL, query planner, vacuum, buffer cache, advanced tuning
database storage engines: b-tree vs lsm-tree
write-ahead logging (wal) and crash recovery
postgresql shared buffers and buffer cache tuning
postgresql query planner internals and statistics
database join algorithms: nested loop, hash join, merge join
postgresql vacuum, autovacuum and table bloat
postgresql covering, partial and index-only scans
postgresql expression indexes and index maintenance cost
postgresql advisory locks and lock contention analysis
serializable snapshot isolation and write skew
postgresql config tuning: work_mem, effective_cache_size, checkpoints
slow query analysis with pg_stat_statements
mysql innodb internals: clustered indexes and undo logs
database deadlock analysis in production
optimistic vs pessimistic concurrency control in databases
materialized views and query result caching

# Database Scaling
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Connection pooling, read replicas, sharding at scale, distributed SQL, multi-region, failover, backups / PITR
database connection pooling with pgbouncer and rds proxy
read replicas and replication lag management
synchronous vs asynchronous database replication trade-offs
database failover and high availability with patroni or aurora
horizontal database sharding: shard keys, routing and resharding -i
sharding postgresql with citus
sharding mysql with vitess
distributed sql databases: cockroachdb, yugabytedb, spanner
aurora architecture: separated storage and global database
multi-region database design and conflict resolution
online schema migrations at scale with gh-ost and pg_repack
database backups, point-in-time recovery and restore testing
database capacity planning and vertical scaling limits
cqrs read models for scaling database reads
archiving and tiering cold data

# React & Next.js -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## React 18/19, hooks, state management, routing, SSR / RSC, server actions
react rendering and reconciliation -i
react hooks: usestate, useeffect, useref -ui
react memoization with usememo, usecallback and memo -i
writing custom react hooks -i
react context and avoiding prop drilling
state management with redux toolkit
server state management with tanstack query -i
react forms and validation with react hook form and zod
react router and nested routing
react suspense and error boundaries
react concurrent features and transitions
react 19 features: actions, use() hook and react compiler
next.js app router and layouts -ui
react server components and server actions -ui
next.js data fetching, caching and revalidation -i
next.js rendering modes: ssr vs ssg vs isr -i
next.js route handlers and middleware

# Angular
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Standalone components, signals, RxJS, change detection, NgRx, routing, forms
angular standalone components and application bootstrapping
angular templates, data binding and built-in control flow (@if, @for)
angular dependency injection and services
angular signals and computed state
angular change detection: default, onpush and zoneless
rxjs observables, subjects and core operators
rxjs higher-order mapping: switchmap, mergemap, concatmap, exhaustmap
angular router: lazy loading, guards and resolvers
angular reactive forms and validation
angular httpclient and interceptors
angular state management with ngrx store and signal store
angular component communication: inputs, outputs and models
angular performance: deferrable views, track and ssr hydration
angular testing with testbed and jest
angular cli workspaces and nx monorepo setup
migrating angularjs to modern angular

# Vue & Nuxt
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Composition API, reactivity, Pinia, Nuxt rendering modes
vue 3 composition api and reactivity: ref, reactive, computed
vue single-file components and template syntax
vue component props, emits and slots
vue watchers and lifecycle hooks
vue composables for reusable logic
vue router basics
vue state management with pinia
nuxt 3 file-based routing and rendering modes
nuxt data fetching and server routes
vue vs react vs angular trade-offs

# React Native
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Mobile apps with React Native & Expo, navigation, performance, releases
react native architecture: new architecture, fabric and turbomodules
react native core components and styling
expo setup and development workflow
react navigation in react native
react native state management and data fetching
react native list performance with flatlist and flashlist
react native native modules and platform-specific code
react native offline storage and sync
push notifications in react native
react native builds and releases with eas
react native testing with jest and detox

# Full-Stack TypeScript -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## tRPC, Zod, Prisma / Drizzle, Auth.js, Turborepo, Vercel / edge deployment
full-stack typescript monorepo with shared types
end-to-end type safety with trpc
zod schema validation shared across client and server -i
prisma orm: schema, migrations and queries
drizzle orm basics
authentication in full-stack apps with auth.js (nextauth) or clerk
file uploads to object storage from a full-stack app
background jobs and cron in full-stack typescript apps
deploying full-stack apps on vercel and serverless platforms
edge runtime and edge functions trade-offs
turborepo monorepo setup for full-stack apps
bun runtime for full-stack typescript

# Frontend at Scale -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Performance, bundling, testing, accessibility, component systems
web performance and core web vitals
code splitting and lazy loading
bundlers: vite, webpack and tree shaking
react rendering performance with react profiler
virtualized lists for large datasets
frontend unit testing with jest and react testing library
frontend end-to-end testing with playwright or cypress
web accessibility: aria, keyboard navigation, screen readers
design systems and component libraries
css architecture: css modules, tailwind, css-in-js
frontend monorepos with nx or turborepo
browser critical rendering path
frontend error tracking and monitoring with sentry
content security policy for frontend apps

# Real-Time Web -u
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## WebSockets, SSE, streaming responses, full-duplex apps
http polling vs long polling vs sse vs websockets -i
server-sent events implementation
websocket server and client implementation
scaling websockets with redis pub/sub
streaming llm tokens to the browser -i
streaming http responses in fastapi
socket.io rooms and namespaces
webrtc basics for audio and video
realtime presence and collaborative sync with crdt basics
handling reconnects, ordering and backpressure in realtime apps

# AI UX -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Chat / copilot UIs, making agent work legible, review & approval queues, approval fatigue
ux patterns for chat and copilot interfaces
streaming ui states: loading, partial, error
showing agent reasoning, steps and tool calls to users -i
displaying confidence, citations and sources in ai ui
designing approval queues and decision inboxes for agents
avoiding approval fatigue in human-in-the-loop ui
undo, edit and regenerate patterns in ai ux
capturing user feedback on ai output: ratings and corrections
generative ui: rendering structured llm output as components
building chat ui with vercel ai sdk
trust and transparency in ai product design

# Full-Stack AI Apps -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## End-to-end AI apps: streaming chat, RAG web apps, chat persistence, per-user isolation, quotas, AI in existing CRUD apps
full-stack ai app architecture: frontend, api, llm and vector store -ui
streaming chat endpoint from fastapi to a react frontend -ui
streaming chat endpoint from nestjs to an angular frontend
next.js ai chatbot with server actions and streaming -i
building a rag web app end to end with next.js and pgvector -ui
persisting chat history and threads in a database -i
document upload to rag ingestion flow in a web app -i
rendering llm tool calls and agent steps in a web ui
auth, multi-tenancy and per-user data isolation in ai apps -i
per-user rate limiting and usage quotas for llm features
cost tracking and usage-based billing for ai features
long-running ai tasks with background jobs and progress ui
deploying a dockerized ai web app to the cloud -u
adding ai copilots to existing enterprise crud apps -i

# AI SDKs -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Vercel AI SDK, LangChain.js, LangGraph.js, Mastra, Spring AI, LangChain4j
vercel ai sdk core: generatetext, streamtext, generateobject -i
vercel ai sdk ui hooks: usechat and usecompletion
vercel ai sdk tool calling and agents
langchain.js basics
langgraph.js agents
mastra typescript agent framework
openai and anthropic typescript sdks
mcp clients and servers inside typescript apps
spring ai chat client, prompts and structured output
spring ai rag with vector stores
spring ai tool calling and mcp
langchain4j basics for java

# LLM Foundations -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Transformers, tokenization, embeddings, sampling, context windows, reasoning models, failure modes
neural network basics for understanding llms
transformer architecture overview -u
self-attention and multi-head attention -i
tokenization: bpe and token counting -u
embeddings and vector representations of text -u
positional encoding and context windows
llm training stages: pretraining, instruction tuning, rlhf
llm decoding: temperature, top-p, top-k -u
reasoning models and test-time compute -i
mixture of experts llm architecture
kv cache and how llm inference works -i
llm hallucinations: causes and mitigation -ui
llm limitations: knowledge cutoff, math, long-context degradation -i
llm scaling laws basics
llm model landscape: gpt, claude, gemini, llama, mistral, qwen, deepseek

# Model APIs -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## OpenAI, Anthropic, Bedrock, Azure OpenAI, Vertex, Hugging Face; open vs closed, small models, build vs buy
openai responses and chat completions api basics -i
anthropic claude messages api basics -i
aws bedrock model invocation and converse api
azure openai deployments and api usage
google vertex ai gemini api
hugging face hub, transformers library and inference endpoints
streaming responses from llm apis
llm api rate limits, retries and error handling
prompt caching in llm apis
batch apis for offline llm workloads
llm model selection criteria: accuracy, latency, cost, context length -i
open-source vs proprietary llm trade-offs -i
small language models (phi, gemma) and their use cases
running local llms with ollama
llm provider abstraction with litellm
build vs buy for ai capabilities

# Prompt Engineering -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Prompt design, context shaping, pruning, compaction, prompt chaining
prompt anatomy: system, user and assistant roles
zero-shot vs few-shot prompting
chain-of-thought prompting
prompt templates and variables
designing system prompts: role, instructions, constraints -i
structuring prompts with xml tags and markdown
prompt chaining and task decomposition -i
context engineering fundamentals -ui
context window budgeting and prioritization -i
context compaction and summarization for long sessions -i
context pruning and relevant context selection
long-context vs rag trade-offs -ui
prompt versioning and management -i
prompt testing and iteration workflow
prompt optimization with dspy

# Tool Calling -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## JSON schemas, function calling, parallel tool calls, validation
llm json mode vs schema-enforced structured outputs -ui
pydantic models for llm structured output -i
structured extraction with the instructor library
llm tool/function calling fundamentals -ui
designing llm tool schemas and descriptions -i
parallel tool calls in llm apis
llm tool call error handling and retries -i
validating and repairing malformed llm output -i
constrained decoding with outlines and grammars
tool calling differences across openai, anthropic and bedrock

# RAG -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Chunking, embeddings, vector search, end-to-end RAG pipelines
rag architecture end to end -ui
document loading and preprocessing for rag
rag chunking strategies: fixed, recursive, semantic -ui
rag chunk size and overlap tuning
embedding model selection for rag -i
generating embeddings with openai and sentence-transformers -u
langchain embedding generation and vector store integration
llamaindex ingestion pipeline and query engine basics
building a rag pipeline from scratch without frameworks -ui
prompting for grounded answers with citations -i
rag failure modes and debugging -ui
incremental indexing and re-indexing documents for rag -i

# Advanced Retrieval -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Hybrid search, reranking, query rewriting, metadata and permission-aware filtering, response validation
hybrid search: bm25 plus vector with reciprocal rank fusion -ui
reranking with cross-encoders (cohere rerank, bge reranker) -ui
query rewriting and query expansion for rag -i
hyde: hypothetical document embeddings
multi-query retrieval
metadata filtering in vector search -i
permission-aware retrieval with document acls -i
parent-child and small-to-big retrieval
contextual retrieval and contextual chunk headers -i
agentic rag and iterative retrieval -ui
corrective rag and self-rag
multi-hop retrieval for complex questions
rag response validation and groundedness checks -i
retrieval over tables and structured data
text-to-sql as a retrieval strategy -i

# Vector Databases -u
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Pinecone, Weaviate, Milvus, FAISS, pgvector, MongoDB Atlas vector search
vector similarity metrics: cosine, dot product, euclidean -i
ann vector search with hnsw -i
ann vector search with ivf and product quantization
pgvector setup and indexing in postgresql -i
pinecone indexes and namespaces
weaviate schema and hybrid search
milvus architecture basics
faiss for local vector search
chroma for rag prototyping
mongodb atlas vector search
vector database selection criteria and benchmarking
embedding dimensionality, matryoshka embeddings and quantization
multi-tenancy in vector databases

# GraphRAG
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Graph modeling, graph-based retrieval, enterprise knowledge grounding
knowledge graph fundamentals: entities, relations, ontologies
neo4j and cypher query basics
building knowledge graphs from text with llms
microsoft graphrag approach -i
hybrid graph + vector retrieval
entity resolution and entity linking
multi-hop question answering over knowledge graphs
lightrag and lightweight graphrag alternatives
text-to-cypher query generation with llms
maintaining and updating knowledge graphs

# Document AI
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## PDF parsing, OCR, LLM extraction / classification / summarization, provenance
pdf parsing with pymupdf and pdfplumber
layout-aware document parsing with unstructured, docling or llamaparse -i
ocr with tesseract and cloud ocr (textract, azure document intelligence)
table extraction from pdfs and documents
vision llms for document understanding
llm-based structured information extraction -i
llm document classification pipelines
llm summarization strategies: map-reduce and refine
audio transcription ingestion pipelines
ingesting slack and email data for llm apps
provenance, metadata and traceability in document ingestion
evaluating document extraction accuracy

# AI Agents -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Agent loop, planning, ReAct, reflection, agentic vs deterministic workflows
what is an ai agent: the agent loop -ui
workflows vs agents: when to use each -ui
react agent pattern (reason + act) -i
plan-and-execute agents
reflection and self-critique loops in agents -i
llm routing workflow pattern
prompt chaining workflow pattern
parallelization workflow pattern for llms
orchestrator-worker agent pattern -i
evaluator-optimizer agent pattern
building an ai agent from scratch without frameworks -ui
agent tool design principles -i
agent stopping conditions and loop control -i
computer-use and browser agents
coding agent architecture
deep research agent architecture

# Multi-Agent Systems -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Supervisor / handoff patterns, agent-to-agent (A2A) communication
multi-agent system fundamentals and when to use them -ui
supervisor (hierarchical) multi-agent pattern -i
agent handoffs and swarm pattern
agent-to-agent (a2a) protocol -i
shared state and communication between agents
subagents and context isolation
multi-agent failure modes and coordination problems -i
multi-agent cost and latency trade-offs
debugging multi-agent systems
multi-agent supervisor implementation with langgraph -i

# Agent Frameworks -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## LangGraph, LangChain, LlamaIndex, CrewAI, AutoGen, Semantic Kernel, Claude Agent SDK, Google ADK, Strands
langchain core: runnables and lcel -i
langchain chat models, prompt templates and output parsers -u
langchain tools and agents -i
langgraph state graphs, nodes and edges -ui
langgraph conditional edges and cycles -i
langgraph checkpointing and persistence -i
langgraph human-in-the-loop with interrupts -ui
langgraph streaming modes
langgraph mermaid graph visualization
langgraph subgraphs
llamaindex agents and workflows
crewai agents, tasks and crews -i
autogen multi-agent conversations
semantic kernel plugins and planners
openai agents sdk
claude agent sdk -i
google agent development kit (adk)
aws strands agents
comparing agent frameworks and choosing one -i

# MCP -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## MCP servers & clients, tool design, FastMCP, MCP infrastructure
mcp architecture: hosts, clients, servers -ui
mcp primitives: tools, resources, prompts -i
building an mcp server with fastmcp in python -ui
building an mcp server with the typescript sdk
mcp transports: stdio vs streamable http -i
integrating an mcp client into an agent -i
mcp authentication and authorization with oauth -i
mcp server security: tool poisoning and permissions -i
deploying remote mcp servers
mcp gateway and registry patterns
mcp sampling and elicitation
mcp tool design best practices -i

# Agent Memory -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Short/long-term memory, checkpoints, session state
agent memory types: short-term, long-term, episodic, semantic -i
conversation history management and truncation -i
agent long-term memory with vector stores
agent memory frameworks: mem0, letta, zep
langgraph long-term memory store
agent session state and checkpoint persistence
agent memory summarization and consolidation
user personalization with agent memory
agent memory privacy and forgetting
scratchpads and note-taking for long-horizon agents

# Human-in-the-Loop -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Approval gates, escalation, confidence-based routing, review workflows
human-in-the-loop fundamentals: when to require a human
approval gates for high-risk agent actions -i
confidence-based routing to human reviewers
escalation and handoff from ai agent to human
review queues and feedback loops for ai output
using human feedback as eval and training data
interrupt and resume patterns in agent workflows
drawing the line between deterministic and agentic decisions -i
risk tiering of agent actions
maker-checker controls for ai output

# Evals -ui
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Offline eval sets, LLM-as-judge, RAG eval (Ragas), online eval, regression detection, error analysis
llm evaluation fundamentals: why evals matter -ui
building golden datasets for llm evals -ui
error analysis on llm traces -ui
code-based assertions and deterministic llm evals -i
llm-as-judge evaluation design -ui
calibrating llm judges against human labels
rag evaluation metrics: faithfulness, context precision, context recall -ui
rag evaluation with ragas -i
llm testing with deepeval or promptfoo
agent evaluation: trajectory and tool-use correctness -ui
multi-turn conversation evaluation
online evaluation and production monitoring of llm apps -i
running llm eval regression tests in ci -i
a/b testing llm features in production
hallucination detection and measurement -i
synthetic test data generation for llm evals
llm benchmarks overview: mmlu, swe-bench and others

# LLM Observability -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## LangSmith, Langfuse, agent traces, output quality monitoring
llm observability fundamentals: traces, spans, generations -ui
langsmith tracing and datasets -i
langfuse tracing, scoring and prompt management -i
opentelemetry for llm apps with genai semantic conventions
arize phoenix for llm observability
llm token usage and cost tracking -i
agent trace analysis and debugging -i
llm output quality monitoring and drift
logging user feedback on llm responses
dashboards and alerting for llm applications

# Guardrails -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Validators, policy checks, self-correction, fallbacks, circuit breakers, graceful degradation
llm guardrails fundamentals: input and output filtering -ui
nemo guardrails
guardrails ai validators
llama guard and moderation apis
pii detection and redaction with presidio -i
llm self-correction loops and retry with feedback -i
deterministic fallbacks for llm failures -i
circuit breakers and timeouts for llm calls
model fallback chains across llm providers -i
graceful degradation for ai features
policy checks before agent actions
handling llm non-determinism: temperature, seeds and idempotency

# LLM Cost & Latency -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Token economics, caching, model routing, batching, streaming
llm token economics and cost modeling -ui
prompt caching for llm cost and latency -i
semantic caching of llm responses -i
llm model routing and cascading (cheap model first) -ui
batching llm requests for throughput
streaming for perceived llm latency
parallel tool calls and concurrent llm calls
reducing llm prompt size and output tokens
llm time to first token vs total latency -i
cost governance and budgets for ai workloads
self-hosted llm vs api cost comparison -i

# Fine-Tuning
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## PEFT / LoRA, continued pre-training, RLHF / preference tuning, synthetic data
when to fine-tune vs prompt engineering vs rag -i
dataset preparation for llm fine-tuning
supervised fine-tuning (sft) basics
lora and qlora fine-tuning
hands-on fine-tuning with the hugging face peft library
continued pre-training (cpt) for domain adaptation
llm fine-tuning with hugging face trl
efficient llm fine-tuning with unsloth
rlhf overview
dpo and preference optimization
fine-tuning embedding models for retrieval
synthetic data generation for llm training
model distillation from large to small llms
evaluating fine-tuned llms
managed fine-tuning on openai and aws bedrock

# LLM Serving
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Open-source model deployment, GPU-aware scaling, vLLM / BentoML / Ray
llm inference fundamentals: prefill and decode -i
gpu memory and vram sizing for llm inference
llm serving with vllm and paged attention
llm serving engines: tgi, sglang, triton
llm quantization: gguf, awq, gptq, int8/fp8
continuous batching in llm serving
speculative decoding
deploying llms on kubernetes with gpu autoscaling
model serving with bentoml
distributed inference with ray serve
llm inference throughput and latency benchmarking
serverless gpu inference options

# LLMOps
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Prompt & model versioning, CI/CD for AI, AI gateways, AI control planes
llmops vs mlops
prompt registry and prompt versioning -i
model registry and versioning for llms
ci/cd pipelines for llm applications
llm gateway: routing, keys and quotas with litellm or portkey -i
ai control plane design
feature flags and gradual rollout for ai features
dataset and eval versioning
deploying containerized llm apps to the cloud
llm experiment tracking with mlflow
building reusable llm components and internal accelerators
multi-tenant llm platform design

# Multimodal & Voice
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Vision, speech-to-text, text-to-speech, speech-to-speech, realtime voice
vision language models for image understanding
image generation apis basics
speech-to-text with whisper and deepgram
text-to-speech apis: elevenlabs and openai tts
voice agent pipeline: stt, llm, tts -i
openai realtime api and speech-to-speech models
voice activity detection and turn-taking in voice agents
latency optimization for voice agents
building voice agents with livekit or pipecat
video understanding with multimodal models

# AI Security -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Prompt injection, output sanitization, least-privilege tool access, data leakage, red-teaming
owasp top 10 for llm applications -ui
direct prompt injection attacks and defenses -i
indirect prompt injection via documents and tools -ui
llm jailbreaks and defenses
data exfiltration risks through ai agents
least-privilege tool access for ai agents -i
sandboxing code execution for ai agents
llm output sanitization and insecure output handling
secrets and credentials handling in ai agents
ai red teaming basics
ai model supply chain and data poisoning risks
mcp and tool security risks for agents

# Responsible AI
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## AI governance frameworks, auditability, AI regulation, Responsible AI practices
responsible ai principles: fairness, transparency, accountability
bias detection and mitigation in ai systems
eu ai act overview for engineers
nist ai risk management framework
iso 42001 ai management system basics
ai governance operating model in an enterprise
model cards and ai system documentation
audit trails and auditability for ai decisions
ai in regulated domains: finance and healthcare
explainability of ai outputs

# ML Fundamentals
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Supervised / unsupervised learning, feature engineering, model evaluation
ml problem framing and types of ml
linear regression and gradient descent
logistic regression for classification
decision trees and random forests
gradient boosting with xgboost and lightgbm
k-means and clustering algorithms
dimensionality reduction with pca
bias-variance trade-off and regularization
train/validation/test splits and cross-validation
classification metrics: precision, recall, f1, roc-auc -i
ml regression metrics: mae, rmse, r2
feature engineering techniques
handling imbalanced datasets
scikit-learn pipelines

# Deep Learning
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Neural networks, training, PyTorch / TensorFlow
neural network fundamentals: perceptrons and activation functions
backpropagation intuition
pytorch tensors and autograd
writing a pytorch training loop
optimizers and learning rate schedules: sgd, adam
deep learning regularization: dropout and batch normalization
convolutional neural networks (cnn) basics
recurrent neural networks and lstm basics
transfer learning with pretrained models
gpu training basics and mixed precision

# Statistics
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Probability, hypothesis testing, experiment design, A/B testing
descriptive statistics and probability distributions
probability fundamentals and bayes theorem
sampling and the central limit theorem
hypothesis testing and p-values
confidence intervals
t-tests and chi-square tests
a/b test design: sample size and statistical power
a/b test pitfalls: peeking, novelty effects, multiple testing
correlation vs causation
bayesian a/b testing basics

# Applied ML
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## NLP, computer vision, ranking / recommendations, forecasting, anomaly detection
text classification with classical nlp
named entity recognition
image classification
object detection basics with yolo
image segmentation basics
recommendation systems: collaborative filtering
recommendation systems: two-tower retrieval and ranking
learning to rank
time series forecasting basics: arima and prophet
anomaly detection techniques

# MLOps
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Experiment tracking (MLflow), model registry, feature stores, drift monitoring
mlops lifecycle overview
ml experiment tracking with mlflow
model registry and promotion workflows
feature stores with feast
ml model serving patterns: batch vs online
ml model monitoring and data drift detection
ml pipelines with kubeflow or sagemaker pipelines
data and model versioning with dvc
ci/cd for ml models
sagemaker training and deployment basics

# AI Coding Agents -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Claude Code, Copilot (incl. Cloud Agent), Cursor, Codex; effective agentic workflows
claude code fundamentals: commands, modes and permissions -u
claude.md and project memory for coding agents -i
claude code subagents, skills and hooks -i
connecting mcp servers to claude code
github copilot chat and agent mode -i
github copilot cloud agent workflows -i
cursor rules and agent workflows
openai codex cli workflows
spec-driven development with ai coding agents -ui
plan-then-implement workflow with coding agents -i
writing effective prompts for coding agents
reviewing and verifying ai-generated code -ui
test-driven development with ai coding agents
using ai agents for debugging and codebase exploration
running parallel coding agents with git worktrees
ai-assisted refactoring and code migrations

# Agentic SDLC -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## AI usage guidelines, traceability, human validation, adoption metrics
agentic sdlc overview: ai across plan, build, test, deploy
ai usage guidelines and policy for engineering teams
traceability of ai-generated code and decisions
human validation and maker-checker for ai-generated code
ai-assisted code review automation
ai agents in ci/cd pipelines
measuring ai adoption and developer productivity impact
rolling out ai coding tools across an engineering org
security and ip risks of ai coding tools
ai-assisted requirements and test case generation

# AWS -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## ECS / EKS, Lambda, S3, DynamoDB, Step Functions, IAM, Bedrock / AgentCore, SageMaker
aws iam: users, roles and policies -ui
aws vpc networking basics -i
aws ec2 and auto scaling groups
aws s3: storage classes, bucket policies and events -i
aws lambda and event triggers -ui
aws api gateway with lambda
aws ecs and fargate -i
aws eks basics -i
aws rds and aurora
aws elasticache
aws sqs, sns and eventbridge in practice -i
aws route 53 and cloudfront
aws cloudwatch logs, metrics and alarms
aws bedrock overview -u
aws sagemaker overview
aws secrets manager and kms
aws well-architected framework -i

# AWS IAM
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Advanced IAM policies, cross-account roles, permission boundaries, KMS, security services
aws iam policy evaluation logic: explicit deny, scps, boundaries
aws iam identity-based vs resource-based policies
aws iam cross-account access with assume role
aws iam permission boundaries and least privilege design
aws iam roles for eks pods: irsa and eks pod identity
aws iam identity center (sso) for multi-account access
aws organizations and service control policies
aws kms key policies, envelope encryption and grants
aws security services: guardduty, security hub, inspector
aws cloudtrail auditing and aws config rules
aws waf and shield for application protection
aws vpc security: security groups, nacls, privatelink, vpc endpoints

# AWS Serverless -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Lambda internals & tuning, API Gateway, Step Functions, EventBridge, serverless patterns
aws lambda execution model, cold starts and snapstart -i
aws lambda concurrency: reserved, provisioned and throttling
aws lambda performance tuning: memory, layers and packaging
aws lambda error handling, retries and destinations
aws api gateway: rest vs http apis, authorizers and throttling
aws step functions: standard vs express workflows
aws step functions error handling, retries, parallel and map states
aws eventbridge rules, event buses and pipes
aws sqs with lambda: batching, partial failures, visibility timeout
aws serverless patterns: fan-out, saga, event sourcing
aws sam and cdk for serverless deployments
aws lambda observability with x-ray and powertools
aws lambda for llm workloads: response streaming and timeouts

# AWS Containers
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## ECS / Fargate and EKS in production: networking, scaling, IAM for pods, deployments
aws ecs task definitions, services and capacity providers
aws ecs fargate vs ec2 launch types trade-offs
aws ecs service connect and service discovery
aws ecs deployments: rolling and blue-green with codedeploy
aws eks cluster setup with eksctl or terraform
aws eks networking: vpc cni and pod ip management
aws eks ingress with the aws load balancer controller
aws eks node autoscaling with karpenter
aws eks gpu node groups for ai workloads
aws eks observability with container insights
aws ecr image management and vulnerability scanning
aws alb vs nlb for container workloads

# AWS Data Services
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Aurora, DynamoDB advanced, ElastiCache, S3 at scale
aws aurora postgresql: architecture, replicas and failover
aws aurora serverless v2 scaling
aws rds proxy and database connection management
aws dynamodb capacity modes: on-demand vs provisioned
aws dynamodb hot partition avoidance and adaptive capacity
aws dynamodb transactions and conditional writes
aws dynamodb global tables
aws dynamodb dax caching
aws elasticache redis cluster mode and failover
aws s3 performance: prefixes, multipart upload, transfer acceleration
aws s3 lifecycle policies, versioning and replication
aws opensearch service for search and vector search
aws redshift basics for analytics

# AWS Bedrock -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Bedrock models, knowledge bases, agents, guardrails, AgentCore runtime / gateway / memory
aws bedrock model catalog and model selection
aws bedrock converse api with tool use -i
aws bedrock knowledge bases: ingestion, chunking and retrieval -i
aws bedrock agents: action groups and orchestration
aws bedrock guardrails
aws bedrock prompt management and flows
aws bedrock model evaluation
aws bedrock provisioned throughput, cross-region inference and cost
aws bedrock fine-tuning and custom models
aws bedrock agentcore runtime for deploying agents -i
aws bedrock agentcore gateway and mcp tools
aws bedrock agentcore memory and identity
aws bedrock agentcore observability
aws reference architecture: serverless rag on bedrock

# Azure & GCP
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Azure OpenAI, Azure AI Foundry, Azure ML, Vertex AI
azure fundamentals: subscriptions, resource groups, entra id
azure app service and container apps
azure kubernetes service (aks) basics
azure openai service in practice -i
azure ai foundry
azure ai search for rag
azure functions
gcp fundamentals: projects and iam
gcp cloud run
gcp vertex ai and gemini
aws vs azure vs gcp service mapping

# Docker & Kubernetes -u
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Containers, Kubernetes, Helm, scaling
docker images, layers and dockerfile best practices -i
multi-stage docker builds
docker compose for local development -i
docker networking and volumes
kubernetes architecture: control plane and nodes
kubernetes pods, deployments and replicasets -i
kubernetes services and ingress -i
kubernetes configmaps and secrets
kubernetes resource requests, limits and qos
kubernetes autoscaling with hpa and keda
kubernetes health probes: liveness, readiness, startup
kubernetes statefulsets and persistent volumes
kubernetes rbac and namespaces
helm charts: templating and releases
kubernetes debugging with kubectl
kubernetes gpu scheduling basics

# Infrastructure as Code
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Terraform, CloudFormation, reusable modules
infrastructure as code principles
terraform basics: providers, resources and state -i
terraform variables, outputs and locals
terraform modules and reuse
terraform remote state and state locking
terraform workspaces and multi-environment setup
terraform plan and apply in ci/cd
aws cloudformation and cdk basics
policy as code with opa or sentinel
terraform drift detection and resource import

# CI/CD -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## GitHub Actions, Jenkins, release strategies, GitOps
ci/cd fundamentals and pipeline design
github actions workflows, jobs and runners -i
github actions reusable workflows and secrets
jenkins pipelines basics
ci build caching and pipeline speed optimization
deployment strategies: blue-green, canary, rolling -i
feature flags for safe releases
gitops with argocd
git branching strategies: trunk-based vs gitflow
artifact management and container registries
ci supply chain security: sbom and artifact signing
running database migrations in ci/cd

# Observability -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Logs, metrics, traces, OpenTelemetry, Datadog / Prometheus / Grafana
observability pillars: logs, metrics, traces -i
structured logging and log aggregation
metric types: counters, gauges, histograms
prometheus and promql
grafana dashboards
distributed tracing concepts
opentelemetry instrumentation -i
datadog apm basics
red and use monitoring methods
alerting design and avoiding alert fatigue
correlation ids across services

# Reliability & Incidents
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## SLOs, on-call, P1/P2 incidents, RCA, runbooks
site reliability engineering (sre) fundamentals
slis, slos and slas -i
sre error budgets
incident response process and roles
on-call practices
root cause analysis and blameless postmortems -i
runbooks and playbooks
chaos engineering basics
disaster recovery: rpo and rto
graceful degradation and load shedding
infrastructure capacity planning

# Cloud Architecture
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Networking, identity, environments, serverless, FinOps
cloud architecture fundamentals: regions and availability zones
cloud networking: vpc, subnets, nat, peering
dns and load balancing in the cloud
cloud identity federation and sso
multi-environment setup: dev, staging, prod
multi-account and landing zone strategy
serverless architecture patterns
finops fundamentals
cloud cost optimization techniques
gpu cost management for ai workloads
multi-cloud and hybrid cloud trade-offs

# AppSec -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## OWASP Top 10, secure coding, threat modeling
owasp top 10 web vulnerabilities -i
sql injection and prevention
xss and csrf prevention
ssrf attacks and prevention
secure coding practices
input validation and output encoding
threat modeling with stride
owasp api security top 10
security scanning: sast, dast and sca
security headers and cors configuration

# Identity & Access -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## OAuth2 / OIDC, JWT, SSO, RBAC / ABAC, multi-tenancy
authentication vs authorization fundamentals
oauth 2.0 flows: authorization code with pkce, client credentials -i
openid connect (oidc)
jwt structure, signing and validation -i
session-based vs token-based authentication
single sign-on with saml and oidc
rbac vs abac authorization
multi-tenant authorization design -i
service-to-service auth: api keys and mtls
okta and auth0 integration basics
authorization engines: opa, cedar, openfga

# Data Privacy
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Encryption, secrets (Vault), PII / PHI, HIPAA, GDPR, India DPDP
encryption at rest and in transit
tls fundamentals
key management with kms
secrets management with hashicorp vault
handling pii and phi data -i
data masking and tokenization
hipaa compliance for engineers
gdpr for engineers
india dpdp act for engineers
audit logging for compliance
data retention and deletion policies

# Testing -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Unit / integration / e2e, pytest, Jest, Cypress, testability, shift-left
testing pyramid and test strategy -i
unit testing best practices
mocking, stubbing and fakes
integration testing with testcontainers
api testing with supertest and pytest httpx
end-to-end testing strategy
test-driven development (tdd)
consumer-driven contract testing
property-based testing with hypothesis
testing async code
flaky tests: causes and fixes
code coverage and mutation testing
shift-left testing practices
test data management
performance and load testing in ci

# Code Review
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Coding standards, review practices, linting, monorepos, quality gates
clean code principles
code review best practices as a reviewer
code review best practices as an author
linting and formatting setup: eslint, prettier, ruff, biome
monorepo management with nx
advanced git: rebase, bisect, cherry-pick
writing good commit messages and pr descriptions
quality gates and definition of done
technical debt management in a team
code readability and naming
static analysis with sonarqube

# Debugging
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Tracing issues across services, root-causing, working in unfamiliar codebases
systematic debugging methodology -i
reading stack traces and logs effectively
debugging distributed systems with traces
debugging production issues safely
using debuggers: breakpoints, pdb, chrome devtools
debugging memory and cpu issues in production
ramping up quickly in an unfamiliar codebase -i
linux command line for debugging: ps, top, netstat, strace
network debugging with curl, dig and tcpdump
reproducing and isolating bugs

# Tech Leadership -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Technical vision, roadmaps, ADRs, tech debt, trade-off decisions
role of a staff / principal engineer
writing a technical vision
building a technical roadmap
architecture decision records (adrs) -i
making and communicating technical trade-offs -i
managing technical debt at the org level
technology evaluation and selection
aligning technical strategy with business goals
reversible vs irreversible technical decisions
running architecture reviews
setting engineering standards across teams
leading large cross-team technical initiatives -i

# Mentoring
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Coaching, design / code review as teaching, growing engineers to independence
mentor vs coach vs sponsor
running effective 1:1 mentoring sessions
giving actionable feedback to engineers
teaching through code reviews
teaching through design reviews
delegation and growing ownership in engineers
pair programming as mentoring
competency milestones and growth plans for engineers
onboarding new engineers effectively
building a learning culture in a team

# People Management
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Hiring, performance, career growth, team building
engineering manager role and responsibilities
hiring: writing job descriptions and designing interview loops
conducting technical interviews as an interviewer
performance reviews and calibration
handling underperformance
career ladders and promotions
team building and team topologies
running 1:1s as an engineering manager
motivation, engagement and retention of engineers
managing conflict in engineering teams
building psychological safety in teams

# Stakeholders
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Influence without authority, cross-team alignment, executive / client communication
stakeholder mapping and analysis
influence without authority -i
building cross-team alignment
managing up: working with your manager and executives
saying no and negotiating scope
managing client relationships -i
handling disagreements and escalations
communicating risks and trade-offs to executives
vendor and partner management
building trust with non-technical stakeholders

# Technical Writing
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Design docs, RFCs, documentation, presenting, storytelling
writing technical design documents -i
writing rfcs
writing for executives: bluf and one-pagers
technical documentation: readmes, runbooks, guides
explaining technical concepts to non-technical audiences -i
presenting technical work and live demos -i
storytelling with data
architecture diagramming with the c4 model
structuring a technical argument
async written communication on slack and email

# Delivery
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Agile / SAFe, scoping, estimation, risks & dependencies, breaking work into increments
agile and scrum fundamentals
kanban for engineering teams
safe (scaled agile framework) overview
breaking projects into milestones and increments
software estimation techniques
risk management and raid logs
managing cross-team dependencies
running effective meetings and agile ceremonies
project status reporting
delivering under ambiguity and changing requirements -i

# Engineering Excellence
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Standards adoption, RACI, change management, delivery metrics (DORA)
dora metrics
space framework for developer productivity
change management models: adkar and kotter
driving adoption of engineering standards
raci models
engineering governance without bureaucracy
early warning signals and rag status reporting
developer experience (devex) improvement
inner source and reuse across teams
running engineering communities of practice

# Behavioral -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## STAR stories, conflict, failure, ownership, ambiguity
star method for behavioral answers -u
building a story bank from your experience -ui
behavioral story: conflict with a peer or manager -ui
behavioral story: failure and learning -ui
behavioral story: leading without authority -i
behavioral story: handling ambiguity -ui
behavioral story: biggest technical achievement -ui
behavioral story: mentoring and growing others -i
behavioral story: disagree and commit -i
behavioral story: tight deadlines and prioritization -i
answering why this company and why this role -u
mapping stories to amazon leadership principles

# Product Thinking -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Problem framing, user pain points, user value
product thinking for engineers -i
problem framing and jobs to be done -i
user research and user interview basics
identifying pain points by observing workflows -i
value vs effort assessment
product-market fit basics
defining an mvp
design thinking basics
competitive analysis basics
product sense interview practice

# Requirements
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## User stories, acceptance criteria, PRDs, success metrics
writing user stories with invest
writing acceptance criteria in given-when-then
writing a prd
defining success metrics and kpis -i
gathering non-functional requirements
translating business requirements into technical specs -i
writing technical specs from prds
requirements-to-test traceability
use case and edge case discovery
defining quality bars for ai features -i

# Roadmapping
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Backlog management, prioritization frameworks, roadmaps
prioritization frameworks: rice, moscow, kano
backlog management and refinement
building a product roadmap
now-next-later roadmaps
okrs and aligning roadmaps to goals
balancing tech debt vs feature work
cost of delay and wsjf
opportunity sizing
saying no to feature requests
communicating roadmap changes

# Prototype to Production -i
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## PoC, MVP, hardening, iterating on real usage
rapid prototyping approach for engineers -i
building a poc in a day with ai coding tools -u
ai prototypes with streamlit or gradio
validating prototypes with real users
hardening a prototype for production: checklist -i
production readiness review
iterating on a product from usage data
deciding when to throw away a prototype
building demo environments and sandboxes
cutting mvp scope

# Forward-Deployed Engineering
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Client discovery, demos, deploying into client environments, enablement & adoption
forward deployed engineer role and expectations -i
running customer discovery calls -i
technical discovery and solution design with customers -ui
building customer demos and pocs -i
deploying into customer environments: on-prem and private vpc -i
navigating client security reviews
enablement: training end users on a new system
driving adoption after deployment
turning customer feedback into product improvements
handling customer escalations
consulting skills: structuring problems with mece -i

# AI ROI
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Telemetry, adoption, value dashboards, measuring AI impact
product metrics fundamentals: north star and input metrics
funnel and retention metrics
product analytics instrumentation with posthog or amplitude
measuring ai feature quality in production
measuring roi of ai initiatives -i
engineering telemetry dashboards: cycle time and throughput
executive value dashboards
unit economics and cost per task for ai features
cohort analysis basics
adoption metrics for internal tools

# Internal Platforms
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Tools and platforms others extend, low-code / template systems, developer platforms
platform engineering fundamentals
internal developer platforms with backstage
designing extensible systems with plugins
template and low-code systems for non-engineers
turning one-off scripts into reusable tools
building cli tools
internal tools with retool or streamlit
platform as a product mindset
platform adoption and documentation
api-first platform design

# Public Presence
deadline: 2026-12-01
stages: ["To do", "Worked out", "In review", "Done"]
## Open-source contributions, portfolio projects, technical blogging, talks
building a portfolio of ai projects on github -ui
writing a strong github readme -u
open source contribution workflow
finding good first issues in ai frameworks
publishing technical blog posts
linkedin profile optimization for senior roles -u
resume writing for senior engineers -ui
giving conference talks and meetup presentations
building in public
crafting a personal brand narrative
