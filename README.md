# Dust GitHub Action

A GitHub Action to interact with your [Dust](https://dust.tt) workspace.

## Methods

### `upsert-skills`

Syncs [Agent Skills](https://agentskills.io/specification) from the repository to Dust. Finds `SKILL.md` files, packages their directories into a ZIP, and uploads it.

```yaml
- uses: dust-tt/dust-github-action@v1
  with:
    method: upsert-skills
    workspace-id: ${{ vars.DUST_WORKSPACE_ID }}
    api-key: ${{ secrets.DUST_API_KEY }}
    region: EU
```

### `upsert-agent-configs`

Upserts agent configurations from YAML files in the repository to Dust. Searches for existing agents by handle name — updates them if found, creates new ones otherwise.

```yaml
- uses: dust-tt/dust-github-action@v1
  with:
    method: upsert-agent-configs
    workspace-id: ${{ vars.DUST_WORKSPACE_ID }}
    api-key: ${{ secrets.DUST_API_KEY }}
    region: EU
    agent-configs: |
      configs/agent-*.yaml
      agent-*.yml
```

The `agent-configs` input accepts a list of glob patterns matching YAML agent configuration files.

Each YAML file must follow the [Dust agent configuration schema](https://docs.dust.tt) with at minimum an `agent.handle` field.

## Common inputs

| Input | Required | Description |
|---|---|---|
| `method` | yes | Action to perform |
| `workspace-id` | yes | Dust workspace sId |
| `api-key` | yes | Dust API key |
| `region` | yes | Workspace region (`EU` or `US`) |
| `agent-configs` | no | [upsert-agent-configs] List of glob patterns for YAML agent config files |

## Common outputs

| Output | Description |
|---|---|
| `json` | Raw JSON response from the Dust API |

## Full example

```yaml
name: Sync Skills to Dust

on:
  push:
    branches: [main]
    paths:
      - "skills/**"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Sync skills
        uses: dust-tt/dust-github-action@v1
        with:
          method: upsert-skills
          workspace-id: ${{ vars.DUST_WORKSPACE_ID }}
          api-key: ${{ secrets.DUST_API_KEY }}
          region: EU
```

## Skill format

Each skill lives in its own directory with a `SKILL.md` file ([spec](https://agentskills.io/specification)):

```
skills/
  review-pr/
    SKILL.md
    template.md       # optional attachment
  summarize/
    SKILL.md
```

`SKILL.md` uses YAML frontmatter for metadata and the body as instructions:

```markdown
---
name: Review PR
description: Reviews pull requests for code quality and correctness
---

You are a code reviewer. When asked to review a PR, analyze the diff for:
- Correctness
- Performance
- Security
```

## Development

```bash
npm install
npm run build    # compiles to dist/ via @vercel/ncc
npm run check    # type-check with tsc
npm test         # run tests
```

`dist/` is gitignored and built automatically on release via the publish workflow.
