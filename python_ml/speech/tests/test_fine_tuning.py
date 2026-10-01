import json

from training.eval_wer import error_rate, tokenize
from training.train_asr import absolutize_manifest, latest_checkpoint


def test_should_count_word_errors_for_spaced_text():
    assert error_rate([{"ref": "turn the lights on", "hyp": "turn lights on"}]) == 0.25


def test_should_count_character_errors_for_cjk_text():
    assert tokenize("打开灯。") == ["打", "开", "灯"]
    assert error_rate([{"ref": "打开灯", "hyp": "打开门"}]) == 1 / 3


def test_should_resolve_audio_paths_against_manifest_folder(tmp_path):
    source = tmp_path / "data" / "train.jsonl"
    source.parent.mkdir()
    source.write_text(json.dumps({"audio": "a.wav", "text": "hi"}) + "\n", encoding="utf-8")
    target = tmp_path / "abs.jsonl"

    assert absolutize_manifest(source, target, ["audio"]) == 1
    row = json.loads(target.read_text(encoding="utf-8"))
    assert row["audio"] == str((tmp_path / "data" / "a.wav").resolve())


def test_should_pick_highest_numbered_checkpoint(tmp_path):
    for name in ("checkpoint-200", "checkpoint-1000", "checkpoint-epoch-2"):
        (tmp_path / name).mkdir()

    assert latest_checkpoint(tmp_path).name == "checkpoint-1000"
