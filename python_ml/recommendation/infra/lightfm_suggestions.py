import numpy as np
from scipy.sparse import csr_matrix


def build_lightfm_suggestions(
    follows: list[tuple[str, str]],
    user_ids: list[str],
    user_buckets: dict[str, int],
    n_recommend: int = 50,
    epochs: int = 20,
) -> dict[str, list[str]]:
    try:
        from lightfm import LightFM
    except ImportError:
        return {}
    follow_set = set(follows)
    user_count = len(user_ids)
    user_id_to_index = {user_id: index for index, user_id in enumerate(user_ids)}
    interactions = []
    for follower_id, followee_id in follow_set:
        if follower_id in user_id_to_index and followee_id in user_id_to_index:
            follower_index = user_id_to_index[follower_id]
            followee_index = user_id_to_index[followee_id]
            interactions.append((follower_index, followee_index, 1.0))
    if not interactions:
        return {user_id: [] for user_id in user_ids}
    interaction_array = np.array(interactions, dtype=np.int32)
    if interaction_array.size == 0:
        return {user_id: [] for user_id in user_ids}
    row_indices = interaction_array[:, 0]
    column_indices = interaction_array[:, 1]
    values = np.ones(len(interactions), dtype=np.float32)
    interaction_matrix = csr_matrix((values, (row_indices, column_indices)), shape=(user_count, user_count))
    item_features = np.zeros((user_count, 5), dtype=np.float32)
    for user_index, user_id in enumerate(user_ids):
        item_features[user_index, 0] = 1.0
        bucket = user_buckets.get(user_id, 0)
        if 0 <= bucket < 4:
            item_features[user_index, 1 + bucket] = 1.0
    model = LightFM(loss="warp", no_components=64)
    model.fit(interaction_matrix, item_features=csr_matrix(item_features), epochs=epochs, num_threads=2)
    recommendations_by_user = {}
    for user_id in user_ids:
        user_index = user_id_to_index.get(user_id)
        if user_index is None:
            recommendations_by_user[user_id] = []
            continue
        followed_indices = set()
        for follower_id, followee_id in follow_set:
            if follower_id == user_id:
                followed_indices.add(user_id_to_index.get(followee_id))
        followed_indices.discard(None)
        try:
            scores = model.predict(user_index, np.arange(user_count), item_features=csr_matrix(item_features))
            for followed_index in followed_indices:
                scores[followed_index] = -1e9
            scores[user_index] = -1e9
            top_indices = np.argsort(-scores)[:n_recommend]
            recommendations_by_user[user_id] = [
                user_ids[candidate_index] for candidate_index in top_indices if scores[candidate_index] > -1e8
            ]
        except Exception:
            recommendations_by_user[user_id] = []
    return recommendations_by_user
