# Subtopics

## 1. Python for production systems
python data model and dunder methods #python
python iterators, generators and yield from #python -i
python decorators with functools.wraps and parameterized decorators #python -i
python context managers and contextlib #python
python type hints, generics and protocols #python -i
python strict type checking with mypy or pyright #python
python dataclasses vs pydantic models #python
pydantic v2 validation and settings management #python -i
python asyncio event loop, coroutines and tasks #python -ui
python asyncio gather, taskgroups and cancellation #python -i
python gil: threading vs multiprocessing vs asyncio #python -ui
python memory management and garbage collection #python
python performance profiling with cprofile and py-spy #python
python packaging with pyproject.toml and uv #python -u
python dependency management and virtual environments with uv or poetry #python
python logging configuration and structured logging #python
fastapi routing, dependency injection and request validation #python -ui
fastapi async endpoints, background tasks and lifespan events #python -i
fastapi middleware, error handling and openapi docs #python
django orm models, querysets and n+1 query avoidance #python

## 2. TypeScript, JavaScript & Node.js
javascript closures, scope and hoisting #typescript -i
javascript prototypes and this binding #typescript
javascript promises and async/await error handling #typescript -i
javascript event loop: microtasks vs macrotasks #typescript -ui
typescript unions, intersections and type narrowing #typescript -i
typescript generics and constraints #typescript -i
typescript utility types and mapped types #typescript
typescript conditional types and infer #typescript
typescript tsconfig strict mode and module resolution #typescript
esm vs commonjs modules in node.js #typescript
node.js event loop phases and libuv #typescript -i
node.js streams and backpressure #typescript
node.js worker threads and cluster module #typescript
node.js error handling and graceful shutdown #typescript
node.js memory leak diagnosis with heap snapshots #typescript
express middleware pipeline and error handlers #typescript
nestjs modules, providers and dependency injection #typescript
nestjs guards, interceptors and pipes #typescript

## 3. Java & Spring Boot
java collections internals: hashmap, arraylist, treemap #java
java generics and type erasure #java
java streams api and functional interfaces #java
java records, sealed classes and pattern matching #java
java exception handling best practices #java
jvm memory model: heap, stack and metaspace #java
jvm garbage collectors: g1 and zgc tuning basics #java
java concurrency with executorservice and completablefuture #java
java virtual threads (project loom) #java
spring boot auto-configuration and starters #java
spring dependency injection and bean lifecycle #java
spring boot rest controllers and request validation #java
spring data jpa and hibernate entity mapping #java
hibernate n+1 problem, lazy loading and fetch strategies #java
spring transaction management with @transactional #java
spring boot actuator, profiles and externalized config #java
spring security filter chain basics #java
junit 5 and mockito testing in spring boot #java

## 4. A systems language: Go or Rust
go syntax, types and structs #go-rust
go interfaces and composition #go-rust
go error handling patterns #go-rust
go goroutines and channels #go-rust
go select, context cancellation and timeouts #go-rust
go sync package: mutex, waitgroup, once #go-rust
go modules and project layout #go-rust
go net/http server and middleware #go-rust
go testing and benchmarking #go-rust
go profiling with pprof #go-rust
rust ownership, borrowing and lifetimes basics #go-rust
when to choose go or rust over python for a service #go-rust

## 5. Concurrency & parallelism
concurrency vs parallelism fundamentals #concurrency
race conditions and critical sections #concurrency -i
mutexes, semaphores and condition variables #concurrency
deadlocks: causes, detection and prevention #concurrency -i
atomic operations, compare-and-swap and lock-free programming #concurrency
producer-consumer problem with bounded queues #concurrency -i
thread pool sizing for cpu-bound vs io-bound work #concurrency
async io and the event-driven concurrency model #concurrency
actor model concurrency #concurrency
reader-writer locks and starvation #concurrency
debugging and testing concurrency bugs #concurrency
classic concurrency interview problems: dining philosophers, print in order #concurrency
thread-safe token bucket rate limiter implementation #concurrency

## 6. OOP, SOLID & design patterns
oop pillars: encapsulation, abstraction, inheritance, polymorphism #design-patterns -u
composition over inheritance #design-patterns
solid: single responsibility and open-closed principles #design-patterns -ui
solid: liskov substitution, interface segregation, dependency inversion #design-patterns -ui
factory method and abstract factory design patterns #design-patterns -ui
builder design pattern #design-patterns
singleton design pattern and its pitfalls #design-patterns
adapter and facade design patterns #design-patterns
decorator design pattern #design-patterns
proxy design pattern #design-patterns
composite design pattern #design-patterns
strategy design pattern #design-patterns -ui
observer design pattern #design-patterns -ui
command design pattern #design-patterns
state design pattern #design-patterns
template method and chain of responsibility design patterns #design-patterns
dependency injection and inversion of control #design-patterns -i
design anti-patterns: god object, anemic domain model, premature abstraction #design-patterns

## 7. Low-level design (LLD)
low-level design interview approach and framework #lld -i
uml class diagrams and sequence diagrams for lld #lld
lld: parking lot system #lld
lld: elevator system #lld
lld: rate limiter #lld -i
lld: lru cache #lld -i
lld: library management system #lld
lld: splitwise expense sharing #lld
lld: chess game #lld
lld: vending machine with state pattern #lld
lld: notification service #lld
lld: in-memory key-value store with ttl #lld
lld: logging framework #lld
lld: movie ticket booking with concurrent seat locking #lld
lld: in-memory pub-sub message queue #lld
lld: snake and ladder game #lld

## 8. Data structures
big-o time and space complexity analysis #data-structures -u
arrays and dynamic arrays #data-structures -u
string manipulation techniques for interviews #data-structures -i
hash maps and hash sets: hashing and collisions #data-structures -ui
linked lists: singly, doubly, fast and slow pointers #data-structures -i
stacks and monotonic stack #data-structures -i
queues, deques and monotonic queue #data-structures
binary trees and tree traversals #data-structures -ui
binary search tree operations #data-structures
heaps and priority queues #data-structures -ui
tries (prefix trees) #data-structures
graph representation: adjacency list and matrix #data-structures -u
union-find (disjoint set union) #data-structures
segment trees and fenwick trees #data-structures
balanced trees intuition: avl and red-black trees #data-structures
bit manipulation basics #data-structures

## 9. Algorithms & problem-solving patterns
two pointers pattern #algorithms -ui
sliding window pattern #algorithms -ui
prefix sums and difference arrays #algorithms -i
binary search on sorted arrays #algorithms -ui
binary search on answer space #algorithms
sorting algorithms: merge sort, quick sort, counting sort #algorithms
recursion fundamentals #algorithms -u
backtracking: permutations, combinations, subsets #algorithms -ui
bfs on graphs and grids #algorithms -ui
dfs on graphs and grids #algorithms -ui
topological sort #algorithms -i
shortest paths: dijkstra and bellman-ford #algorithms
minimum spanning tree: kruskal and prim #algorithms
dynamic programming: 1d problems #algorithms -ui
dynamic programming: 2d and grid problems #algorithms -i
dynamic programming on subsequences: lcs, lis, knapsack #algorithms
dynamic programming on intervals and trees #algorithms
greedy algorithms and interval scheduling #algorithms -i
top-k and k-way merge with heaps #algorithms -ui
intervals pattern: merge, insert, overlap #algorithms -i

## 10. System design fundamentals
system design interview framework: requirements, estimates, api, data model, deep dives #system-design -ui
back-of-the-envelope capacity estimation #system-design -i
vertical vs horizontal scaling #system-design
load balancers: l4 vs l7 and balancing algorithms #system-design -i
reverse proxy and api gateway roles #system-design
caching strategies: cache-aside, write-through, write-back #system-design -ui
cache invalidation and eviction policies #system-design -i
cdn and edge caching #system-design
database replication: leader-follower and multi-leader #system-design -i
database sharding and partitioning strategies #system-design -ui
consistent hashing #system-design -i
sql vs nosql selection trade-offs #system-design -ui
rate limiting algorithms: token bucket, leaky bucket, sliding window #system-design -i
blob and object storage design #system-design
stateless services and session management #system-design
high availability and failover design #system-design -i
unique id generation: snowflake, uuid, ulid #system-design

