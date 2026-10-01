"""Measure retrieval recall@k and MRR through a running RAG helper.

Each query line is JSON: {"query": "...", "expected": ["text that a relevant chunk contains"]}.
A source counts as relevant when it contains any expected snippet, so results stay
comparable after re-indexing with a new embedding model.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

import httpx


def first_hit_rank(sources: Sequence[str], expected: Iterable[str]) -> Optional[int]:
    needles = [e.lower() for e in expected]
    for rank, text in enumerate(sources, start=1):
        lowered = text.lower()
        if any(n in lowered for n in needles):
            return rank
    return None


def score(ranks: List[Optional[int]], k: int) -> Dict[str, float]:
    if not ranks:
        return {f"recall@{k}": 0.0, "mrr": 0.0}
    hits = [r for r in ranks if r is not None and r <= k]
    return {
        f"recall@{k}": len(hits) / len(ranks),
        "mrr": sum(1.0 / r for r in hits) / len(ranks),
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--queries", required=True)
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--collection")
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args(argv)

    lines = Path(args.queries).read_text(encoding="utf-8").splitlines()
    ranks: List[Optional[int]] = []
    with httpx.Client(base_url=args.url, timeout=300) as client:
        for line in filter(str.strip, lines):
            row = json.loads(line)
            response = client.post(
                "/api/v1/documents:query",
                json={
                    "query": row["query"],
                    "collection": args.collection,
                    "top_k": args.k,
                    "include_sources": True,
                },
            )
            response.raise_for_status()
            sources = [s["text"] for s in response.json().get("sources", [])]
            ranks.append(first_hit_rank(sources, row["expected"]))
    print(json.dumps(score(ranks, args.k), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
