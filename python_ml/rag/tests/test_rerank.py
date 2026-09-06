from domain.core.rerank import apply_rerank_scores


def test_should_sort_by_rerank_score_descending():
    results = [
        {"id": "a", "score": 0.1, "payload": {"text": "a"}},
        {"id": "b", "score": 0.2, "payload": {"text": "b"}},
        {"id": "c", "score": 0.3, "payload": {"text": "c"}},
    ]
    ranked = apply_rerank_scores(results, [0.4, 0.9, 0.1])
    assert [r["id"] for r in ranked] == ["b", "a", "c"]
    assert ranked[0]["score"] == 0.9
