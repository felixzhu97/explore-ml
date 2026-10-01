"""Score answers from Ollama models against references with an LLM judge.

Each line is JSON: {"question": "...", "reference": "...", "context": "optional"}.
The judge rates every answer from 1 to 5; the script prints the mean per model.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence

JUDGE_PROMPT = """Rate the answer against the reference from 1 (wrong or unsupported)
to 5 (correct, complete, and faithful to the context). Reply with the number only.

Question: {question}
Context: {context}
Reference: {reference}
Answer: {answer}"""


def parse_score(text: str) -> Optional[int]:
    match = re.search(r"[1-5]", text)
    return int(match.group()) if match else None


def build_question(row: Dict[str, str]) -> str:
    context = row.get("context")
    if not context:
        return row["question"]
    return f"Answer using only this context.\n\nContext:\n{context}\n\nQuestion: {row['question']}"


def evaluate(client, model: str, judge: str, rows: List[Dict[str, str]]) -> float:
    scores = []
    for row in rows:
        answer = client.chat(
            model=model, messages=[{"role": "user", "content": build_question(row)}]
        )["message"]["content"]
        verdict = client.chat(
            model=judge,
            messages=[{
                "role": "user",
                "content": JUDGE_PROMPT.format(
                    question=row["question"],
                    context=row.get("context", ""),
                    reference=row["reference"],
                    answer=answer,
                ),
            }],
        )["message"]["content"]
        score = parse_score(verdict)
        if score is not None:
            scores.append(score)
    return sum(scores) / len(scores) if scores else 0.0


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--questions", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--baseline")
    parser.add_argument("--judge", help="Defaults to the baseline, then the model")
    parser.add_argument("--host", default="http://localhost:11434")
    args = parser.parse_args(argv)

    from ollama import Client

    client = Client(host=args.host)
    lines = Path(args.questions).read_text(encoding="utf-8").splitlines()
    rows = [json.loads(line) for line in lines if line.strip()]
    judge = args.judge or args.baseline or args.model
    result = {args.model: evaluate(client, args.model, judge, rows)}
    if args.baseline:
        result[args.baseline] = evaluate(client, args.baseline, judge, rows)
    print(json.dumps({"judge": judge, "mean_score": result}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