## 11. Distributed systems
cap theorem and pacelc #distributed-systems -i
consistency models: strong, eventual, causal, read-your-writes #distributed-systems -i
replication and quorum reads/writes #distributed-systems
raft consensus algorithm #distributed-systems
leader election in distributed systems #distributed-systems
logical clocks: lamport and vector clocks #distributed-systems
idempotency and idempotency keys #distributed-systems -i
exactly-once vs at-least-once delivery semantics #distributed-systems
two-phase commit for distributed transactions #distributed-systems
saga pattern: choreography vs orchestration #distributed-systems
distributed locking with redis and zookeeper #distributed-systems
failure detection, heartbeats and gossip protocols #distributed-systems
split brain and fencing tokens #distributed-systems
retries with exponential backoff and jitter #distributed-systems -i
designing for partial failure #distributed-systems

## 12. Microservices architecture
monolith vs microservices trade-offs #microservices
identifying service boundaries with bounded contexts #microservices
synchronous vs asynchronous inter-service communication #microservices
service discovery and service registry #microservices
api gateway pattern for microservices #microservices
circuit breaker, bulkhead and timeout patterns #microservices -i
database per service and data ownership #microservices
data consistency across microservices #microservices
service mesh basics: istio, linkerd and sidecars #microservices
microservices observability and correlation ids #microservices
strangler fig pattern for monolith migration #microservices
contract testing between microservices with pact #microservices
microservices deployment and versioning strategies #microservices

## 13. Event-driven architecture & messaging
event-driven architecture fundamentals: events, commands, notifications #event-driven
message queues vs event streams #event-driven -i
kafka architecture: brokers, topics, partitions, replication #event-driven
kafka producers: acks, idempotence and batching #event-driven
kafka consumer groups, offsets and rebalancing #event-driven
kafka ordering guarantees and partition keys #event-driven
kafka exactly-once semantics and transactions #event-driven
rabbitmq exchanges, queues and routing #event-driven
aws sqs, sns and eventbridge messaging patterns #event-driven
dead letter queues and poison message handling #event-driven
transactional outbox pattern #event-driven
change data capture with debezium #event-driven
event sourcing fundamentals #event-driven
cqrs pattern #event-driven
schema evolution with avro and schema registry #event-driven
backpressure and consumer lag management #event-driven

## 14. API design & integration
rest api design principles and resource modeling #api-design -ui
http methods, status codes and idempotency #api-design -i
api pagination: offset vs cursor #api-design -i
api versioning strategies #api-design
api error response design with rfc 7807 problem details #api-design
spec-first api design with openapi/swagger #api-design
graphql schema design, resolvers and dataloader for n+1 #api-design
grpc and protocol buffers #api-design
webhook design: delivery, retries and signatures #api-design -ui
api gateway configuration: auth, throttling, routing (apigee, aws api gateway) #api-design
backend-for-frontend (bff) pattern #api-design
third-party api integration: rate limits, retries and sync strategies #api-design -i
salesforce rest api and platform events integration basics #api-design
slack app and bot integration basics #api-design
jira api integration and automation #api-design
api documentation and developer experience #api-design

## 15. Architecture styles & domain-driven design
layered architecture #ddd
hexagonal architecture (ports and adapters) #ddd
clean architecture #ddd
modular monolith design #ddd
ddd strategic design: bounded contexts and context mapping #ddd
ddd ubiquitous language #ddd
ddd tactical patterns: entities, value objects, aggregates #ddd
ddd domain events and repositories #ddd
anti-corruption layer pattern #ddd
serverless architecture style trade-offs #ddd
architecture characteristics and non-functional requirements analysis #ddd
evolutionary architecture and fitness functions #ddd

## 16. Performance engineering & caching
performance fundamentals: latency, throughput, percentiles #performance
latency budgets and tail latency (p99) #performance
cpu profiling and flame graphs #performance
memory profiling and leak detection #performance
database query profiling with explain analyze #performance
redis data structures and use cases #performance
redis caching patterns and ttl design #performance -i
redis persistence, eviction and clustering #performance
connection pooling for databases and http clients #performance
load testing with k6 or locust #performance
performance tuning against slos #performance
http performance: keep-alive, compression, http/2 #performance
async processing and batching to improve throughput #performance

## 17. Durable workflows & background processing
background jobs and task queue fundamentals #durable-workflows
celery task queue with redis or rabbitmq #durable-workflows
bullmq job queues in node.js #durable-workflows
cron scheduling and distributed schedulers #durable-workflows
retry policies and idempotent job design #durable-workflows
temporal workflows and activities basics #durable-workflows
temporal durable execution for long-running ai agents #durable-workflows -i
aws step functions state machines #durable-workflows
workflow orchestration vs choreography #durable-workflows
long-running job progress tracking and resumability #durable-workflows

## 18. Classic system design case studies
system design: url shortener #sd-case-studies -i
system design: rate limiter service #sd-case-studies -ui
system design: chat application like whatsapp #sd-case-studies -ui
system design: news feed like twitter or instagram #sd-case-studies -i
system design: notification system #sd-case-studies -ui
system design: payment system #sd-case-studies -i
system design: ride hailing like uber #sd-case-studies
system design: video streaming like youtube or netflix #sd-case-studies
system design: distributed key-value store #sd-case-studies
system design: search autocomplete / typeahead #sd-case-studies
system design: web crawler #sd-case-studies
system design: file storage and sync like dropbox #sd-case-studies
system design: ticket booking with high contention #sd-case-studies
system design: distributed job scheduler #sd-case-studies -i
system design: metrics and logging platform #sd-case-studies
system design: e-commerce order management #sd-case-studies
system design: collaborative document editing like google docs #sd-case-studies
system design: real-time leaderboard #sd-case-studies

## 19. GenAI & agentic system design case studies
genai system design interview framework #genai-system-design -ui
ai system design: enterprise rag knowledge assistant #genai-system-design -ui
ai system design: customer support agent with human escalation #genai-system-design -ui
ai system design: coding assistant / copilot #genai-system-design -i
ai system design: multi-agent research system #genai-system-design -i
ai system design: llm gateway with routing, rate limits and fallbacks #genai-system-design -ui
ai system design: document extraction pipeline at scale #genai-system-design -ui
ai system design: semantic search for e-commerce #genai-system-design
ai system design: ai-powered recommendation system #genai-system-design
ai system design: realtime voice agent #genai-system-design
ai system design: agentic sdlc platform with human approval gates #genai-system-design
ai system design: multi-tenant llm saas platform #genai-system-design -i
ai system design: evaluation and observability platform for llm apps #genai-system-design -i
ai system design: text-to-sql analytics assistant #genai-system-design -i
ai system design: aiops agent for cloud incident remediation #genai-system-design

## Scaling architecture patterns (advanced)
scaling a web app from zero to a million users step by step #scaling -i
read-heavy vs write-heavy scaling strategies #scaling
read/write splitting and handling replication lag in the app #scaling
hot keys and hot partitions mitigation #scaling
thundering herd and cache stampede prevention #scaling
request coalescing and cache warming #scaling
queue-based load leveling #scaling
autoscaling strategies: reactive, scheduled, predictive #scaling
multi-region architecture: active-passive vs active-active #scaling
global traffic routing with geo-dns and anycast #scaling
cell-based architecture and blast radius reduction #scaling
shuffle sharding #scaling
data locality and geo-partitioning #scaling
scaling stateful services #scaling
backpressure and admission control at scale #scaling
fan-out on write vs fan-out on read #scaling
real-world scaling case studies: discord, slack, netflix #scaling

## 20. Relational databases & SQL
sql joins: inner, outer, self, cross #sql
sql aggregations, group by and having #sql
sql window functions #sql -i
sql ctes and recursive queries #sql
sql subqueries vs joins performance #sql
database normalization and denormalization #sql
postgresql index types: b-tree, hash, gin, gist #sql -i
composite indexes and index selectivity #sql -i
reading postgresql query plans with explain analyze #sql -ui
acid properties of transactions #sql
transaction isolation levels and read anomalies #sql -ui
mvcc in postgresql #sql -i
row locks, deadlocks and select for update in postgresql #sql
postgresql jsonb usage and indexing #sql
postgresql table partitioning #sql
zero-downtime database migrations and schema changes #sql -i
postgresql replication and read replicas #sql
sql interview problems practice #sql -ui

## 21. NoSQL databases
nosql database types and when to use each #nosql -i
mongodb document modeling: embedding vs referencing #nosql
mongodb indexes and query optimization #nosql
mongodb aggregation pipeline #nosql
mongodb transactions and consistency #nosql
mongodb replica sets and sharding #nosql
dynamodb partition key and sort key design #nosql
dynamodb single-table design #nosql
dynamodb gsi, lsi and access patterns #nosql
dynamodb streams and ttl #nosql
cassandra data model and write path basics #nosql
redis as a primary datastore: use cases and limits #nosql

