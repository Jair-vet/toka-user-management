RAG_EXAMPLES = [
    {
        "query": "What is the role assignment process?",
        "answer": "Based on the documentation: Role assignment follows the RT-03 routine...",
    },
    {
        "query": "How does authentication work?",
        "answer": "According to the system docs: Authentication uses Keycloak OIDC with JWT RS256 tokens...",
    },
]

ADMIN_EXAMPLES = [
    {
        "query": "How many active users are there?",
        "thought": "I need to call the user_lookup tool with status=ACTIVE to count active users.",
        "answer": "Let me check the current user count...",
    },
]
