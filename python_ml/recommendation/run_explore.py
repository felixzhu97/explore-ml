from recommendation import config
from recommendation.infra.cassandra_engagement import (
    get_cassandra_session,
    load_engagement_and_posts,
    hot_score,
)
from recommendation.infra.explore_export import write_explore_hot


def main() -> int:
    try:
        session, cluster = get_cassandra_session()
    except Exception as error:
        print(f"Cassandra connect failed: {error}")
        return 1
    try:
        engagement_rows = load_engagement_and_posts(session, max_posts=1000)
    finally:
        cluster.shutdown()
    if not engagement_rows:
        print("No engagement data, skipping explore.")
        return 0
    scored_posts = [
        (hot_score(created_at, like_count, comment_count), post_id, author_id, created_at)
        for post_id, author_id, created_at, like_count, comment_count in engagement_rows
    ]
    scored_posts.sort(key=lambda scored_post: -scored_post[0])
    top_posts = scored_posts[:500]
    entries = [
        {"postId": post_id, "authorId": author_id, "createdAt": created_at}
        for _, post_id, author_id, created_at in top_posts
    ]
    write_explore_hot(entries)
    print(f"Wrote {len(entries)} explore hot entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
