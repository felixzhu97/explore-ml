import torch

from domain.models.pytorch_feed_ranker import FeedRanker, warm_start
from training.eval_feed_ranker import ndcg_at_k, recall_at_k


def test_should_score_perfect_ranking_as_one():
    assert recall_at_k(["p1", "p2"], ["p1"], k=1) == 1.0
    assert ndcg_at_k(["p1", "p2"], ["p1"], k=2) == 1.0


def test_should_score_missed_positive_as_zero():
    assert recall_at_k(["p2", "p3"], ["p1"], k=2) == 0.0
    assert ndcg_at_k(["p2", "p3"], ["p1"], k=2) == 0.0


def test_should_reuse_embeddings_for_shared_ids_when_warm_starting():
    old = FeedRanker(num_users=2, num_posts=2, feature_dim=3)
    checkpoint = {
        "model_state": old.state_dict(),
        "user_index": {"u1": 0, "u2": 1},
        "post_index": {"p1": 0, "p2": 1},
    }
    new = FeedRanker(num_users=2, num_posts=3, feature_dim=3)

    users, posts = warm_start(new, checkpoint, {"u2": 0, "u3": 1}, {"p9": 0, "p1": 1, "p2": 2})

    assert (users, posts) == (1, 2)
    assert torch.equal(new.user_embedding.weight[0], old.user_embedding.weight[1])
    assert torch.equal(new.post_embedding.weight[1], old.post_embedding.weight[0])
    assert torch.equal(new.mlp[0].weight, old.mlp[0].weight)
