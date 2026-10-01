
import psycopg2

import config


def load_ad_events(max_rows: int = 1000000) -> dict[tuple[str, str, str], dict[str, float]]:
    connection = psycopg2.connect(config.DATABASE_URL)
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT event_name, properties, created_at
        FROM analytics_events
        WHERE event_name IN ('ad_impression', 'ad_click', 'ad_conversion')
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (max_rows,),
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    aggregates: dict[tuple[str, str, str], dict[str, float]] = {}
    for event_name, properties, created_at in rows:
        event_properties = properties or {}
        if not isinstance(event_properties, dict):
            continue
        account_id = str(event_properties.get("adAccountId") or "")
        campaign_id = str(event_properties.get("adCampaignId") or "")
        creative_id = str(event_properties.get("adCreativeId") or "")
        if not account_id or not campaign_id:
            continue
        key = (account_id, campaign_id, creative_id)
        state = aggregates.get(key)
        if state is None:
            state = {
                "impressions": 0.0,
                "clicks": 0.0,
                "conversions": 0.0,
            }
            aggregates[key] = state
        if event_name == "ad_impression":
            state["impressions"] += 1.0
        elif event_name == "ad_click":
            state["clicks"] += 1.0
        elif event_name == "ad_conversion":
            state["conversions"] += 1.0
    return aggregates

