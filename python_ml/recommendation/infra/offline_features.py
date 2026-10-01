
from recommendation.infra.engagement_features import build_user_recent_engagement_features
from recommendation.domain.feature_registry import FeatureDefinition, registry


def register_offline_features() -> None:
    registry.register(
        FeatureDefinition(
            name="user_post_recent_engagement",
            entity="post",
            compute_offline=build_user_recent_engagement_features,
        )
    )


def build_all_offline_features() -> dict[str, dict[tuple[str, str], dict[str, float]]]:
    register_offline_features()
    features: dict[str, dict[tuple[str, str], dict[str, float]]] = {}
    for feature in registry.all():
        if feature.compute_offline is None:
            continue
        value = feature.compute_offline()
        features[feature.name] = value
    return features