## 22. Data engineering & pipeline orchestration
etl vs elt #data-engineering
batch vs streaming data pipelines #data-engineering
dimensional modeling and star schema for analytics #data-engineering
airflow dags, operators and scheduling #data-engineering
airflow sensors, xcom and task dependencies #data-engineering
airflow deployment on kubernetes (eks) #data-engineering
prefect flows and tasks #data-engineering
data quality checks with great expectations #data-engineering
data lineage and metadata management #data-engineering
incremental loads and idempotent data pipelines #data-engineering
slowly changing dimensions #data-engineering
dbt models and transformations #data-engineering

## 23. Big data & lakehouse
spark architecture: driver, executors and dag #big-data
pyspark dataframes api #big-data
spark transformations, actions and lazy evaluation #big-data
spark shuffles, partitioning and join optimization #big-data
spark structured streaming #big-data
databricks workspace, clusters and jobs #big-data
delta lake: acid tables and time travel #big-data
medallion architecture: bronze, silver, gold layers #big-data
parquet columnar format and file sizing #big-data
snowflake architecture and virtual warehouses #big-data
dask for parallel python processing #big-data
lakehouse vs data warehouse vs data lake #big-data
apache flink stream processing basics #big-data

## 24. Search & information retrieval
inverted index fundamentals #search
tf-idf and bm25 ranking #search -i
text analysis: tokenizers, stemming and analyzers #search
elasticsearch architecture: indexes, shards, replicas #search
elasticsearch mappings and query dsl #search
elasticsearch aggregations #search
search relevance tuning and boosting #search
search evaluation metrics: precision, recall, mrr, ndcg #search
autocomplete and fuzzy search #search
vector knn search in elasticsearch / opensearch #search

## Advanced database internals & performance
database storage engines: b-tree vs lsm-tree #db-internals
write-ahead logging (wal) and crash recovery #db-internals
postgresql shared buffers and buffer cache tuning #db-internals
postgresql query planner internals and statistics #db-internals
database join algorithms: nested loop, hash join, merge join #db-internals
postgresql vacuum, autovacuum and table bloat #db-internals
postgresql covering, partial and index-only scans #db-internals
postgresql expression indexes and index maintenance cost #db-internals
postgresql advisory locks and lock contention analysis #db-internals
serializable snapshot isolation and write skew #db-internals
postgresql config tuning: work_mem, effective_cache_size, checkpoints #db-internals
slow query analysis with pg_stat_statements #db-internals
mysql innodb internals: clustered indexes and undo logs #db-internals
database deadlock analysis in production #db-internals
optimistic vs pessimistic concurrency control in databases #db-internals
materialized views and query result caching #db-internals

## Database scaling & high availability
database connection pooling with pgbouncer and rds proxy #db-scaling
read replicas and replication lag management #db-scaling
synchronous vs asynchronous database replication trade-offs #db-scaling
database failover and high availability with patroni or aurora #db-scaling
horizontal database sharding: shard keys, routing and resharding #db-scaling -i
sharding postgresql with citus #db-scaling
sharding mysql with vitess #db-scaling
distributed sql databases: cockroachdb, yugabytedb, spanner #db-scaling
aurora architecture: separated storage and global database #db-scaling
multi-region database design and conflict resolution #db-scaling
online schema migrations at scale with gh-ost and pg_repack #db-scaling
database backups, point-in-time recovery and restore testing #db-scaling
database capacity planning and vertical scaling limits #db-scaling
cqrs read models for scaling database reads #db-scaling
archiving and tiering cold data #db-scaling

## 25. React & Next.js
react rendering and reconciliation #react -i
react hooks: usestate, useeffect, useref #react -ui
react memoization with usememo, usecallback and memo #react -i
writing custom react hooks #react -i
react context and avoiding prop drilling #react
state management with redux toolkit #react
server state management with tanstack query #react -i
react forms and validation with react hook form and zod #react
react router and nested routing #react
react suspense and error boundaries #react
react concurrent features and transitions #react
react 19 features: actions, use() hook and react compiler #react
next.js app router and layouts #react -ui
react server components and server actions #react -ui
next.js data fetching, caching and revalidation #react -i
next.js rendering modes: ssr vs ssg vs isr #react -i
next.js route handlers and middleware #react

## 26. Angular
angular standalone components and application bootstrapping #angular
angular templates, data binding and built-in control flow (@if, @for) #angular
angular dependency injection and services #angular
angular signals and computed state #angular
angular change detection: default, onpush and zoneless #angular
rxjs observables, subjects and core operators #angular
rxjs higher-order mapping: switchmap, mergemap, concatmap, exhaustmap #angular
angular router: lazy loading, guards and resolvers #angular
angular reactive forms and validation #angular
angular httpclient and interceptors #angular
angular state management with ngrx store and signal store #angular
angular component communication: inputs, outputs and models #angular
angular performance: deferrable views, track and ssr hydration #angular
angular testing with testbed and jest #angular
angular cli workspaces and nx monorepo setup #angular
migrating angularjs to modern angular #angular

## 27. Vue.js & Nuxt
vue 3 composition api and reactivity: ref, reactive, computed #vue
vue single-file components and template syntax #vue
vue component props, emits and slots #vue
vue watchers and lifecycle hooks #vue
vue composables for reusable logic #vue
vue router basics #vue
vue state management with pinia #vue
nuxt 3 file-based routing and rendering modes #vue
nuxt data fetching and server routes #vue
vue vs react vs angular trade-offs #vue

## 28. React Native
react native architecture: new architecture, fabric and turbomodules #react-native
react native core components and styling #react-native
expo setup and development workflow #react-native
react navigation in react native #react-native
react native state management and data fetching #react-native
react native list performance with flatlist and flashlist #react-native
react native native modules and platform-specific code #react-native
react native offline storage and sync #react-native
push notifications in react native #react-native
react native builds and releases with eas #react-native
react native testing with jest and detox #react-native

## 29. Modern full-stack TypeScript stack
full-stack typescript monorepo with shared types #ts-fullstack
end-to-end type safety with trpc #ts-fullstack
zod schema validation shared across client and server #ts-fullstack -i
prisma orm: schema, migrations and queries #ts-fullstack
drizzle orm basics #ts-fullstack
authentication in full-stack apps with auth.js (nextauth) or clerk #ts-fullstack
file uploads to object storage from a full-stack app #ts-fullstack
background jobs and cron in full-stack typescript apps #ts-fullstack
deploying full-stack apps on vercel and serverless platforms #ts-fullstack
edge runtime and edge functions trade-offs #ts-fullstack
turborepo monorepo setup for full-stack apps #ts-fullstack
bun runtime for full-stack typescript #ts-fullstack

## 30. Frontend engineering at scale
web performance and core web vitals #frontend
code splitting and lazy loading #frontend
bundlers: vite, webpack and tree shaking #frontend
react rendering performance with react profiler #frontend
virtualized lists for large datasets #frontend
frontend unit testing with jest and react testing library #frontend
frontend end-to-end testing with playwright or cypress #frontend
web accessibility: aria, keyboard navigation, screen readers #frontend
design systems and component libraries #frontend
css architecture: css modules, tailwind, css-in-js #frontend
frontend monorepos with nx or turborepo #frontend
browser critical rendering path #frontend
frontend error tracking and monitoring with sentry #frontend
content security policy for frontend apps #frontend

## 31. Real-time & streaming web
http polling vs long polling vs sse vs websockets #realtime-web -i
server-sent events implementation #realtime-web
websocket server and client implementation #realtime-web
scaling websockets with redis pub/sub #realtime-web
streaming llm tokens to the browser #realtime-web -i
streaming http responses in fastapi #realtime-web
socket.io rooms and namespaces #realtime-web
webrtc basics for audio and video #realtime-web
realtime presence and collaborative sync with crdt basics #realtime-web
handling reconnects, ordering and backpressure in realtime apps #realtime-web

## 32. UX & interfaces for AI products
ux patterns for chat and copilot interfaces #ai-ux
streaming ui states: loading, partial, error #ai-ux
showing agent reasoning, steps and tool calls to users #ai-ux -i
displaying confidence, citations and sources in ai ui #ai-ux
designing approval queues and decision inboxes for agents #ai-ux
avoiding approval fatigue in human-in-the-loop ui #ai-ux
undo, edit and regenerate patterns in ai ux #ai-ux
capturing user feedback on ai output: ratings and corrections #ai-ux
generative ui: rendering structured llm output as components #ai-ux
building chat ui with vercel ai sdk #ai-ux
trust and transparency in ai product design #ai-ux

