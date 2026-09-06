# Explore ML 用户手册

面向本地运维与兄弟产品接入说明。架构见 [C4 模型](../developer/c4-model/README.md)；术语见 [Glossary](../Glossary.md)；集成准则见 [Guideline](../Guideline.md)。

---

## 介绍

Explore ML 提供可选的 Python FastAPI **旁路上游**（Loopback Upstream）：推荐、视觉审核、RAG、媒体生成。产品客户端只访问兄弟应用的 API；由 Spring（或其他后端）在本机回环调用这些服务。

| 组件 | 说明 |
| ---- | ---- |
| Recommendation | Feed / Explore / Reels 排序与建议 |
| Vision | 图像标签与内容审核 |
| RAG | 文档索引、检索与问答 |
| Media Gen | 文生图、视频、语音合成、ASR |
| Local Models Root | 通过 [模型下载指南](model-download.md) 获取的权重根目录（`LOCAL_MODELS_ROOT`） |

---

## 按角色阅读

| 您是… | 请阅读 | 您将了解到 |
| ----- | ------ | ---------- |
| 本地运维 / 开发者 | [本地启动指南](operator-setup.md) | 如何安装依赖、启动四个服务并做健康检查 |
| 兄弟产品后端开发者 | [旁路上游接入](sibling-integration.md) | 端口、环境变量、代理约定 |
| 模型与推理运维 | [模型下载指南](model-download.md) | 下载 Qwen 权重、目录约定、接到服务 |

原则与边界见 [Guideline](../Guideline.md)；本手册侧重可操作步骤。

---

## 本地开发环境

| 服务 | 地址 | 说明 |
| ---- | ---- | ---- |
| Recommendation | http://localhost:8000 | 推荐 / 排序 |
| Vision | http://localhost:8001 | 视觉标签与审核 |
| RAG | http://localhost:8002 | 检索增强问答 |
| Media Gen | http://localhost:8003 | 图像 / 视频 / 语音 / ASR |
| Rerank sidecar（可选） | http://127.0.0.1:8091 | 精排 HTTP；权重见 [模型下载指南](model-download.md) |

启动示例（任选一个服务）：

```bash
cd python_ml/recommendation   # 或 vision / rag / media-gen
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000   # 按上表改端口
```

健康检查通常为 `GET /health`（以各服务 README 为准）。

---

## 文档说明

- Preferred Term 以 [Glossary](../Glossary.md) 为准；ML 实践以 [Guideline](../Guideline.md) 为准。
- 大权重不入库，按 [模型下载指南](model-download.md) 获取；小样例放在仓库根目录 `data/`。
- 默认端口为连续的 `8000`–`8003`；若兄弟产品仍指向旧的 media-gen `:3456`，请改为 `:8003`。
