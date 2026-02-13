<?xml version="1.0" encoding="UTF-8"?>

<mcp_server_build_rulebook>

  <metadata>
    <title>MCP Server Build Rulebook</title>
    <version>1.0</version>
    <purpose>
      A reusable rulebook for building MCP servers that connect Claude Code to any
      project's data sources, hardware, services, and tooling. Use this rulebook every
      time a new feature is added that requires new MCP tools, or when building MCP
      servers from scratch for any project.
    </purpose>
    <audience>
      AI executor (Claude Code or equivalent). These instructions are written for an AI
      that will analyze a codebase, design tools, write server code, and register the
      servers with the host application. The AI should follow this rulebook sequentially
      and completely.
    </audience>
    <research_basis>
      This rulebook was compiled from the official MCP specification (2025-11-25),
      Anthropic's engineering guidance on code execution with MCP, Docker's MCP server
      best practices (based on building 100+ servers), production patterns from Snyk,
      Phil Schmid (Hugging Face), MCPcat, The New Stack, and real-world context window
      cost analysis from practitioners. All source URLs are listed in the references
      section.
    </research_basis>
  </metadata>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                     PART 1: CORE PRINCIPLES                       -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<core_principles>
<instruction>
These principles override all other guidance in this rulebook. If any decision
during the build process conflicts with a principle, the principle wins. Read all
five before beginning any work.
</instruction>

    <principle id="1" name="MCP Is a User Interface for Agents, Not a REST API Wrapper">
      <statement>
        An MCP server is not a thin wrapper around an existing API, database, or service.
        It is a user interface designed for a non-human user (the LLM agent). The agent
        cannot read API docs, cannot browse a dashboard, and cannot figure things out
        through trial and error. Every tool must deliver a complete, actionable outcome
        in a single call wherever possible.
      </statement>
      <bad_example>
        Three separate tools — get_user(email), get_orders(user_id), get_shipment(order_id)
        — that the agent must chain together across three round-trips, storing intermediate
        results in conversation history.
      </bad_example>
      <good_example>
        One tool — track_order(email) — that internally calls all three and returns a
        complete answer: "Order #12345 shipped via FedEx, arriving Thursday."
      </good_example>
      <rule>
        Design tools around what the agent is trying to accomplish, not around how the
        internal systems are structured.
      </rule>
    </principle>

    <principle id="2" name="Every Tool Competes for the Context Window">
      <statement>
        Every tool definition — its name, description, and parameter schema — is loaded
        into the agent's context window at session start. Every tool result also consumes
        context. On Claude Code, MCP tool definitions alone can consume 16-24% of a 200K
        context window before a single message is sent. Anthropic's own engineering team
        has documented cases where direct tool calls consume 150,000 tokens that could be
        reduced to 2,000 tokens through better design — a 98.7% reduction.
      </statement>
      <rules>
        <rule>Fewer, smarter tools beat many granular tools.</rule>
        <rule>Tool descriptions must be concise. One to three sentences maximum.</rule>
        <rule>Tool results must return exactly what the agent needs — not raw data dumps.</rule>
        <rule>Filter, aggregate, and summarize data inside the tool before returning it.
              Do not push filtering responsibility onto the agent.</rule>
        <rule>Every word in a tool description costs tokens. Edit ruthlessly.</rule>
      </rules>
    </principle>

    <principle id="3" name="One Server, One Domain">
      <statement>
        Each MCP server should have one clear, well-defined purpose. A database server
        exposes database tools. A hardware server exposes hardware tools. A build-tools
        server exposes build and test tools. Do not build a single monolithic server
        that does everything.
      </statement>
      <benefits>
        Clearer tool naming. Easier debugging. Lower per-server token cost. Ability to
        enable or disable servers based on the current task using /mcp in Claude Code.
        Servers not needed for the current work can be disabled to reclaim context budget.
      </benefits>
    </principle>

    <principle id="4" name="Respect the Target Hardware">
      <statement>
        Before building, determine the deployment target. If the project runs on
        constrained hardware (Raspberry Pi, embedded systems, low-memory VMs), every
        architectural decision must account for limited memory, CPU, and I/O. If the
        project runs on a powerful workstation or cloud server, constraints are looser
        but waste should still be avoided.
      </statement>
      <rules>
        <rule>Prefer lightweight tools. Avoid loading large datasets into memory.</rule>
        <rule>Use async I/O for all blocking operations.</rule>
        <rule>Profile memory usage after building each server.</rule>
        <rule>Target under 50MB RAM per MCP server at idle on constrained hardware.</rule>
      </rules>
    </principle>

    <principle id="5" name="Outcome-Oriented, Not CRUD-Oriented">
      <statement>
        Do not map database tables 1:1 to tools. Do not map API endpoints 1:1 to tools.
        Instead, map developer workflows to tools.
      </statement>
      <test>
        Ask: "What question would a developer ask while working on this project?" Then
        build the tool that answers that question in one call.
      </test>
    </principle>

