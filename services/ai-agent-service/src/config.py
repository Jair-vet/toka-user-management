from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    openai_api_key: str = ""
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "toka_documents"
    mongodb_url: str = "mongodb://localhost:27017/toka_ai"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "toka"
    keycloak_allowed_clients: str = "toka-frontend,backend-services"
    user_service_url: str = "http://localhost:3002"
    role_service_url: str = "http://localhost:3003"
    audit_service_url: str = "http://localhost:3004"
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o-mini"
    chunk_size: int = 512
    chunk_overlap: int = 50
    rag_top_k: int = 5
    max_tokens: int = 2000
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost", "http://localhost:5173"]
    supervisor_max_rounds: int = 3

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
