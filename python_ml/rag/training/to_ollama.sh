#!/usr/bin/env bash
# Convert a Hugging Face model directory to GGUF and register it with Ollama.
#
#   training/to_ollama.sh <hf-model-dir> <ollama-name> [quant]
#
# quant is optional (for example Q4_K_M for chat models); embeddings stay f16.
# Needs a llama.cpp checkout at LLAMA_CPP_DIR with its Python requirements
# installed, and llama-quantize on PATH when quant is set.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <hf-model-dir> <ollama-name> [quant]" >&2
  exit 1
fi

model_dir="$1"
name="$2"
quant="${3:-}"
llama_cpp="${LLAMA_CPP_DIR:-$HOME/Codes/llama.cpp}"

f16="$model_dir/$name-f16.gguf"
python "$llama_cpp/convert_hf_to_gguf.py" "$model_dir" --outtype f16 --outfile "$f16"

gguf="$f16"
if [[ -n "$quant" ]]; then
  gguf="$model_dir/$name-$quant.gguf"
  llama-quantize "$f16" "$gguf" "$quant"
fi

modelfile="$model_dir/Modelfile"
echo "FROM $gguf" > "$modelfile"
ollama create "$name" -f "$modelfile"
echo "Registered Ollama model $name from $gguf"
