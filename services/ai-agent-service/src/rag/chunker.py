from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List


def chunk_text(text: str, chunk_size: int = 512, chunk_overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks for embedding."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)
