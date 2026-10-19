import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.application.rag_index import RAGIndex, index_dir


def main() -> None:
    index = RAGIndex()
    metadata = index.build()
    print(f"Documents indexed: {metadata['document_count']}")
    print(f"Embeddings generated: {metadata['document_count'] if metadata['dense_available'] else 0}")
    print(f"Vector dimension: {metadata['embedding_dimension']}")
    print(f"Lexical documents: {metadata['document_count']}")
    print(f"Index location: {index_dir()}")
    print(f"Embedding model: {metadata['embedding_model']}")
    if not metadata["dense_available"]:
        print("Dense retrieval unavailable: install sentence-transformers and rerun this command.")


if __name__ == "__main__":
    main()