## 33. Full-stack AI application development
full-stack ai app architecture: frontend, api, llm and vector store #ai-fullstack -ui
streaming chat endpoint from fastapi to a react frontend #ai-fullstack -ui
streaming chat endpoint from nestjs to an angular frontend #ai-fullstack
next.js ai chatbot with server actions and streaming #ai-fullstack -i
building a rag web app end to end with next.js and pgvector #ai-fullstack -ui
persisting chat history and threads in a database #ai-fullstack -i
document upload to rag ingestion flow in a web app #ai-fullstack -i
rendering llm tool calls and agent steps in a web ui #ai-fullstack
auth, multi-tenancy and per-user data isolation in ai apps #ai-fullstack -i
per-user rate limiting and usage quotas for llm features #ai-fullstack
cost tracking and usage-based billing for ai features #ai-fullstack
long-running ai tasks with background jobs and progress ui #ai-fullstack
deploying a dockerized ai web app to the cloud #ai-fullstack -u
adding ai copilots to existing enterprise crud apps #ai-fullstack -i

## 34. AI SDKs for TypeScript & Java
vercel ai sdk core: generatetext, streamtext, generateobject #ai-sdks -i
vercel ai sdk ui hooks: usechat and usecompletion #ai-sdks
vercel ai sdk tool calling and agents #ai-sdks
langchain.js basics #ai-sdks
langgraph.js agents #ai-sdks
mastra typescript agent framework #ai-sdks
openai and anthropic typescript sdks #ai-sdks
mcp clients and servers inside typescript apps #ai-sdks
spring ai chat client, prompts and structured output #ai-sdks
spring ai rag with vector stores #ai-sdks
spring ai tool calling and mcp #ai-sdks
langchain4j basics for java #ai-sdks

## 35. LLM foundations
neural network basics for understanding llms #llm-foundations
transformer architecture overview #llm-foundations -u
self-attention and multi-head attention #llm-foundations -i
tokenization: bpe and token counting #llm-foundations -u
embeddings and vector representations of text #llm-foundations -u
positional encoding and context windows #llm-foundations
llm training stages: pretraining, instruction tuning, rlhf #llm-foundations
llm decoding: temperature, top-p, top-k #llm-foundations -u
reasoning models and test-time compute #llm-foundations -i
mixture of experts llm architecture #llm-foundations
kv cache and how llm inference works #llm-foundations -i
llm hallucinations: causes and mitigation #llm-foundations -ui
llm limitations: knowledge cutoff, math, long-context degradation #llm-foundations -i
llm scaling laws basics #llm-foundations
llm model landscape: gpt, claude, gemini, llama, mistral, qwen, deepseek #llm-foundations

## 36. Foundation model APIs & model selection
openai responses and chat completions api basics #model-apis -i
anthropic claude messages api basics #model-apis -i
aws bedrock model invocation and converse api #model-apis
azure openai deployments and api usage #model-apis
google vertex ai gemini api #model-apis
hugging face hub, transformers library and inference endpoints #model-apis
streaming responses from llm apis #model-apis
llm api rate limits, retries and error handling #model-apis
prompt caching in llm apis #model-apis
batch apis for offline llm workloads #model-apis
llm model selection criteria: accuracy, latency, cost, context length #model-apis -i
open-source vs proprietary llm trade-offs #model-apis -i
small language models (phi, gemma) and their use cases #model-apis
running local llms with ollama #model-apis
llm provider abstraction with litellm #model-apis
build vs buy for ai capabilities #model-apis

## 37. Prompt & context engineering
prompt anatomy: system, user and assistant roles #prompting
zero-shot vs few-shot prompting #prompting
chain-of-thought prompting #prompting
prompt templates and variables #prompting
designing system prompts: role, instructions, constraints #prompting -i
structuring prompts with xml tags and markdown #prompting
prompt chaining and task decomposition #prompting -i
context engineering fundamentals #prompting -ui
context window budgeting and prioritization #prompting -i
context compaction and summarization for long sessions #prompting -i
context pruning and relevant context selection #prompting
long-context vs rag trade-offs #prompting -ui
prompt versioning and management #prompting -i
prompt testing and iteration workflow #prompting
prompt optimization with dspy #prompting

## 38. Structured outputs & tool calling
llm json mode vs schema-enforced structured outputs #tool-calling -ui
pydantic models for llm structured output #tool-calling -i
structured extraction with the instructor library #tool-calling
llm tool/function calling fundamentals #tool-calling -ui
designing llm tool schemas and descriptions #tool-calling -i
parallel tool calls in llm apis #tool-calling
llm tool call error handling and retries #tool-calling -i
validating and repairing malformed llm output #tool-calling -i
constrained decoding with outlines and grammars #tool-calling
tool calling differences across openai, anthropic and bedrock #tool-calling

## 39. RAG foundations
rag architecture end to end #rag -ui
document loading and preprocessing for rag #rag
rag chunking strategies: fixed, recursive, semantic #rag -ui
rag chunk size and overlap tuning #rag
embedding model selection for rag #rag -i
generating embeddings with openai and sentence-transformers #rag -u
langchain embedding generation and vector store integration #rag
llamaindex ingestion pipeline and query engine basics #rag
building a rag pipeline from scratch without frameworks #rag -ui
prompting for grounded answers with citations #rag -i
rag failure modes and debugging #rag -ui
incremental indexing and re-indexing documents for rag #rag -i

## 40. Advanced retrieval
hybrid search: bm25 plus vector with reciprocal rank fusion #advanced-rag -ui
reranking with cross-encoders (cohere rerank, bge reranker) #advanced-rag -ui
query rewriting and query expansion for rag #advanced-rag -i
hyde: hypothetical document embeddings #advanced-rag
multi-query retrieval #advanced-rag
metadata filtering in vector search #advanced-rag -i
permission-aware retrieval with document acls #advanced-rag -i
parent-child and small-to-big retrieval #advanced-rag
contextual retrieval and contextual chunk headers #advanced-rag -i
agentic rag and iterative retrieval #advanced-rag -ui
corrective rag and self-rag #advanced-rag
multi-hop retrieval for complex questions #advanced-rag
rag response validation and groundedness checks #advanced-rag -i
retrieval over tables and structured data #advanced-rag
text-to-sql as a retrieval strategy #advanced-rag -i

## 41. Vector databases & embedding strategies
vector similarity metrics: cosine, dot product, euclidean #vector-db -i
ann vector search with hnsw #vector-db -i
ann vector search with ivf and product quantization #vector-db
pgvector setup and indexing in postgresql #vector-db -i
pinecone indexes and namespaces #vector-db
weaviate schema and hybrid search #vector-db
milvus architecture basics #vector-db
faiss for local vector search #vector-db
chroma for rag prototyping #vector-db
mongodb atlas vector search #vector-db
vector database selection criteria and benchmarking #vector-db
embedding dimensionality, matryoshka embeddings and quantization #vector-db
multi-tenancy in vector databases #vector-db

## 42. Knowledge graphs & GraphRAG
knowledge graph fundamentals: entities, relations, ontologies #graphrag
neo4j and cypher query basics #graphrag
building knowledge graphs from text with llms #graphrag
microsoft graphrag approach #graphrag -i
hybrid graph + vector retrieval #graphrag
entity resolution and entity linking #graphrag
multi-hop question answering over knowledge graphs #graphrag
lightrag and lightweight graphrag alternatives #graphrag
text-to-cypher query generation with llms #graphrag
maintaining and updating knowledge graphs #graphrag

## 43. Document AI & unstructured data ingestion
pdf parsing with pymupdf and pdfplumber #document-ai
layout-aware document parsing with unstructured, docling or llamaparse #document-ai -i
ocr with tesseract and cloud ocr (textract, azure document intelligence) #document-ai
table extraction from pdfs and documents #document-ai
vision llms for document understanding #document-ai
llm-based structured information extraction #document-ai -i
llm document classification pipelines #document-ai
llm summarization strategies: map-reduce and refine #document-ai
audio transcription ingestion pipelines #document-ai
ingesting slack and email data for llm apps #document-ai
provenance, metadata and traceability in document ingestion #document-ai
evaluating document extraction accuracy #document-ai