</core_principles>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                  PART 2: PRE-BUILD CHECKLIST                      -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<pre_build_checklist>
<instruction>
Complete every section of this checklist before writing any MCP server code. Every
item must be answered or explicitly marked as "to be discovered during codebase
investigation." Do not skip this phase. Tools built without an inventory are tools
built on assumptions.
</instruction>

    <section id="2.1" name="Project Investigation">
      <instruction>
        Before designing any tools, thoroughly investigate the project. Read these files
        and directories in order, recording your findings for each.
      </instruction>
      <investigate>CLAUDE.md and any .claude/ directory — existing Claude Code configuration</investigate>
      <investigate>package.json, requirements.txt, pyproject.toml, or equivalent — all dependencies with versions</investigate>
      <investigate>Config files (tsconfig, vite.config, svelte.config, webpack.config, etc.) — build and module system</investigate>
      <investigate>Source directory structure — complete recursive listing</investigate>
      <investigate>API routes or endpoints — every route with HTTP methods, parameters, and return types</investigate>
      <investigate>Database files or connections — schema, tables, columns, row counts, access patterns</investigate>
      <investigate>Database migrations or seed scripts — how the schema is managed</investigate>
      <investigate>Config directories — what each config file controls, its format, and key fields</investigate>
      <investigate>Environment variable definitions (.env.example, .env.template) — every variable and its purpose</investigate>
      <investigate>Hardware interface directories — language, entry points, CLI arguments, data formats</investigate>
      <investigate>Scripts directories — every script with language, purpose, arguments, and output</investigate>
      <investigate>Utility directories — shared helper functions that may be useful as tools</investigate>
      <investigate>Model or type definition directories — data structures for domain objects</investigate>
      <investigate>Docker and deployment directories — Dockerfiles, compose files, service definitions, ports</investigate>
      <investigate>Build tool directories — custom build tooling and how to invoke it</investigate>
      <investigate>Test directories — test framework, patterns, coverage, and how to run tests</investigate>
      <investigate>Log file locations and logging configuration — where every log lives and its format</investigate>
      <investigate>Any existing MCP server configuration (.mcp.json, entries in .claude.json)</investigate>
    </section>

    <section id="2.2" name="Data Source Inventory">
      <instruction>
        For each data source the project contains, answer every question below. If you
        cannot answer a question from the files you have read, mark it as unknown and
        add an investigation step to discover it at runtime.
      </instruction>
      <per_source_questions>
        <question>What is the data source? (database, log file, hardware device, config file, API endpoint, external service, etc.)</question>
        <question>What is the access pattern? (Read-only? Read-write? Async required? Persistent connection needed?)</question>
        <question>What is the data volume? (Row counts, file sizes, typical response sizes)</question>
        <question>What is the update frequency? (Static config? Real-time sensor data? Periodic logs?)</question>
        <question>What are the concurrency concerns? (Will the app and MCP server both write? Database locking? Device exclusivity?)</question>
      </per_source_questions>
    </section>

    <section id="2.3" name="Developer Workflow Mapping">
      <instruction>
        For each data source identified in 2.2, list the developer questions it answers.
        Each question becomes a candidate tool. Group related questions into single tools
        where possible to minimize tool count.
      </instruction>
      <examples>
        <example source="database">"What is in the database right now?" → db_overview tool</example>
        <example source="hardware">"Is the hardware connected and working?" → hardware_status tool</example>
        <example source="logs">"Why did the last operation fail?" → read_recent_logs tool</example>
        <example source="api">"What API routes exist and what do they return?" → list_api_routes tool</example>
        <example source="config">"What is the current configuration for service X?" → config_read tool</example>
        <example source="deployment">"Are all services running?" → deployment_status tool</example>
      </examples>
    </section>

    <section id="2.4" name="Tool Budget Assessment">
      <instruction>
        Claude Code's Tool Search feature (v2.1.7+) dynamically loads MCP tools when
        they exceed 10% of context. However, fewer tools is always better.
      </instruction>
      <target>5 to 12 tools per MCP server.</target>
      <maximum>15 tools per server. If you need more, split into two servers.</maximum>
      <gate_test>
        Before adding any tool, ask: "Could Claude Code accomplish this by running a
        shell command via Bash?" If yes, and the operation is stateless, requires no
        structured validation, and needs no persistent connection — do NOT build an MCP
        tool. Use a script instead. The script has zero context window cost until invoked.
      </gate_test>
      <mcp_tool_justified_when>
        <condition>The operation requires a persistent connection (database, hardware device, WebSocket)</condition>
        <condition>The operation requires complex input validation and structured output</condition>
        <condition>The operation combines multiple steps the agent would otherwise chain</condition>
        <condition>The tool will be used frequently during development sessions</condition>
        <condition>The operation involves bidirectional communication or streaming data</condition>
      </mcp_tool_justified_when>
    </section>

    <section id="2.5" name="Language Selection">
      <instruction>
        Choose the implementation language for each MCP server based on the following
        criteria. A project may have multiple MCP servers in different languages.
      </instruction>

      <use_python_when>
        <condition>Accessing hardware interfaces (serial ports, USB, GPIO, SDR)</condition>
        <condition>Working with SQLite or other databases via async libraries (aiosqlite, asyncpg)</condition>
        <condition>Running system commands, reading system stats, managing processes</condition>
        <condition>The project's backend tooling is already Python-based</condition>
        <condition>Data processing, scientific computing, or ML inference is involved</condition>
      </use_python_when>
      <python_framework>
        Use FastMCP (included in the official MCP Python SDK via mcp.server.fastmcp).
        Decorator-based tool registration. Automatic schema generation from type hints
        and docstrings. Handles both sync and async functions.
      </python_framework>

      <use_typescript_when>
        <condition>The project is TypeScript/Node.js and you want type-safe integration</condition>
        <condition>Wrapping web framework API routes (SvelteKit, Next.js, Express, Fastify)</condition>
        <condition>Deep integration with the Node.js ecosystem (npm scripts, build tools, bundlers)</condition>
        <condition>Config files are JSON/YAML and benefit from native parsing</condition>
      </use_typescript_when>
      <typescript_framework>
        Use @modelcontextprotocol/sdk (the official MCP TypeScript SDK). Use Zod for
        parameter schema validation.
      </typescript_framework>
    </section>

    <section id="2.6" name="Compile the Build Plan">
      <instruction>
        After completing sections 2.1 through 2.5, compile a build plan that lists:
      </instruction>
      <output_item>How many MCP servers will be built and in which languages</output_item>
      <output_item>Which data sources each server owns</output_item>
      <output_item>The candidate tool list for each server (name, one-line description)</output_item>
      <output_item>Which candidate tools failed the gate test in 2.4 and will be scripts instead</output_item>
      <output_item>The estimated total tool count per server</output_item>
      <output_item>Known concurrency or resource concerns from 2.2</output_item>
      <rule>Do not proceed to implementation until this plan is complete.</rule>
    </section>

