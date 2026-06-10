from langchain_core.tools import tool
from ...rag.pipeline import retrieve_context


@tool
async def vector_search(query: str) -> str:
    """
    Search the knowledge base for documentation and system information.
    Use for questions about policies, procedures, or system documentation.
    """
    try:
        results = await retrieve_context(query, top_k=5)
        if not results:
            return "No relevant documentation found for this query."
        context_parts = []
        for i, r in enumerate(results, 1):
            context_parts.append(
                f"[Source {i} — {r['source_type']}/{r['source_id']}] (relevance: {r['score']:.2f}):\n{r['content']}"
            )
        return "\n\n".join(context_parts)
    except Exception as e:
        return f"Error searching knowledge base: {str(e)}"
