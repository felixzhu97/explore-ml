from collections import defaultdict
import pandas as pd


def friend_of_friend_candidates(
    follows: list[tuple[str, str]],
    exclude_self: bool = True,
) -> dict:
    follow_pairs = pd.DataFrame(follows, columns=["follower_id", "following_id"])
    follow_set = set(zip(follow_pairs["follower_id"], follow_pairs["following_id"]))
    by_follower = follow_pairs.groupby("follower_id")["following_id"].apply(list).to_dict()
    user_ids = set(follow_pairs["follower_id"]) | set(follow_pairs["following_id"])
    suggestions = {}
    for user_id in user_ids:
        following = set(by_follower.get(user_id, []))
        if exclude_self:
            following.add(user_id)
        candidate_counts = defaultdict(int)
        for followee_id in following:
            for friend_of_friend_id in by_follower.get(followee_id, []):
                if friend_of_friend_id not in following and (user_id, friend_of_friend_id) not in follow_set:
                    candidate_counts[friend_of_friend_id] += 1
        ranked_candidates = sorted(candidate_counts.items(), key=lambda candidate_and_count: -candidate_and_count[1])
        suggestions[user_id] = [candidate_id for candidate_id, _ in ranked_candidates]
    return suggestions


def merge_with_implicit(
    friend_of_friend_suggestions: dict,
    user_item_matrix,
    user_ids: list,
    item_ids: list,
    n_recommend: int = 50,
) -> dict:
    try:
        import implicit
        from scipy.sparse import csr_matrix
        model = implicit.als.AlternatingLeastSquares(factors=64)
        model.fit(user_item_matrix)
        user_id_to_index = {user_id: index for index, user_id in enumerate(user_ids)}
        index_to_item = {index: item_id for index, item_id in enumerate(item_ids)}
        merged = {}
        for user_id, friend_of_friend_list in friend_of_friend_suggestions.items():
            user_index = user_id_to_index.get(user_id)
            if user_index is None:
                merged[user_id] = friend_of_friend_list[:n_recommend]
                continue
            try:
                recommendations = model.recommend(
                    user_index, user_item_matrix[user_index], N=n_recommend, filter_already_liked_items=True
                )
            except Exception:
                merged[user_id] = friend_of_friend_list[:n_recommend]
                continue
            recommended_ids = [
                index_to_item[item_index] for item_index, _ in recommendations if item_index in index_to_item
            ]
            seen = set(recommended_ids)
            for candidate_id in friend_of_friend_list:
                if candidate_id not in seen and len(recommended_ids) < n_recommend:
                    recommended_ids.append(candidate_id)
                    seen.add(candidate_id)
            merged[user_id] = recommended_ids[:n_recommend]
        return merged
    except ImportError:
        return {
            user_id: suggestions[:n_recommend]
            for user_id, suggestions in friend_of_friend_suggestions.items()
        }


def implicit_als_with_annoy(
    follows: list,
    user_ids: list,
    n_recommend: int = 50,
    n_trees: int = 50,
) -> dict:
    try:
        import implicit
        from implicit.ann.annoy import AnnoyModel
        from scipy.sparse import csr_matrix
        import numpy as np
    except ImportError:
        return {}
    user_id_to_index = {user_id: index for index, user_id in enumerate(user_ids)}
    user_count = len(user_ids)
    row_indices, column_indices, values = [], [], []
    for follower_id, followee_id in follows:
        follower_index = user_id_to_index.get(follower_id)
        followee_index = user_id_to_index.get(followee_id)
        if follower_index is not None and followee_index is not None:
            row_indices.append(follower_index)
            column_indices.append(followee_index)
            values.append(1.0)
    if not row_indices:
        return {}
    follow_matrix = csr_matrix((values, (row_indices, column_indices)), shape=(user_count, user_count))
    base_model = implicit.als.AlternatingLeastSquares(factors=64)
    model = AnnoyModel(base_model, approximate_similar_items=True, approximate_recommend=True, n_trees=n_trees)
    model.fit(follow_matrix)
    recommendations_by_user = {}
    for user_id in user_ids:
        user_index = user_id_to_index.get(user_id)
        if user_index is None:
            recommendations_by_user[user_id] = []
            continue
        try:
            recommended_indices, _ = model.recommend(
                user_index, follow_matrix[user_index], N=n_recommend, filter_already_liked_items=True
            )
            recommendations_by_user[user_id] = [
                user_ids[recommended_index]
                for recommended_index in recommended_indices
                if recommended_index != user_index
            ]
        except Exception:
            recommendations_by_user[user_id] = []
    return recommendations_by_user