</pre_build_checklist>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                   PART 3: TOOL DESIGN RULES                       -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<tool_design_rules>
<instruction>
Apply every rule in this section to every tool you design. These are not
suggestions. Violations produce tools that waste context, confuse the agent,
or fail silently.
</instruction>

    <rule id="1" name="Naming Convention">
      <requirement>Use snake_case exclusively.</requirement>
      <requirement>
        Prefix every tool name with the domain to avoid collisions when multiple
        MCP servers are connected.
      </requirement>
      <pattern>{domain}_{action}_{target}</pattern>
      <good_examples>
        <example>db_query_signals</example>
        <example>sdr_scan_frequency_range</example>
        <example>config_read_network_settings</example>
        <example>docker_restart_container</example>
      </good_examples>
      <bad_examples>
        <example>query (too generic, collides with other servers)</example>
        <example>run_sql (no domain prefix)</example>
        <example>get.config (dot separator breaks tokenization)</example>
        <example>restart container (space breaks tool calling)</example>
      </bad_examples>
      <critical_warning>
        Never use spaces, dots, round brackets, or square brackets in tool names.
        These break tokenization in some models and can cause tools to silently not
        be called. This is documented by Snyk's MCP server research.
      </critical_warning>
    </rule>

    <rule id="2" name="Descriptions Are Marketing Copy for Agents">
      <requirement>
        The tool description is the single most important piece of metadata. The agent
        reads it to decide whether to use the tool. Write it for the agent, not for a
        human developer reading documentation.
      </requirement>
      <must_include>
        <item>What the tool does (action and outcome)</item>
        <item>What input it expects (brief summary)</item>
        <item>What format the output takes (JSON, plain text, etc.)</item>
        <item>When to use it (the developer scenario that triggers this tool)</item>
      </must_include>
      <good_example>
        "Query the project database with a SQL SELECT statement. Returns up to 100 rows
        as JSON. Use for investigating data, checking recent records, or verifying
        data integrity after changes."
      </good_example>
      <bad_example>
        "Runs SQL queries against the database."
      </bad_example>
      <token_budget>
        Keep descriptions to 1-3 sentences. Target under 200 tokens per complete tool
        definition (name + description + parameter schemas combined). Every word costs
        tokens at session startup.
      </token_budget>
    </rule>

    <rule id="3" name="Parameter Design">
      <requirement>Use typed parameters with descriptions. Never accept a raw untyped
                   "options" object.</requirement>
      <requirement>Use enums when the set of valid values is known and small.</requirement>
      <requirement>Provide sensible defaults for optional parameters.</requirement>
      <requirement>Validate inputs inside the tool. Return clear, actionable error
                   messages when validation fails.</requirement>
      <requirement>Use Pydantic models (Python) or Zod schemas (TypeScript) for
                   complex inputs.</requirement>
    </rule>

    <rule id="4" name="Output Design — Return Exactly What Is Needed">
      <requirement>Pre-filter data inside the tool. Do not return 500 rows and expect
                   the agent to find the relevant ones.</requirement>
      <requirement>Pre-aggregate when the agent is likely to need summaries. Return a
                   summary with the option to drill down, not raw data first.</requirement>
      <requirement>Cap response size. Claude Code warns when MCP tool output exceeds
                   10,000 tokens. Design tools to stay well under this limit.</requirement>
      <requirement>Return structured JSON when the data is tabular or complex. Return
                   plain text when the answer is a simple status or message.</requirement>
      <requirement>Include metadata in responses: row count, whether results were
                   truncated, timestamp of data, any warnings or caveats.</requirement>
    </rule>

    <rule id="5" name="Error Handling — Errors Are for the Agent">
      <requirement>
        Error messages must be actionable by the agent, not by a human reading a log.
      </requirement>
      <bad_example>Error: SQLITE_BUSY</bad_example>
      <good_example>
        Database is currently locked by another process. This typically happens when the
        application is performing a write operation. Retry in 2-3 seconds, or check if
        a long-running operation is in progress using the relevant status tool.
      </good_example>
      <error_structure>
        <field>code — machine-readable error identifier</field>
        <field>message — agent-readable, actionable explanation</field>
        <field>recovery — suggested next action the agent can take</field>
      </error_structure>
    </rule>

    <rule id="6" name="Idempotency and Safety">
      <requirement>Read tools must be safe to call repeatedly without side effects.</requirement>
      <requirement>Write tools must clearly document what they change in the description.</requirement>
      <requirement>Destructive tools (DELETE, DROP, truncate, format) must require an
                   explicit confirmation parameter such as confirm=true.</requirement>
      <requirement>For database writes, always return what was changed: rows affected,
                   and before/after values when practical.</requirement>
    </rule>