## 44. AI agent architecture & patterns
what is an ai agent: the agent loop #agents -ui
workflows vs agents: when to use each #agents -ui
react agent pattern (reason + act) #agents -i
plan-and-execute agents #agents
reflection and self-critique loops in agents #agents -i
llm routing workflow pattern #agents
prompt chaining workflow pattern #agents
parallelization workflow pattern for llms #agents
orchestrator-worker agent pattern #agents -i
evaluator-optimizer agent pattern #agents
building an ai agent from scratch without frameworks #agents -ui
agent tool design principles #agents -i
agent stopping conditions and loop control #agents -i
computer-use and browser agents #agents
coding agent architecture #agents
deep research agent architecture #agents

## 45. Multi-agent systems & orchestration
multi-agent system fundamentals and when to use them #multi-agent -ui
supervisor (hierarchical) multi-agent pattern #multi-agent -i
agent handoffs and swarm pattern #multi-agent
agent-to-agent (a2a) protocol #multi-agent -i
shared state and communication between agents #multi-agent
subagents and context isolation #multi-agent
multi-agent failure modes and coordination problems #multi-agent -i
multi-agent cost and latency trade-offs #multi-agent
debugging multi-agent systems #multi-agent
multi-agent supervisor implementation with langgraph #multi-agent -i

## 46. Agent frameworks & SDKs
langchain core: runnables and lcel #agent-frameworks -i
langchain chat models, prompt templates and output parsers #agent-frameworks -u
langchain tools and agents #agent-frameworks -i
langgraph state graphs, nodes and edges #agent-frameworks -ui
langgraph conditional edges and cycles #agent-frameworks -i
langgraph checkpointing and persistence #agent-frameworks -i
langgraph human-in-the-loop with interrupts #agent-frameworks -ui
langgraph streaming modes #agent-frameworks
langgraph mermaid graph visualization #agent-frameworks
langgraph subgraphs #agent-frameworks
llamaindex agents and workflows #agent-frameworks
crewai agents, tasks and crews #agent-frameworks -i
autogen multi-agent conversations #agent-frameworks
semantic kernel plugins and planners #agent-frameworks
openai agents sdk #agent-frameworks
claude agent sdk #agent-frameworks -i
google agent development kit (adk) #agent-frameworks
aws strands agents #agent-frameworks
comparing agent frameworks and choosing one #agent-frameworks -i

## 47. Model Context Protocol (MCP)
mcp architecture: hosts, clients, servers #mcp -ui
mcp primitives: tools, resources, prompts #mcp -i
building an mcp server with fastmcp in python #mcp -ui
building an mcp server with the typescript sdk #mcp
mcp transports: stdio vs streamable http #mcp -i
integrating an mcp client into an agent #mcp -i
mcp authentication and authorization with oauth #mcp -i
mcp server security: tool poisoning and permissions #mcp -i
deploying remote mcp servers #mcp
mcp gateway and registry patterns #mcp
mcp sampling and elicitation #mcp
mcp tool design best practices #mcp -i

## 48. Agent memory & state management
agent memory types: short-term, long-term, episodic, semantic #agent-memory -i
conversation history management and truncation #agent-memory -i
agent long-term memory with vector stores #agent-memory
agent memory frameworks: mem0, letta, zep #agent-memory
langgraph long-term memory store #agent-memory
agent session state and checkpoint persistence #agent-memory
agent memory summarization and consolidation #agent-memory
user personalization with agent memory #agent-memory
agent memory privacy and forgetting #agent-memory
scratchpads and note-taking for long-horizon agents #agent-memory

## 49. Human-in-the-loop design
human-in-the-loop fundamentals: when to require a human #hitl
approval gates for high-risk agent actions #hitl -i
confidence-based routing to human reviewers #hitl
escalation and handoff from ai agent to human #hitl
review queues and feedback loops for ai output #hitl
using human feedback as eval and training data #hitl
interrupt and resume patterns in agent workflows #hitl
drawing the line between deterministic and agentic decisions #hitl -i
risk tiering of agent actions #hitl
maker-checker controls for ai output #hitl

## 50. LLM & agent evaluation
llm evaluation fundamentals: why evals matter #evals -ui
building golden datasets for llm evals #evals -ui
error analysis on llm traces #evals -ui
code-based assertions and deterministic llm evals #evals -i
llm-as-judge evaluation design #evals -ui
calibrating llm judges against human labels #evals
rag evaluation metrics: faithfulness, context precision, context recall #evals -ui
rag evaluation with ragas #evals -i
llm testing with deepeval or promptfoo #evals
agent evaluation: trajectory and tool-use correctness #evals -ui
multi-turn conversation evaluation #evals
online evaluation and production monitoring of llm apps #evals -i
running llm eval regression tests in ci #evals -i
a/b testing llm features in production #evals
hallucination detection and measurement #evals -i
synthetic test data generation for llm evals #evals
llm benchmarks overview: mmlu, swe-bench and others #evals

## 51. LLM observability & tracing
llm observability fundamentals: traces, spans, generations #llm-observability -ui
langsmith tracing and datasets #llm-observability -i
langfuse tracing, scoring and prompt management #llm-observability -i
opentelemetry for llm apps with genai semantic conventions #llm-observability
arize phoenix for llm observability #llm-observability
llm token usage and cost tracking #llm-observability -i
agent trace analysis and debugging #llm-observability -i
llm output quality monitoring and drift #llm-observability
logging user feedback on llm responses #llm-observability
dashboards and alerting for llm applications #llm-observability

## 52. Guardrails & reliability for non-deterministic systems
llm guardrails fundamentals: input and output filtering #guardrails -ui
nemo guardrails #guardrails
guardrails ai validators #guardrails
llama guard and moderation apis #guardrails
pii detection and redaction with presidio #guardrails -i
llm self-correction loops and retry with feedback #guardrails -i
deterministic fallbacks for llm failures #guardrails -i
circuit breakers and timeouts for llm calls #guardrails
model fallback chains across llm providers #guardrails -i
graceful degradation for ai features #guardrails
policy checks before agent actions #guardrails
handling llm non-determinism: temperature, seeds and idempotency #guardrails

## 53. LLM cost & latency optimization
llm token economics and cost modeling #llm-cost -ui
prompt caching for llm cost and latency #llm-cost -i
semantic caching of llm responses #llm-cost -i
llm model routing and cascading (cheap model first) #llm-cost -ui
batching llm requests for throughput #llm-cost
streaming for perceived llm latency #llm-cost
parallel tool calls and concurrent llm calls #llm-cost
reducing llm prompt size and output tokens #llm-cost
llm time to first token vs total latency #llm-cost -i
cost governance and budgets for ai workloads #llm-cost
self-hosted llm vs api cost comparison #llm-cost -i

## 54. Fine-tuning & model adaptation
when to fine-tune vs prompt engineering vs rag #fine-tuning -i
dataset preparation for llm fine-tuning #fine-tuning
supervised fine-tuning (sft) basics #fine-tuning
lora and qlora fine-tuning #fine-tuning
hands-on fine-tuning with the hugging face peft library #fine-tuning
continued pre-training (cpt) for domain adaptation #fine-tuning
llm fine-tuning with hugging face trl #fine-tuning
efficient llm fine-tuning with unsloth #fine-tuning
rlhf overview #fine-tuning
dpo and preference optimization #fine-tuning
fine-tuning embedding models for retrieval #fine-tuning
synthetic data generation for llm training #fine-tuning
model distillation from large to small llms #fine-tuning
evaluating fine-tuned llms #fine-tuning
managed fine-tuning on openai and aws bedrock #fine-tuning

## 55. LLM serving & inference infrastructure
llm inference fundamentals: prefill and decode #llm-serving -i
gpu memory and vram sizing for llm inference #llm-serving
llm serving with vllm and paged attention #llm-serving
llm serving engines: tgi, sglang, triton #llm-serving
llm quantization: gguf, awq, gptq, int8/fp8 #llm-serving
continuous batching in llm serving #llm-serving
speculative decoding #llm-serving
deploying llms on kubernetes with gpu autoscaling #llm-serving
model serving with bentoml #llm-serving
distributed inference with ray serve #llm-serving
llm inference throughput and latency benchmarking #llm-serving
serverless gpu inference options #llm-serving

## 56. LLMOps & AI platform engineering
llmops vs mlops #llmops
prompt registry and prompt versioning #llmops -i
model registry and versioning for llms #llmops
ci/cd pipelines for llm applications #llmops
llm gateway: routing, keys and quotas with litellm or portkey #llmops -i
ai control plane design #llmops
feature flags and gradual rollout for ai features #llmops
dataset and eval versioning #llmops
deploying containerized llm apps to the cloud #llmops
llm experiment tracking with mlflow #llmops
building reusable llm components and internal accelerators #llmops
multi-tenant llm platform design #llmops

