"""Render fixed prompts and seeds with and without the LoRA, side by side.

    python -m image_playground.training.compare_prompts --lora <dir> --prompts prompts.txt --out compare/
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Optional, Sequence

from PIL import Image


def side_by_side(left: Image.Image, right: Image.Image) -> Image.Image:
    height = max(left.height, right.height)
    canvas = Image.new("RGB", (left.width + right.width, height), "white")
    canvas.paste(left, (0, 0))
    canvas.paste(right, (left.width, 0))
    return canvas


def read_prompts(path: Path) -> List[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lora", required=True)
    parser.add_argument("--prompts", required=True, help="One prompt per line")
    parser.add_argument("--out", default="compare")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--steps", type=int, default=20)
    args = parser.parse_args(argv)

    import torch

    from image_playground import config
    from image_playground import service

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pipe = service.get_image_pipeline()
    pipe.load_lora_weights(args.lora, adapter_name="compare")
    for i, prompt in enumerate(read_prompts(Path(args.prompts))):
        images = []
        for enabled in (False, True):
            if enabled:
                pipe.enable_lora()
                pipe.set_adapters(["compare"], adapter_weights=[config.IMAGE_LORA_SCALE])
            else:
                pipe.disable_lora()
            generator = torch.Generator("cpu").manual_seed(args.seed)
            images.append(
                pipe(prompt, num_inference_steps=args.steps, generator=generator).images[0]
            )
        side_by_side(*images).save(out / f"{i:02d}.png")
        print(f"{out / f'{i:02d}.png'}: {prompt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
