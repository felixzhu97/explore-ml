import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from infra.follows import load_follows, load_user_ids
from infra.user_features import load_user_features
from infra.user_suggestions import friend_of_friend_candidates, implicit_als_with_annoy
from infra.lightfm_suggestions import build_lightfm_suggestions
from infra.redis_export import write_user_suggestions


def main() -> int:
    following_limit = config.FRIEND_OF_FRIEND_FOLLOWING_LIMIT
    follows = load_follows(limit_following_per_user=following_limit)
    if not follows:
        print("No follow data, skipping.")
        return 0
    friend_of_friend_suggestions = friend_of_friend_candidates(follows, exclude_self=True)
    all_users = list(load_user_ids())
    if not all_users:
        write_user_suggestions(friend_of_friend_suggestions)
        print("Wrote FoF-only suggestions.")
        return 0
    user_buckets = dict(load_user_features())
    try:
        lightfm_recommendations = build_lightfm_suggestions(
            follows, all_users, user_buckets,
            n_recommend=config.SUGGESTION_MAX_PER_USER,
            epochs=20,
        )
    except Exception as error:
        print(f"LightFM failed ({error}), using FoF only.")
        lightfm_recommendations = {}
    try:
        implicit_recommendations = implicit_als_with_annoy(
            follows, all_users,
            n_recommend=config.SUGGESTION_MAX_PER_USER,
            n_trees=50,
        )
    except Exception as error:
        print(f"Implicit+Annoy failed ({error}), skipping.")
        implicit_recommendations = {}
    suggestions = {}
    for user_id in all_users:
        seen = set()
        merged = []
        for candidate_id in lightfm_recommendations.get(user_id, []):
            if candidate_id not in seen and candidate_id != user_id:
                merged.append(candidate_id)
                seen.add(candidate_id)
        for candidate_id in implicit_recommendations.get(user_id, []):
            if candidate_id not in seen and candidate_id != user_id:
                merged.append(candidate_id)
                seen.add(candidate_id)
        for candidate_id in friend_of_friend_suggestions.get(user_id, []):
            if candidate_id not in seen and candidate_id != user_id:
                merged.append(candidate_id)
                seen.add(candidate_id)
        suggestions[user_id] = merged[: config.SUGGESTION_MAX_PER_USER]
    write_user_suggestions(suggestions)
    print(f"Wrote suggestions for {len(suggestions)} users (LightFM + Implicit/Annoy + FoF).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