## 57. Multimodal & voice AI
vision language models for image understanding #multimodal
image generation apis basics #multimodal
speech-to-text with whisper and deepgram #multimodal
text-to-speech apis: elevenlabs and openai tts #multimodal
voice agent pipeline: stt, llm, tts #multimodal -i
openai realtime api and speech-to-speech models #multimodal
voice activity detection and turn-taking in voice agents #multimodal
latency optimization for voice agents #multimodal
building voice agents with livekit or pipecat #multimodal
video understanding with multimodal models #multimodal

## 58. AI security
owasp top 10 for llm applications #ai-security -ui
direct prompt injection attacks and defenses #ai-security -i
indirect prompt injection via documents and tools #ai-security -ui
llm jailbreaks and defenses #ai-security
data exfiltration risks through ai agents #ai-security
least-privilege tool access for ai agents #ai-security -i
sandboxing code execution for ai agents #ai-security
llm output sanitization and insecure output handling #ai-security
secrets and credentials handling in ai agents #ai-security
ai red teaming basics #ai-security
ai model supply chain and data poisoning risks #ai-security
mcp and tool security risks for agents #ai-security

## 59. Responsible AI, governance & compliance
responsible ai principles: fairness, transparency, accountability #responsible-ai
bias detection and mitigation in ai systems #responsible-ai
eu ai act overview for engineers #responsible-ai
nist ai risk management framework #responsible-ai
iso 42001 ai management system basics #responsible-ai
ai governance operating model in an enterprise #responsible-ai
model cards and ai system documentation #responsible-ai
audit trails and auditability for ai decisions #responsible-ai
ai in regulated domains: finance and healthcare #responsible-ai
explainability of ai outputs #responsible-ai

## 60. ML fundamentals
ml problem framing and types of ml #ml
linear regression and gradient descent #ml
logistic regression for classification #ml
decision trees and random forests #ml
gradient boosting with xgboost and lightgbm #ml
k-means and clustering algorithms #ml
dimensionality reduction with pca #ml
bias-variance trade-off and regularization #ml
train/validation/test splits and cross-validation #ml
classification metrics: precision, recall, f1, roc-auc #ml -i
ml regression metrics: mae, rmse, r2 #ml
feature engineering techniques #ml
handling imbalanced datasets #ml
scikit-learn pipelines #ml

## 61. Deep learning & PyTorch
neural network fundamentals: perceptrons and activation functions #deep-learning
backpropagation intuition #deep-learning
pytorch tensors and autograd #deep-learning
writing a pytorch training loop #deep-learning
optimizers and learning rate schedules: sgd, adam #deep-learning
deep learning regularization: dropout and batch normalization #deep-learning
convolutional neural networks (cnn) basics #deep-learning
recurrent neural networks and lstm basics #deep-learning
transfer learning with pretrained models #deep-learning
gpu training basics and mixed precision #deep-learning

## 62. Statistics & experimentation
descriptive statistics and probability distributions #statistics
probability fundamentals and bayes theorem #statistics
sampling and the central limit theorem #statistics
hypothesis testing and p-values #statistics
confidence intervals #statistics
t-tests and chi-square tests #statistics
a/b test design: sample size and statistical power #statistics
a/b test pitfalls: peeking, novelty effects, multiple testing #statistics
correlation vs causation #statistics
bayesian a/b testing basics #statistics

## 63. Applied ML problem types
text classification with classical nlp #applied-ml
named entity recognition #applied-ml
image classification #applied-ml
object detection basics with yolo #applied-ml
image segmentation basics #applied-ml
recommendation systems: collaborative filtering #applied-ml
recommendation systems: two-tower retrieval and ranking #applied-ml
learning to rank #applied-ml
time series forecasting basics: arima and prophet #applied-ml
anomaly detection techniques #applied-ml

## 64. MLOps
mlops lifecycle overview #mlops
ml experiment tracking with mlflow #mlops
model registry and promotion workflows #mlops
feature stores with feast #mlops
ml model serving patterns: batch vs online #mlops
ml model monitoring and data drift detection #mlops
ml pipelines with kubeflow or sagemaker pipelines #mlops
data and model versioning with dvc #mlops
ci/cd for ml models #mlops
sagemaker training and deployment basics #mlops

## 65. AI coding agents in daily engineering
claude code fundamentals: commands, modes and permissions #ai-coding -u
claude.md and project memory for coding agents #ai-coding -i
claude code subagents, skills and hooks #ai-coding -i
connecting mcp servers to claude code #ai-coding
github copilot chat and agent mode #ai-coding -i
github copilot cloud agent workflows #ai-coding -i
cursor rules and agent workflows #ai-coding
openai codex cli workflows #ai-coding
spec-driven development with ai coding agents #ai-coding -ui
plan-then-implement workflow with coding agents #ai-coding -i
writing effective prompts for coding agents #ai-coding
reviewing and verifying ai-generated code #ai-coding -ui
test-driven development with ai coding agents #ai-coding
using ai agents for debugging and codebase exploration #ai-coding
running parallel coding agents with git worktrees #ai-coding
ai-assisted refactoring and code migrations #ai-coding

## 66. Agentic SDLC & AI adoption at team / org level
agentic sdlc overview: ai across plan, build, test, deploy #agentic-sdlc
ai usage guidelines and policy for engineering teams #agentic-sdlc
traceability of ai-generated code and decisions #agentic-sdlc
human validation and maker-checker for ai-generated code #agentic-sdlc
ai-assisted code review automation #agentic-sdlc
ai agents in ci/cd pipelines #agentic-sdlc
measuring ai adoption and developer productivity impact #agentic-sdlc
rolling out ai coding tools across an engineering org #agentic-sdlc
security and ip risks of ai coding tools #agentic-sdlc
ai-assisted requirements and test case generation #agentic-sdlc

## 67. AWS
aws iam: users, roles and policies #aws -ui
aws vpc networking basics #aws -i
aws ec2 and auto scaling groups #aws
aws s3: storage classes, bucket policies and events #aws -i
aws lambda and event triggers #aws -ui
aws api gateway with lambda #aws
aws ecs and fargate #aws -i
aws eks basics #aws -i
aws rds and aurora #aws
aws elasticache #aws
aws sqs, sns and eventbridge in practice #aws -i
aws route 53 and cloudfront #aws
aws cloudwatch logs, metrics and alarms #aws
aws bedrock overview #aws -u
aws sagemaker overview #aws
aws secrets manager and kms #aws
aws well-architected framework #aws -i

## AWS deep dive: IAM & security
aws iam policy evaluation logic: explicit deny, scps, boundaries #aws-iam
aws iam identity-based vs resource-based policies #aws-iam
aws iam cross-account access with assume role #aws-iam
aws iam permission boundaries and least privilege design #aws-iam
aws iam roles for eks pods: irsa and eks pod identity #aws-iam
aws iam identity center (sso) for multi-account access #aws-iam
aws organizations and service control policies #aws-iam
aws kms key policies, envelope encryption and grants #aws-iam
aws security services: guardduty, security hub, inspector #aws-iam
aws cloudtrail auditing and aws config rules #aws-iam
aws waf and shield for application protection #aws-iam
aws vpc security: security groups, nacls, privatelink, vpc endpoints #aws-iam

## AWS deep dive: serverless
aws lambda execution model, cold starts and snapstart #aws-serverless -i
aws lambda concurrency: reserved, provisioned and throttling #aws-serverless
aws lambda performance tuning: memory, layers and packaging #aws-serverless
aws lambda error handling, retries and destinations #aws-serverless
aws api gateway: rest vs http apis, authorizers and throttling #aws-serverless
aws step functions: standard vs express workflows #aws-serverless
aws step functions error handling, retries, parallel and map states #aws-serverless
aws eventbridge rules, event buses and pipes #aws-serverless
aws sqs with lambda: batching, partial failures, visibility timeout #aws-serverless
aws serverless patterns: fan-out, saga, event sourcing #aws-serverless
aws sam and cdk for serverless deployments #aws-serverless
aws lambda observability with x-ray and powertools #aws-serverless
aws lambda for llm workloads: response streaming and timeouts #aws-serverless

