import logging

from PIL import Image

log = logging.getLogger("vision")


def extract_frames(video_path: str, interval_sec: float, max_frames: int) -> list[Image.Image]:
    try:
        import cv2
    except ImportError:
        log.warning("opencv not available, video frame extraction skipped")
        return []
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    fps = cap.get(cv2.CAP_PROP_FPS) or 1.0
    interval_frames = max(1, int(fps * interval_sec))
    frames: list[Image.Image] = []
    frame_idx = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % interval_frames == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(rgb))
        frame_idx += 1
    cap.release()
    return frames
