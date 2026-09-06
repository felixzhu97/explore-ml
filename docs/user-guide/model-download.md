# 模型下载指南

← [用户手册首页](README.md)

本文说明如何下载 Explore ML 默认使用的本地权重，并放到 `LOCAL_MODELS_ROOT`
（默认 `$HOME/Codes/models`）。ML 选型与评估见 [Guideline](../Guideline.md)。

大权重**不入库**；下载后由各服务通过环境变量引用。

---

## 目录约定

在 `LOCAL_MODELS_ROOT` 下按能力分子目录：

```text
$LOCAL_MODELS_ROOT/
├── asr/models/Qwen3-ASR-1.7B/
├── tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice/
├── image/models/Qwen-Image/
└── rerank/models/Qwen3-Reranker-8B/
```

| 能力 | Hugging Face / ModelScope id | 本地子路径 | 服务 |
| ---- | ---------------------------- | ---------- | ---- |
| ASR | `Qwen/Qwen3-ASR-1.7B` | `asr/models/Qwen3-ASR-1.7B` | Media Gen |
| TTS | `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` | `tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice` | Media Gen |
| 文生图 | `Qwen/Qwen-Image` | `image/models/Qwen-Image` | Media Gen |
| 精排 | `Qwen/Qwen3-Reranker-8B` | `rerank/models/Qwen3-Reranker-8B` | RAG sidecar |

Ollama 模型（如 embedding / LLM）仍用 `ollama pull`，落在 `~/.ollama`，不在此树。

---

## 工具准备

任选其一（国内网络优先 ModelScope）：

```bash
# Hugging Face CLI
pip install -U "huggingface_hub[cli]"

# 或 ModelScope
pip install -U modelscope
```

可选镜像（Hugging Face）：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

设置根目录：

```bash
export LOCAL_MODELS_ROOT="${LOCAL_MODELS_ROOT:-$HOME/Codes/models}"
mkdir -p "$LOCAL_MODELS_ROOT"/{asr,tts,image,rerank}/models
```

---

## 下载命令

### ASR — Qwen3-ASR-1.7B

```bash
# Hugging Face
huggingface-cli download Qwen/Qwen3-ASR-1.7B \
  --local-dir "$LOCAL_MODELS_ROOT/asr/models/Qwen3-ASR-1.7B"

# 或 ModelScope
modelscope download --model Qwen/Qwen3-ASR-1.7B \
  --local_dir "$LOCAL_MODELS_ROOT/asr/models/Qwen3-ASR-1.7B"
```

文档：[Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)

### TTS — Qwen3-TTS-12Hz-1.7B-CustomVoice

```bash
huggingface-cli download Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice \
  --local-dir "$LOCAL_MODELS_ROOT/tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice"

# 或
modelscope download --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice \
  --local_dir "$LOCAL_MODELS_ROOT/tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice"
```

文档：[Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)

### 文生图 — Qwen-Image

体积较大，首次下载较久。

```bash
huggingface-cli download Qwen/Qwen-Image \
  --local-dir "$LOCAL_MODELS_ROOT/image/models/Qwen-Image"

# 或
modelscope download --model Qwen/Qwen-Image \
  --local_dir "$LOCAL_MODELS_ROOT/image/models/Qwen-Image"
```

文档：[Qwen-Image](https://huggingface.co/Qwen/Qwen-Image)

### 精排 — Qwen3-Reranker-8B

```bash
huggingface-cli download Qwen/Qwen3-Reranker-8B \
  --local-dir "$LOCAL_MODELS_ROOT/rerank/models/Qwen3-Reranker-8B"

# 或
modelscope download --model Qwen/Qwen3-Reranker-8B \
  --local_dir "$LOCAL_MODELS_ROOT/rerank/models/Qwen3-Reranker-8B"
```

文档：[Qwen3-Reranker-8B](https://huggingface.co/Qwen/Qwen3-Reranker-8B)

也可用 Python：

```bash
python - <<'PY'
import os
from modelscope import snapshot_download
root = os.path.expanduser(os.environ.get("LOCAL_MODELS_ROOT", "~/Codes/models"))
path = snapshot_download(
    "Qwen/Qwen3-Reranker-8B",
    local_dir=os.path.join(root, "rerank/models/Qwen3-Reranker-8B"),
)
print(path)
PY
```

---

## 下载后如何接到服务

| 服务 | 相关环境变量 | 说明 |
| ---- | ------------ | ---- |
| Media Gen | `LOCAL_MODELS_ROOT`, `IMAGE_MODEL`, `TTS_MODEL`, `ASR_MODEL` | 默认解析到上表子路径；可改为其他本地目录或 HF id |
| Media Gen | `IMAGE_BACKEND=sd`, `VOICE_BACKEND=edge` | 不用本地 Qwen 时的替代后端 |
| RAG | `RERANK_MODEL`, `RERANK_URL` | 权重路径 + `python serve.py --port 8091`（在已下载的 `rerank/` 工具环境中） |

启动 Media Gen / RAG 前确认对应目录存在且含 `config.json`（或 Diffusers 的 `model_index.json`）。

精排 sidecar：

```bash
# 在含 transformers 的 venv 中，cwd 指向你的 rerank 工具目录亦可
python serve.py --port 8091 --model "$LOCAL_MODELS_ROOT/rerank/models/Qwen3-Reranker-8B"
```

（若使用仓库外的 `~/Codes/models/rerank/serve.py`，按该脚本的 `--model` 默认即可。）

---

## Ollama（embedding / LLM）

RAG 默认 embedding / chat 走 Ollama，与上述 Qwen 权重树分离：

```bash
ollama pull nomic-embed-text
ollama pull qwen3-coder:30b   # 或你选用的 LLM
```

---

## 校验清单

| 检查 | 命令或现象 |
| ---- | ---------- |
| 目录非空 | `ls "$LOCAL_MODELS_ROOT/asr/models/Qwen3-ASR-1.7B"` 可见 `config.json` |
| ASR 冒烟 | `POST http://localhost:8003/api/v1/audios:transcribe` 上传 wav |
| 精排健康 | `curl -s http://127.0.0.1:8091/health` |
| 缺权重 | 服务日志报 missing path / download error，而非静默空结果 |

---

## 相关文档

- [Guideline](../Guideline.md) — ML 实践
- [Media Gen README](../../python_ml/media-gen/README.md)
- [RAG README](../../python_ml/rag/README.md)
- [旁路上游接入](sibling-integration.md)