## AWS deep dive: containers (ECS & EKS)
aws ecs task definitions, services and capacity providers #aws-containers
aws ecs fargate vs ec2 launch types trade-offs #aws-containers
aws ecs service connect and service discovery #aws-containers
aws ecs deployments: rolling and blue-green with codedeploy #aws-containers
aws eks cluster setup with eksctl or terraform #aws-containers
aws eks networking: vpc cni and pod ip management #aws-containers
aws eks ingress with the aws load balancer controller #aws-containers
aws eks node autoscaling with karpenter #aws-containers
aws eks gpu node groups for ai workloads #aws-containers
aws eks observability with container insights #aws-containers
aws ecr image management and vulnerability scanning #aws-containers
aws alb vs nlb for container workloads #aws-containers

## AWS deep dive: data services
aws aurora postgresql: architecture, replicas and failover #aws-data
aws aurora serverless v2 scaling #aws-data
aws rds proxy and database connection management #aws-data
aws dynamodb capacity modes: on-demand vs provisioned #aws-data
aws dynamodb hot partition avoidance and adaptive capacity #aws-data
aws dynamodb transactions and conditional writes #aws-data
aws dynamodb global tables #aws-data
aws dynamodb dax caching #aws-data
aws elasticache redis cluster mode and failover #aws-data
aws s3 performance: prefixes, multipart upload, transfer acceleration #aws-data
aws s3 lifecycle policies, versioning and replication #aws-data
aws opensearch service for search and vector search #aws-data
aws redshift basics for analytics #aws-data

## AWS deep dive: generative AI (Bedrock & AgentCore)
aws bedrock model catalog and model selection #aws-bedrock
aws bedrock converse api with tool use #aws-bedrock -i
aws bedrock knowledge bases: ingestion, chunking and retrieval #aws-bedrock -i
aws bedrock agents: action groups and orchestration #aws-bedrock
aws bedrock guardrails #aws-bedrock
aws bedrock prompt management and flows #aws-bedrock
aws bedrock model evaluation #aws-bedrock
aws bedrock provisioned throughput, cross-region inference and cost #aws-bedrock
aws bedrock fine-tuning and custom models #aws-bedrock
aws bedrock agentcore runtime for deploying agents #aws-bedrock -i
aws bedrock agentcore gateway and mcp tools #aws-bedrock
aws bedrock agentcore memory and identity #aws-bedrock
aws bedrock agentcore observability #aws-bedrock
aws reference architecture: serverless rag on bedrock #aws-bedrock

## 68. Azure & GCP for AI workloads
azure fundamentals: subscriptions, resource groups, entra id #azure-gcp
azure app service and container apps #azure-gcp
azure kubernetes service (aks) basics #azure-gcp
azure openai service in practice #azure-gcp -i
azure ai foundry #azure-gcp
azure ai search for rag #azure-gcp
azure functions #azure-gcp
gcp fundamentals: projects and iam #azure-gcp
gcp cloud run #azure-gcp
gcp vertex ai and gemini #azure-gcp
aws vs azure vs gcp service mapping #azure-gcp

## 69. Docker & Kubernetes
docker images, layers and dockerfile best practices #kubernetes -i
multi-stage docker builds #kubernetes
docker compose for local development #kubernetes -i
docker networking and volumes #kubernetes
kubernetes architecture: control plane and nodes #kubernetes
kubernetes pods, deployments and replicasets #kubernetes -i
kubernetes services and ingress #kubernetes -i
kubernetes configmaps and secrets #kubernetes
kubernetes resource requests, limits and qos #kubernetes
kubernetes autoscaling with hpa and keda #kubernetes
kubernetes health probes: liveness, readiness, startup #kubernetes
kubernetes statefulsets and persistent volumes #kubernetes
kubernetes rbac and namespaces #kubernetes
helm charts: templating and releases #kubernetes
kubernetes debugging with kubectl #kubernetes
kubernetes gpu scheduling basics #kubernetes

## 70. Infrastructure as Code
infrastructure as code principles #iac
terraform basics: providers, resources and state #iac -i
terraform variables, outputs and locals #iac
terraform modules and reuse #iac
terraform remote state and state locking #iac
terraform workspaces and multi-environment setup #iac
terraform plan and apply in ci/cd #iac
aws cloudformation and cdk basics #iac
policy as code with opa or sentinel #iac
terraform drift detection and resource import #iac

## 71. CI/CD & GitOps
ci/cd fundamentals and pipeline design #cicd
github actions workflows, jobs and runners #cicd -i
github actions reusable workflows and secrets #cicd
jenkins pipelines basics #cicd
ci build caching and pipeline speed optimization #cicd
deployment strategies: blue-green, canary, rolling #cicd -i
feature flags for safe releases #cicd
gitops with argocd #cicd
git branching strategies: trunk-based vs gitflow #cicd
artifact management and container registries #cicd
ci supply chain security: sbom and artifact signing #cicd
running database migrations in ci/cd #cicd

## 72. Observability
observability pillars: logs, metrics, traces #observability -i
structured logging and log aggregation #observability
metric types: counters, gauges, histograms #observability
prometheus and promql #observability
grafana dashboards #observability
distributed tracing concepts #observability
opentelemetry instrumentation #observability -i
datadog apm basics #observability
red and use monitoring methods #observability
alerting design and avoiding alert fatigue #observability
correlation ids across services #observability

## 73. Reliability engineering & incident management
site reliability engineering (sre) fundamentals #reliability
slis, slos and slas #reliability -i
sre error budgets #reliability
incident response process and roles #reliability
on-call practices #reliability
root cause analysis and blameless postmortems #reliability -i
runbooks and playbooks #reliability
chaos engineering basics #reliability
disaster recovery: rpo and rto #reliability
graceful degradation and load shedding #reliability
infrastructure capacity planning #reliability

## 74. Cloud architecture & cost management
cloud architecture fundamentals: regions and availability zones #cloud-architecture
cloud networking: vpc, subnets, nat, peering #cloud-architecture
dns and load balancing in the cloud #cloud-architecture
cloud identity federation and sso #cloud-architecture
multi-environment setup: dev, staging, prod #cloud-architecture
multi-account and landing zone strategy #cloud-architecture
serverless architecture patterns #cloud-architecture
finops fundamentals #cloud-architecture
cloud cost optimization techniques #cloud-architecture
gpu cost management for ai workloads #cloud-architecture
multi-cloud and hybrid cloud trade-offs #cloud-architecture

## 75. Application & API security
owasp top 10 web vulnerabilities #appsec -i
sql injection and prevention #appsec
xss and csrf prevention #appsec
ssrf attacks and prevention #appsec
secure coding practices #appsec
input validation and output encoding #appsec
threat modeling with stride #appsec
owasp api security top 10 #appsec
security scanning: sast, dast and sca #appsec
security headers and cors configuration #appsec

## 76. Identity & access management
authentication vs authorization fundamentals #iam
oauth 2.0 flows: authorization code with pkce, client credentials #iam -i
openid connect (oidc) #iam
jwt structure, signing and validation #iam -i
session-based vs token-based authentication #iam
single sign-on with saml and oidc #iam
rbac vs abac authorization #iam
multi-tenant authorization design #iam -i
service-to-service auth: api keys and mtls #iam
okta and auth0 integration basics #iam
authorization engines: opa, cedar, openfga #iam

## 77. Data protection & privacy
encryption at rest and in transit #privacy
tls fundamentals #privacy
key management with kms #privacy
secrets management with hashicorp vault #privacy
handling pii and phi data #privacy -i
data masking and tokenization #privacy
hipaa compliance for engineers #privacy
gdpr for engineers #privacy
india dpdp act for engineers #privacy
audit logging for compliance #privacy
data retention and deletion policies #privacy

## 78. Testing strategy & test automation
testing pyramid and test strategy #testing -i
unit testing best practices #testing
mocking, stubbing and fakes #testing
integration testing with testcontainers #testing
api testing with supertest and pytest httpx #testing
end-to-end testing strategy #testing
test-driven development (tdd) #testing
consumer-driven contract testing #testing
property-based testing with hypothesis #testing
testing async code #testing
flaky tests: causes and fixes #testing
code coverage and mutation testing #testing
shift-left testing practices #testing
test data management #testing
performance and load testing in ci #testing

## 79. Engineering standards & code review
clean code principles #code-review
code review best practices as a reviewer #code-review
code review best practices as an author #code-review
linting and formatting setup: eslint, prettier, ruff, biome #code-review
monorepo management with nx #code-review
advanced git: rebase, bisect, cherry-pick #code-review
writing good commit messages and pr descriptions #code-review
quality gates and definition of done #code-review
technical debt management in a team #code-review
code readability and naming #code-review
static analysis with sonarqube #code-review

