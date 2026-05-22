# MCP Tools Contract

The MCP server exposes the following tools to AI Wrappers:

1. `orch_health`: Returns the health status of all infrastructure services.
2. `orch_llm_route`: Routes a prompt through OmniRoute to the best LLM.
3. `orch_llm_stream`: Streams a response from OmniRoute.
4. `orch_vector_upsert`: Upserts a document into Qdrant.
5. `orch_vector_search`: Searches for relevant context in Qdrant.
6. `orch_workflow_trigger`: Triggers a specific n8n workflow by ID.
7. `orch_workflow_list`: Lists available n8n workflows.
8. `orch_hermes_chat`: Sends a message to the Hermes Agent runtime.
9. `orch_hermes_skills`: Manages Hermes Agent skills.
10. `orch_service_restart`: Restarts a specific infrastructure service.