</tool_design_rules>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                 PART 4: ARCHITECTURE PATTERNS                     -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<architecture_patterns>
<instruction>
Use these patterns as templates when designing tools for a server. Not every
server needs all patterns. Choose the patterns that match the data source and
developer workflows identified in the pre-build checklist.
</instruction>

    <pattern id="1" name="Investigation Server">
      <purpose>Give the agent the ability to understand the current state of the system.</purpose>
      <typical_tools>
        <tool>{domain}_status — Is the service/hardware/database running and healthy?</tool>
        <tool>{domain}_schema or {domain}_structure — What does the data look like?</tool>
        <tool>{domain}_sample — Show a representative sample of data.</tool>
        <tool>{domain}_search — Find specific items matching criteria.</tool>
        <tool>{domain}_recent — What happened recently? (logs, events, changes)</tool>
      </typical_tools>
      <priority>
        This is the highest-value pattern. Build investigation tools first. An agent
        that can understand the system state is far more useful than one that can only
        blindly modify it.
      </priority>
    </pattern>

    <pattern id="2" name="Action Server">
      <purpose>Let the agent perform write operations.</purpose>
      <typical_tools>
        <tool>{domain}_create or {domain}_add</tool>
        <tool>{domain}_update or {domain}_modify</tool>
        <tool>{domain}_delete or {domain}_remove</tool>
        <tool>{domain}_execute or {domain}_run</tool>
      </typical_tools>
      <warning>
        These require more careful design around safety, confirmation parameters,
        input validation, and error handling than investigation tools.
      </warning>
    </pattern>

    <pattern id="3" name="Workflow Server">
      <purpose>
        Combine multiple operations into a single tool that accomplishes a complete
        developer task. This is the most context-efficient pattern.
      </purpose>
      <example>
        Instead of separate tools for "read config," "validate config," "apply config,"
        and "restart service" — build one tool: config_apply_and_restart(config_name,
        new_values) that does all four steps internally and returns the combined result.
      </example>
      <benefit>
        Dramatically reduces context window usage, reduces agent error rates, and
        eliminates multi-step orchestration the agent would otherwise have to perform.
      </benefit>
    </pattern>

    <pattern id="4" name="Resource Server">
      <purpose>
        Expose read-only data that the agent loads into its context as needed, using
        MCP Resources rather than Tools.
      </purpose>
      <use_for>
        <item>Database schemas</item>
        <item>Config file contents</item>
        <item>Project structure and file trees</item>
        <item>Documentation and reference data</item>
      </use_for>
      <advantage>
        Resources are lighter than tools because they do not require tool call overhead.
        Use them for static or rarely-changing reference data.
      </advantage>
    </pattern>

