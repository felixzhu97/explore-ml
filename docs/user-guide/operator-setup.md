# 本地运维 — 启动指南

← [用户手册首页](README.md)

本文说明如何在本机安装并启动 Explore ML 四个旁路上游服务。

---

## 前置条件

| 工具 | 说明 |
| ---- | ---- |
| Python | 3.11+ |
| Git | 克隆本仓库 |
| 可选 Redis | Recommendation Celery 任务 |
| 可选 Ollama | RAG 本地 embedding / LLM |
| 可选 GPU / MPS | Media Gen 与本地 Qwen 推理 |

本地权重按 [模型下载指南](model-download.md) 下载到 `LOCAL_MODELS_ROOT`（默认 `$HOME/Codes/models`）。

---

## 服务与端口

| 服务 | 目录 | 默认端口 | 环境变量（端口） |
| ---- | ---- | -------- | ---------------- |
| Recommendation | `python_ml/recommendation` | 8000 | `PORT` / `RECOMMENDATION_PORT` |
| Vision | `python_ml/vision` | 8001 | `VISION_PORT` |
| RAG | `python_ml/rag` | 8002 | `PORT` |
| Media Gen | `python_ml/media-gen` | 8003 | `MEDIA_GEN_PORT` / `PORT` |

---

## 启动步骤

对每个需要的服务重复：

```bash
cd python_ml/<name>
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 按需编辑 .env
uvicorn main:app --host 0.0.0.0 --port <上表端口>
```

| 检查 | 示例 |
| ---- | ---- |
| Recommendation | `curl -s http://localhost:8000/health` |
| Vision | `curl -s http://localhost:8001/health` |
| RAG | `curl -s http://localhost:8002/health` |
| Media Gen | `curl -s http://localhost:8003/health` |

Swagger 一般在 `http://localhost:<port>/docs`。

---

## 测试

```bash
cd python_ml/<name>
pytest
```

---

## 常见问题

| 情况 | 建议 |
| ---- | ---- |
| 端口已被占用 | 改 `.env` 中端口，并同步兄弟产品 upstream URL |
| Media Gen 找不到本地权重 | 按 [模型下载指南](model-download.md) 补齐权重，或改 backend / `ASR_MODEL` |
| RAG 精排无效果 | 先启动 rerank sidecar，或设 `RERANK_ENABLED=false` |
| macOS 视频生成失败 | 需显式 `MEDIA_VIDEO_FORCE_LOCAL=1`，或跳过视频能力 |

准则见 [Guideline](../Guideline.md)；接入见 [旁路上游接入](sibling-integration.md)。
