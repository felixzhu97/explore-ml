from vision.domain.moderation import FrameVerdict, ModerationCategory, flagged, peak_scores
from vision.domain.prediction import Prediction, top_unique


def test_should_keep_first_score_per_label_when_labels_repeat():
    predictions = [Prediction("crane", 0.5), Prediction("crane", 0.3), Prediction("heron", 0.1)]

    assert top_unique(predictions, 2) == [Prediction("crane", 0.5), Prediction("heron", 0.1)]


def test_should_flag_category_when_score_reaches_threshold():
    scores = {"nude": 0.5, "prohibited": 0.49999}

    assert flagged(scores, {"nude": 0.5, "prohibited": 0.5}) == [ModerationCategory("nude", 0.5)]


def test_should_ignore_score_when_category_has_no_threshold():
    assert flagged({"nude": 0.9}, {}) == []


def test_should_keep_peak_score_per_category_across_frames():
    frames = [
        FrameVerdict(offset_seconds=0.0, scores={"nude": 0.2, "prohibited": 0.7}, safe=True),
        FrameVerdict(offset_seconds=1.0, scores={"nude": 0.6, "prohibited": 0.1}, safe=False),
    ]

    assert peak_scores(frames) == {"nude": 0.6, "prohibited": 0.7}