</architecture_patterns>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                PART 5: IMPLEMENTATION TEMPLATES                   -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<implementation_templates>

    <template language="python" name="FastMCP Server">
      <code><![CDATA[

# server.py

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("{server-name}")

@mcp.tool()
async def domain_status() -> dict:
"""Check the current status of {domain}. Returns health, uptime, and any
active errors. Use this to verify the system is operational before making
changes.""" # Implementation here
return {"status": "healthy", "uptime_seconds": 12345, "errors": []}

@mcp.tool()
async def domain_query(query: str, limit: int = 50) -> dict:
"""Query {domain} data with a natural language description or SQL statement.
Returns matching records as JSON, capped at limit to conserve context.
Use when investigating data during development.""" # Implementation here
return {"results": [], "count": 0, "truncated": False}

if **name** == "**main**":
mcp.run(transport="stdio")
]]></code>
<notes>
<note>Use async for all I/O-bound operations (database, network, file system).</note>
<note>FastMCP auto-generates tool schemas from type hints and docstrings.</note>
<note>The docstring IS the tool description. Write it for the agent.</note>
<note>Never use print() or write to stdout — it corrupts the JSON-RPC stream
on stdio transport. Use file-based logging instead.</note>
</notes>
</template>

    <template language="typescript" name="TypeScript SDK Server">
      <code><![CDATA[

// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
name: "{server-name}",
version: "1.0.0"
});

server.tool(
"domain_status",
"Check the current status of {domain}. Returns health and any active errors. Use to verify the system is operational before making changes.",
{},
async () => {
return {
content: [{ type: "text", text: JSON.stringify({ status: "healthy" }) }]
};
}
);

