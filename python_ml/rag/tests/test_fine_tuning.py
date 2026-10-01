import json

from training.eval_retrieval import first_hit_rank, score
from training.train_embedding import load_pairs
from training.train_reranker import format_pair


def test_should_prefix_query_and_document_for_nomic_embeddings(tmp_path):
    path = tmp_path / "pairs.jsonl"
    path.write_text(json.dumps({"query": "q", "positive": "p"}) + "\n", encoding="utf-8")

    assert load_pairs(path) == [
        {"anchor": "search_query: q", "positive": "search_document: p"}
    ]


def test_should_format_reranker_prompt_like_qwen3_reranker():
    text = format_pair("what is rag", "RAG adds retrieval.")

    assert "<Query>: what is rag\n<Document>: RAG adds retrieval." in text
    assert text.endswith("<think>\n\n</think>\n\n")


def test_should_find_first_relevant_source_case_insensitively():
    assert first_hit_rank(["nothing", "Qdrant stores vectors"], ["qdrant"]) == 2
    assert first_hit_rank(["nothing"], ["qdrant"]) is None


def test_should_score_recall_and_mrr():
    assert score([1, 2, None, 6], k=5) == {"recall@5": 0.5, "mrr": 0.375}