## 80. Debugging & production troubleshooting
systematic debugging methodology #debugging -i
reading stack traces and logs effectively #debugging
debugging distributed systems with traces #debugging
debugging production issues safely #debugging
using debuggers: breakpoints, pdb, chrome devtools #debugging
debugging memory and cpu issues in production #debugging
ramping up quickly in an unfamiliar codebase #debugging -i
linux command line for debugging: ps, top, netstat, strace #debugging
network debugging with curl, dig and tcpdump #debugging
reproducing and isolating bugs #debugging

## 81. Technical leadership & strategy
role of a staff / principal engineer #tech-leadership
writing a technical vision #tech-leadership
building a technical roadmap #tech-leadership
architecture decision records (adrs) #tech-leadership -i
making and communicating technical trade-offs #tech-leadership -i
managing technical debt at the org level #tech-leadership
technology evaluation and selection #tech-leadership
aligning technical strategy with business goals #tech-leadership
reversible vs irreversible technical decisions #tech-leadership
running architecture reviews #tech-leadership
setting engineering standards across teams #tech-leadership
leading large cross-team technical initiatives #tech-leadership -i

## 82. Mentoring & raising team capability
mentor vs coach vs sponsor #mentoring
running effective 1:1 mentoring sessions #mentoring
giving actionable feedback to engineers #mentoring
teaching through code reviews #mentoring
teaching through design reviews #mentoring
delegation and growing ownership in engineers #mentoring
pair programming as mentoring #mentoring
competency milestones and growth plans for engineers #mentoring
onboarding new engineers effectively #mentoring
building a learning culture in a team #mentoring

## 83. People management
engineering manager role and responsibilities #people-management
hiring: writing job descriptions and designing interview loops #people-management
conducting technical interviews as an interviewer #people-management
performance reviews and calibration #people-management
handling underperformance #people-management
career ladders and promotions #people-management
team building and team topologies #people-management
running 1:1s as an engineering manager #people-management
motivation, engagement and retention of engineers #people-management
managing conflict in engineering teams #people-management
building psychological safety in teams #people-management

## 84. Stakeholder management & influence
stakeholder mapping and analysis #stakeholders
influence without authority #stakeholders -i
building cross-team alignment #stakeholders
managing up: working with your manager and executives #stakeholders
saying no and negotiating scope #stakeholders
managing client relationships #stakeholders -i
handling disagreements and escalations #stakeholders
communicating risks and trade-offs to executives #stakeholders
vendor and partner management #stakeholders
building trust with non-technical stakeholders #stakeholders

## 85. Technical communication & writing
writing technical design documents #tech-writing -i
writing rfcs #tech-writing
writing for executives: bluf and one-pagers #tech-writing
technical documentation: readmes, runbooks, guides #tech-writing
explaining technical concepts to non-technical audiences #tech-writing -i
presenting technical work and live demos #tech-writing -i
storytelling with data #tech-writing
architecture diagramming with the c4 model #tech-writing
structuring a technical argument #tech-writing
async written communication on slack and email #tech-writing

## 86. Execution & delivery management
agile and scrum fundamentals #delivery
kanban for engineering teams #delivery
safe (scaled agile framework) overview #delivery
breaking projects into milestones and increments #delivery
software estimation techniques #delivery
risk management and raid logs #delivery
managing cross-team dependencies #delivery
running effective meetings and agile ceremonies #delivery
project status reporting #delivery
delivering under ambiguity and changing requirements #delivery -i

## 87. Engineering excellence & org change
dora metrics #eng-excellence
space framework for developer productivity #eng-excellence
change management models: adkar and kotter #eng-excellence
driving adoption of engineering standards #eng-excellence
raci models #eng-excellence
engineering governance without bureaucracy #eng-excellence
early warning signals and rag status reporting #eng-excellence
developer experience (devex) improvement #eng-excellence
inner source and reuse across teams #eng-excellence
running engineering communities of practice #eng-excellence

## 88. Behavioral interviews & leadership stories
star method for behavioral answers #behavioral -u
building a story bank from your experience #behavioral -ui
behavioral story: conflict with a peer or manager #behavioral -ui
behavioral story: failure and learning #behavioral -ui
behavioral story: leading without authority #behavioral -i
behavioral story: handling ambiguity #behavioral -ui
behavioral story: biggest technical achievement #behavioral -ui
behavioral story: mentoring and growing others #behavioral -i
behavioral story: disagree and commit #behavioral -i
behavioral story: tight deadlines and prioritization #behavioral -i
answering why this company and why this role #behavioral -u
mapping stories to amazon leadership principles #behavioral

## 89. Product thinking & discovery
product thinking for engineers #product-thinking -i
problem framing and jobs to be done #product-thinking -i
user research and user interview basics #product-thinking
identifying pain points by observing workflows #product-thinking -i
value vs effort assessment #product-thinking
product-market fit basics #product-thinking
defining an mvp #product-thinking
design thinking basics #product-thinking
competitive analysis basics #product-thinking
product sense interview practice #product-thinking

## 90. Requirements & product artifacts
writing user stories with invest #requirements
writing acceptance criteria in given-when-then #requirements
writing a prd #requirements
defining success metrics and kpis #requirements -i
gathering non-functional requirements #requirements
translating business requirements into technical specs #requirements -i
writing technical specs from prds #requirements
requirements-to-test traceability #requirements
use case and edge case discovery #requirements
defining quality bars for ai features #requirements -i

## 91. Prioritization & roadmapping
prioritization frameworks: rice, moscow, kano #roadmapping
backlog management and refinement #roadmapping
building a product roadmap #roadmapping
now-next-later roadmaps #roadmapping
okrs and aligning roadmaps to goals #roadmapping
balancing tech debt vs feature work #roadmapping
cost of delay and wsjf #roadmapping
opportunity sizing #roadmapping
saying no to feature requests #roadmapping
communicating roadmap changes #roadmapping

## 92. Prototype to production
rapid prototyping approach for engineers #prototype-to-prod -i
building a poc in a day with ai coding tools #prototype-to-prod -u
ai prototypes with streamlit or gradio #prototype-to-prod
validating prototypes with real users #prototype-to-prod
hardening a prototype for production: checklist #prototype-to-prod -i
production readiness review #prototype-to-prod
iterating on a product from usage data #prototype-to-prod
deciding when to throw away a prototype #prototype-to-prod
building demo environments and sandboxes #prototype-to-prod
cutting mvp scope #prototype-to-prod

## 93. Forward-deployed & customer-facing engineering
forward deployed engineer role and expectations #fde -i
running customer discovery calls #fde -i
technical discovery and solution design with customers #fde -ui
building customer demos and pocs #fde -i
deploying into customer environments: on-prem and private vpc #fde -i
navigating client security reviews #fde
enablement: training end users on a new system #fde
driving adoption after deployment #fde
turning customer feedback into product improvements #fde
handling customer escalations #fde
consulting skills: structuring problems with mece #fde -i

## 94. Product metrics & ROI of AI
product metrics fundamentals: north star and input metrics #ai-roi
funnel and retention metrics #ai-roi
product analytics instrumentation with posthog or amplitude #ai-roi
measuring ai feature quality in production #ai-roi
measuring roi of ai initiatives #ai-roi -i
engineering telemetry dashboards: cycle time and throughput #ai-roi
executive value dashboards #ai-roi
unit economics and cost per task for ai features #ai-roi
cohort analysis basics #ai-roi
adoption metrics for internal tools #ai-roi

## 95. Building internal platforms & tools
platform engineering fundamentals #internal-platforms
internal developer platforms with backstage #internal-platforms
designing extensible systems with plugins #internal-platforms
template and low-code systems for non-engineers #internal-platforms
turning one-off scripts into reusable tools #internal-platforms
building cli tools #internal-platforms
internal tools with retool or streamlit #internal-platforms
platform as a product mindset #internal-platforms
platform adoption and documentation #internal-platforms
api-first platform design #internal-platforms

## 96. Public technical presence
building a portfolio of ai projects on github #public-presence -ui
writing a strong github readme #public-presence -u
open source contribution workflow #public-presence
finding good first issues in ai frameworks #public-presence
publishing technical blog posts #public-presence
linkedin profile optimization for senior roles #public-presence -u
resume writing for senior engineers #public-presence -ui
giving conference talks and meetup presentations #public-presence
building in public #public-presence
crafting a personal brand narrative #public-presence
