from dataclasses import dataclass
from typing import Any, Literal
from collections.abc import Callable


EntityType = Literal["user", "post", "reel"]


@dataclass
class FeatureDefinition:
    name: str
    entity: EntityType
    compute_offline: Callable[..., Any] | None = None
    compute_online: Callable[..., Any] | None = None


class FeatureRegistry:
    def __init__(self) -> None:
        self._features: dict[str, FeatureDefinition] = {}

    def register(self, feature: FeatureDefinition) -> None:
        self._features[feature.name] = feature

    def get(self, name: str) -> FeatureDefinition | None:
        return self._features.get(name)

    def all(self) -> list[FeatureDefinition]:
        return list(self._features.values())


registry = FeatureRegistry()

