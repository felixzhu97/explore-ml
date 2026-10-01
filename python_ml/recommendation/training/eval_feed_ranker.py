"""Compare feed ranker checkpoints with recall@k and NDCG@k on a holdout file.

Each holdout line is JSON:
{"user_id": "u1", "positives": ["p1"],
 "candidates": [{"post_id": "p1", "like_count": 3, "comment_count": 1, "age_hours": 2.0}]}
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

import torch

from domain.feed_ranker import FeedRanker


def recall_at_k(ranked: Sequence[str], positives: Iterable[str], k: int) -> float:
    relevant = set(positives)
    if not relevant:
        return 0.0
    return len(relevant.intersection(ranked[:k])) / len(relevant)


def ndcg_at_k(ranked: Sequence[str], positives: Iterable[str], k: int) -> float:
    relevant = set(positives)
    if not relevant:
        return 0.0
    dcg = sum(1.0 / math.log2(i + 2) for i, pid in enumerate(ranked[:k]) if pid in relevant)
    ideal = sum(1.0 / math.log2(i + 2) for i in range(min(k, len(relevant))))
    return dcg / ideal


class CheckpointScorer:
    def __init__(self, path: str) -> None:
        checkpoint = torch.load(path, map_location="cpu")
        self.user_index: Dict[str, int] = dict(checkpoint.get("user_index") or {})
        self.post_index: Dict[str, int] = dict(checkpoint.get("post_index") or {})
        self.model = FeedRanker(
            num_users=int(checkpoint["num_users"]),
            num_posts=int(checkpoint["num_posts"]),
            feature_dim=3,
        )
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()

    def rank(self, user_id: str, candidates: List[dict]) -> List[str]:
        known = [c for c in candidates if c["post_id"] in self.post_index]
        if not known:
            return []
        user_idx = self.user_index.get(user_id, 0)
        users = torch.tensor([user_idx] * len(known), dtype=torch.long)
        posts = torch.tensor([self.post_index[c["post_id"]] for c in known], dtype=torch.long)
        features = torch.tensor(
            [
                [
                    math.log1p(float(c.get("like_count", 0))),
                    math.log1p(float(c.get("comment_count", 0))),
                    float(c.get("age_hours", 0.0)),
                ]
                for c in known
            ],
            dtype=torch.float32,
        )
        with torch.no_grad():
            scores = self.model(users, posts, features).tolist()
        order = sorted(range(len(known)), key=lambda i: scores[i], reverse=True)
        return [known[i]["post_id"] for i in order]


def evaluate(scorer: CheckpointScorer, rows: List[dict], k: int) -> Dict[str, float]:
    if not rows:
        return {f"recall@{k}": 0.0, f"ndcg@{k}": 0.0}
    recall = ndcg = 0.0
    for row in rows:
        ranked = scorer.rank(row["user_id"], row["candidates"])
        recall += recall_at_k(ranked, row["positives"], k)
        ndcg += ndcg_at_k(ranked, row["positives"], k)
    return {f"recall@{k}": recall / len(rows), f"ndcg@{k}": ndcg / len(rows)}


def load_rows(path: str) -> List[dict]:
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", required=True)
    parser.add_argument("--baseline")
    parser.add_argument("--holdout", required=True)
    parser.add_argument("--k", type=int, default=10)
    args = parser.parse_args(argv)
    rows = load_rows(args.holdout)
    result = {"model": evaluate(CheckpointScorer(args.model), rows, args.k)}
    if args.baseline:
        result["baseline"] = evaluate(CheckpointScorer(args.baseline), rows, args.k)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