server.tool(
"domain_query",
"Query {domain} data. Returns matching records as JSON, capped at limit. Use when investigating data during development.",
{
query: z.string().describe("What you are looking for"),
limit: z.number().default(50).describe("Max results to return")
},
async ({ query, limit }) => {
return {
content: [{ type: "text", text: JSON.stringify({ results: [], count: 0 }) }]
};
}
);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
}
main();
]]></code>
<notes>
<note>Use Zod for all parameter schemas — provides validation and type inference.</note>
<note>Never use console.log() — it writes to stdout and corrupts the JSON-RPC
stream. Use a file logger like pino with a file destination.</note>
<note>Pin dependency versions exactly in package.json. Do not use ranges.</note>
</notes>
</template>

    <template name="Claude Code Registration">
      <description>
        Register MCP servers with Claude Code via .mcp.json in the project root
        (project scope, shared with team) or via CLI commands.
      </description>
      <mcp_json_example><![CDATA[

{
"mcpServers": {
"project-database": {
"command": "python",
"args": ["mcp-servers/python/database_server.py"],
"env": {
"DB_PATH": "./data/app.db"
}
},
"project-hardware": {
"command": "python",
"args": ["mcp-servers/python/hardware_server.py"]
},
"project-webapp": {
"command": "npx",
"args": ["tsx", "mcp-servers/typescript/src/server.ts"]
}
}
}
]]></mcp_json_example>
<cli_example><![CDATA[

# Local scope (only you, only this project — default)

claude mcp add project-database --scope local -- python mcp-servers/python/database_server.py

# Project scope (shared via .mcp.json, committed to repo)

claude mcp add project-database --scope project -- python mcp-servers/python/database_server.py

# User scope (available across all your projects)

claude mcp add project-database --scope user -- python mcp-servers/python/database_server.py

# With environment variables

claude mcp add project-database --scope local --env DB_PATH=./data/app.db -- python mcp-servers/python/database_server.py
]]></cli_example>
<scope_guidance>
<scope name="local">Personal servers, experimental configurations, sensitive credentials specific to one project. Default and recommended for development.</scope>
<scope name="project">Team-shared servers, project-specific tools, services required for collaboration. Committed to version control.</scope>
<scope name="user">Personal utilities needed across multiple projects, development tools used everywhere.</scope>
</scope_guidance>
</template>
</implementation_templates>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                   PART 6: THE BUILD PROCESS                       -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<build_process>
<instruction>
Follow these steps in order every time you build a new MCP server or add tools
to an existing one. Do not skip steps. Do not reorder steps.
</instruction>

    <step id="1" name="Identify the Trigger">
      <instruction>Determine what changed that requires new or modified MCP tooling.</instruction>
      <triggers>
        <trigger>New feature added to the app (new API routes, new database tables, new hardware integration)</trigger>
        <trigger>New data source connected (new sensor, new external API, new config system)</trigger>
        <trigger>Developer workflow gap identified (Claude Code needed information it could not get)</trigger>
        <trigger>Greenfield project setup (no MCP servers exist yet)</trigger>
      </triggers>
    </step>

    <step id="2" name="Run the Pre-Build Checklist">
      <instruction>
        Complete every section of Part 2 (pre_build_checklist). For greenfield projects,
        complete all sections. For adding tools to an existing server, complete sections
        2.2 through 2.4 for the new data source only.
      </instruction>
    </step>

    <step id="3" name="Design Tools on Paper Before Writing Code">
      <instruction>
        For each new tool, write the following before any implementation:
      </instruction>
      <design_item>Tool name (following Rule 1 naming convention)</design_item>
      <design_item>Tool description (following Rule 2 — 1-3 sentences, agent-oriented)</design_item>
      <design_item>Parameters with types, descriptions, and defaults</design_item>
      <design_item>Expected output format and example output</design_item>
      <design_item>Error cases and recovery suggestions</design_item>
      <review_checklist>
        <check>Does this tool pass the gate test from section 2.4? Should it be a script instead?</check>
        <check>Is this tool outcome-oriented or CRUD-oriented? If CRUD, redesign.</check>
        <check>Can two or more candidate tools be merged into one workflow tool?</check>
        <check>Estimate token cost: count words in description and parameter schemas,
               multiply by 1.3 for approximate token count. Stay under 200 tokens per
               tool definition.</check>
      </review_checklist>
    </step>

    <step id="4" name="Implement">
      <instruction>Write the server code following these sub-steps in order.</instruction>
      <sub_step order="1">Create the server directory structure:
        mcp-servers/{language}/{server_name}_server.{ext} plus a requirements or package file.</sub_step>
      <sub_step order="2">Install dependencies and verify they work on the target platform.</sub_step>
      <sub_step order="3">Create the server skeleton using the appropriate template from Part 5.
        Verify it starts and responds to MCP initialization with zero tools.</sub_step>
      <sub_step order="4">Implement investigation/status tools first. Get read access working.</sub_step>
      <sub_step order="5">Implement action/write tools second.</sub_step>
      <sub_step order="6">Implement workflow/composite tools last (these build on simpler tools).</sub_step>
      <critical_rules>
        <rule>Use async for all I/O operations.</rule>
        <rule>Add structured error handling from the start, not as an afterthought.</rule>
        <rule>Log to a file, NEVER to stdout. Stdout is the MCP communication channel
              for stdio transport. Logging to it corrupts the JSON-RPC stream and breaks
              the server.</rule>
        <rule>For database servers, use WAL mode (SQLite) or connection pooling to prevent
              locking conflicts with the application.</rule>
        <rule>For hardware servers, implement device availability checking before every
              operation. Return clean status when hardware is not connected.</rule>
      </critical_rules>
    </step>

    <step id="5" name="Test with MCP Inspector">
      <instruction>
        Before connecting to Claude Code, test every tool using the MCP Inspector.
      </instruction>
      <python_command>mcp dev mcp-servers/python/{server_name}_server.py</python_command>
      <typescript_command>npx @modelcontextprotocol/inspector node mcp-servers/typescript/dist/server.js</typescript_command>
      <test_cases>
        <case>Call each tool with valid inputs and verify correct output.</case>
        <case>Call each tool with invalid inputs and verify clear error messages.</case>
        <case>Call each tool with edge case inputs (empty strings, zero, very large values).</case>
        <case>For write tools, verify the change is actually applied and the response
              accurately reflects what changed.</case>
        <case>For status tools, test with the underlying service both running and stopped.</case>
      </test_cases>
    </step>

    <step id="6" name="Connect to Claude Code and Validate">
      <instruction>Register the server and verify it works in a real session.</instruction>
      <sub_step order="1">Register the server in .mcp.json or via claude mcp add.</sub_step>
      <sub_step order="2">Start Claude Code in the project directory.</sub_step>
      <sub_step order="3">Run /mcp to verify the server is connected and all tools are listed.</sub_step>
      <sub_step order="4">Run /context to check the token cost of the new tools. Record this number.</sub_step>
      <sub_step order="5">Test each tool by asking Claude Code to use it naturally in conversation.
        Do not force tool use with explicit tool names — verify the agent selects the
        right tool based on the description alone.</sub_step>
    </step>

    <step id="7" name="Measure and Optimize">
      <instruction>After successful validation, measure the impact and optimize.</instruction>
      <checks>
        <check>Context window impact: If the new server adds more than 5K tokens (visible
               via /context), review tool descriptions for conciseness. Remove unnecessary
               words. Combine tools if possible.</check>
        <check>Resource usage: Check memory and CPU of the MCP server processes. On
               constrained hardware, target under 50MB RAM per server at idle.</check>
        <check>Response size: If any tool consistently returns more than 5K tokens of
               output, add filtering, pagination, or summarization inside the tool.</check>
        <check>Tool selection accuracy: If Claude Code frequently picks the wrong tool
               or fails to pick the right one, the description needs rewriting.</check>
      </checks>
    </step>

    <step id="8" name="Document">
      <instruction>Update project documentation to reflect the new MCP capabilities.</instruction>
      <required_updates>
        <update>Add the new tools to a README inside the mcp-servers directory. Include
                tool name, one-line description, and example usage for each.</update>
        <update>Update CLAUDE.md (or equivalent project context file) to tell Claude Code
                about the new capabilities and when to use them. This improves tool
                selection accuracy.</update>
        <update>If the server was added to .mcp.json with project scope, ensure the file
                is committed to version control so team members get it automatically.</update>
      </required_updates>
    </step>

