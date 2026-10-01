import logging

from PIL import Image

logger = logging.getLogger("vision")


def extract_frames(
    video_path: str, interval_sec: float, max_frames: int
) -> list[tuple[float, Image.Image]]:
    """Sampled frames with their offset in seconds from the start of the video."""
    try:
        import cv2
    except ImportError:
        logger.warning("opencv not available, video frame extraction skipped")
        return []
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return []
    frames_per_second = capture.get(cv2.CAP_PROP_FPS) or 1.0
    interval_frames = max(1, int(frames_per_second * interval_sec))
    frames: list[tuple[float, Image.Image]] = []
    frame_index = 0
    while len(frames) < max_frames:
        has_frame, frame = capture.read()
        if not has_frame:
            break
        if frame_index % interval_frames == 0:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append((frame_index / frames_per_second, Image.fromarray(rgb_frame)))
        frame_index += 1
    capture.release()
    return frames
