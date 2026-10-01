
from infra.engagement_features import build_user_recent_engagement_features
from domain.feature_registry import FeatureDefinition, registry


def register_online_features() -> None:
    registry.register(
        FeatureDefinition(
            name="user_post_recent_engagement",
            entity="post",
            compute_online=build_user_recent_engagement_features,
        )
    )


def get_online_features() -> dict[str, dict[tuple[str, str], dict[str, float]]]:
    register_online_features()
    features: dict[str, dict[tuple[str, str], dict[str, float]]] = {}
    for feature in registry.all():
        if feature.compute_online is None:
            continue
        value = feature.compute_online()
        features[feature.name] = value
    return features