</build_process>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--               PART 7: WHEN NOT TO BUILD AN MCP TOOL               -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<when_not_to_build>
<instruction>
Not everything needs to be an MCP tool. Claude Code can already run shell commands.
A script that Claude invokes via Bash has zero context overhead until the moment
it runs. An MCP tool doing the same thing costs 4-10K tokens just sitting there
in the context window. Apply this decision framework before building any tool.
</instruction>

    <do_not_build_when>
      <condition>The operation is a simple, stateless shell command (cat, grep, npm test, git status, curl)</condition>
      <condition>The tool would be used less than once per session on average</condition>
      <condition>The tool requires no structured input validation beyond what a CLI provides</condition>
      <condition>The tool has no persistent state or connection to maintain</condition>
      <condition>The tool simply wraps a single CLI command with no added logic</condition>
    </do_not_build_when>

    <do_build_when>
      <condition>The operation requires a persistent connection (database, hardware, WebSocket)</condition>
      <condition>The operation requires complex input validation and structured output</condition>
      <condition>The operation combines multiple steps the agent would otherwise chain</condition>
      <condition>The tool will be used frequently during development sessions</condition>
      <condition>The operation involves bidirectional communication or streaming data</condition>
      <condition>The tool pre-processes or filters data to save context window tokens</condition>
    </do_build_when>

    <escalation_path>
      When in doubt, start with a shell script in a scripts/ or tools/ directory. If
      Claude Code keeps needing it and the shell invocation is awkward or the output
      needs structuring, promote it to an MCP tool. This is cheaper than building an
      MCP tool that turns out to be unnecessary.
    </escalation_path>

