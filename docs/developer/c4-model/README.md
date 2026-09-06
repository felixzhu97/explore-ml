# C4 model — Explore ML

PlantUML sources for system context, containers, components, and local
deployment. Render:

```bash
cd docs/developer/c4-model && docker run --rm -v "$PWD":/data plantuml/plantuml -tpng -o png '*.puml'
```

| Diagram | File |
| ------- | ---- |
| C1 Context | [C1-Context.puml](./C1-Context.puml) |
| C2 Container | [C2-Container.puml](./C2-Container.puml) |
| C3 Component | [C3-Component.puml](./C3-Component.puml) |
| Deployment | [C4-Deployment.puml](./C4-Deployment.puml) |

## Runtime defaults

| Surface | Port |
| ------- | ---- |
| recommendation | `:8000` |
| vision | `:8001` |
| rag | `:8002` |
| media-gen | `:8003` |

Sibling product APIs keep their own loopback upstream URLs pointed at these
ports.