</when_not_to_build>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                   PART 8: MAINTENANCE RULES                       -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<maintenance_rules>

    <rule name="Track Tool Usage">
      Periodically review which tools Claude Code actually calls during development
      sessions. Tools that are never or rarely called are wasting context window space.
      Remove them or demote them to scripts.
    </rule>

    <rule name="Version Tool Changes">
      When changing a tool's parameters or output format, update the version in the
      server metadata. Claude Code's Tool Search caches tool definitions — changing
      them without a version bump can cause stale behavior.
    </rule>

    <rule name="Keep Descriptions Current">
      When the underlying system changes (new database columns, new API routes, new
      hardware capabilities, renamed config keys), update tool descriptions to reflect
      the new reality. Stale descriptions cause the agent to misuse tools or skip
      tools it should be using.
    </rule>

    <rule name="Monitor Context Budget">
      Run /context in Claude Code regularly. If total MCP tool overhead exceeds 20%
      of the context window, audit and prune. Disable servers not needed for the
      current task with /mcp or by adjusting scope. Consider whether any tools should
      be demoted to scripts.
    </rule>

    <rule name="One Feature Equals One Review Cycle">
      Every time a new feature is added to the project, ask: "Does Claude Code need
      new tools to effectively develop and debug this feature?" If yes, run this
      rulebook from build_process step 1. If no, skip it. Do not accumulate tool debt
      by deferring MCP updates indefinitely, and do not add tools preemptively for
      features that do not exist yet.
    </rule>

    <rule name="Prune Aggressively">
      A tool that existed for a feature that was removed, refactored, or deprecated
      must also be removed. Dead tools waste context and confuse the agent.
    </rule>

</maintenance_rules>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--                   PART 9: SECURITY CHECKLIST                      -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<security_checklist>
<instruction>
Every MCP server must satisfy every applicable item on this checklist before
deployment. These are not optional.
</instruction>

    <check>MCP servers must bind to localhost only. Never expose them on a network
           interface unless explicitly required and secured with OAuth 2.1.</check>
    <check>Database write tools must use parameterized queries exclusively to prevent
           SQL injection. Never interpolate user-provided strings into SQL.</check>
    <check>Hardware control tools must validate parameters against safe operating
           ranges defined by the hardware specifications.</check>
    <check>Config write tools must parse and validate the new configuration before
           applying it. Reject malformed input with a clear error.</check>
    <check>Never echo secrets, API keys, passwords, tokens, or credentials in tool
           results, error messages, or log output.</check>
    <check>Never store API keys or secrets in MCP server source code. Use environment
           variables passed through the .mcp.json env configuration or system
           environment.</check>
    <check>Destructive operations (delete, drop, truncate, overwrite, format) must
           require an explicit confirmation parameter.</check>
    <check>File system tools must validate paths to prevent directory traversal
           attacks. Restrict access to the project directory only.</check>
    <check>For stdio transport, ensure no sensitive data is written to stdout, as
           it is the communication channel visible to the MCP client.</check>

</security_checklist>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!--            PART 10: QUICK REFERENCE — ADDING TOOLS                -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

<quick_reference>

<title>Condensed Workflow for Adding Tools When a New Feature Ships</title>
<instruction>
Use this 10-step quick reference for the common case of "a feature was just
added and Claude Code may need new tools." For building servers from scratch,
use the full build process in Part 6.
</instruction>

    <step number="1">What changed? (new table? new API route? new hardware? new config?)</step>
    <step number="2">What developer questions does this create? (list them)</step>
    <step number="3">Which existing MCP server should own these tools? (database? hardware? webapp?)</step>
    <step number="4">Design 1-3 tools on paper (name, description, params, output)</step>
    <step number="5">Gate check — should any of these be scripts instead of MCP tools?</step>
    <step number="6">Check tool budget — will adding these push a server over 15 tools? If yes, split.</step>
    <step number="7">Implement using async I/O and structured error handling</step>
    <step number="8">Test with MCP Inspector</step>
    <step number="9">Register and validate in Claude Code. Check context cost with /context.</step>
    <step number="10">Update README and CLAUDE.md</step>

    <time_estimate>
      <simple_addition>30-60 minutes (1-3 tools added to existing server)</simple_addition>
      <new_server>2-4 hours (new server from scratch with 5-10 tools)</new_server>
    </time_estimate>

</mcp_server_build_rulebook>
