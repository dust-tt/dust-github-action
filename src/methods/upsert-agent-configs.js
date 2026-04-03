import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import Config from "../config.js";
import { fetchWithRetry } from "../utils/fetch.js";

/**
 * Parses the agent-configs input (YAML list serialized by GitHub Actions
 * as a newline-separated string with "- " prefixes) into glob patterns,
 * then resolves them to concrete file paths.
 * @param {string} input
 * @returns {string[]}
 */
function resolveYamlPaths(input) {
  const patterns = input
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  if (patterns.length === 0) {
    throw new Error("No glob patterns provided in agent-configs.");
  }

  const files = patterns.flatMap((pattern) => {
    const matches = fs.globSync(pattern);
    if (matches.length === 0) {
      throw new Error(`No files matched pattern: ${pattern}`);
    }
    return matches;
  });

  const yamlFiles = [...new Set(files)]
    .filter((f) => /\.ya?ml$/i.test(f))
    .map((f) => path.resolve(f));

  if (yamlFiles.length === 0) {
    throw new Error("No YAML agent configuration files found.");
  }

  return yamlFiles;
}

/**
 * @param {string} apiUrl
 * @param {string} workspaceId
 */
function agentConfigsBaseUrl(apiUrl, workspaceId) {
  return `${apiUrl}/api/v1/w/${workspaceId}/assistant/agent_configurations`;
}

/**
 * @param {string} apiKey
 */
function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Search for an existing agent by exact handle match.
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {string} handle
 * @param {import("@actions/core")} core
 * @returns {Promise<string | null>} The agent sId if found, null otherwise.
 */
async function findAgentByHandle(baseUrl, apiKey, handle, core) {
  const data = await fetchWithRetry(
    `${baseUrl}/search?q=${encodeURIComponent(handle)}`,
    { method: "GET", headers: authHeaders(apiKey) },
    core
  );

  const match = data.agentConfigurations?.find((a) => a.name === handle);
  return match?.sId ?? null;
}

/**
 * Upserts agent configurations from YAML files to a Dust workspace.
 * @param {Config} config
 */
export default async function upsertAgentConfigs(config) {
  const { core } = config;
  const { agentConfigs, apiUrl, workspaceId, apiKey } = config.inputs;

  if (!agentConfigs) {
    throw new Error(
      'The "agent-configs" input is required for the upsert-agent-configs method.'
    );
  }

  const files = resolveYamlPaths(agentConfigs);
  core.info(`Found ${files.length} YAML file(s) to sync.`);

  const baseUrl = agentConfigsBaseUrl(apiUrl, workspaceId);
  const headers = authHeaders(apiKey);

  const imported = [];
  const updated = [];
  const errored = [];

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    let parsed;
    try {
      const content = fs.readFileSync(file, "utf-8");
      parsed = yaml.load(content);
    } catch (err) {
      errored.push({
        file: relativePath,
        message: `YAML parse error: ${err.message}`,
      });
      continue;
    }

    const handle = parsed?.agent?.handle;
    if (!handle) {
      errored.push({
        file: relativePath,
        message: "Missing agent.handle field.",
      });
      continue;
    }

    try {
      const existingId = await findAgentByHandle(
        baseUrl,
        apiKey,
        handle,
        core
      );

      if (existingId) {
        core.info(`  Updating existing agent "${handle}" (${existingId})...`);
        await fetchWithRetry(
          `${baseUrl}/${existingId}`,
          { method: "PATCH", headers, body: JSON.stringify(parsed) },
          core
        );
        updated.push({ name: handle, file: relativePath });
      } else {
        core.info(`  Creating new agent "${handle}"...`);
        await fetchWithRetry(
          `${baseUrl}/import`,
          { method: "POST", headers, body: JSON.stringify(parsed) },
          core
        );
        imported.push({ name: handle, file: relativePath });
      }
    } catch (err) {
      errored.push({
        file: relativePath,
        message: `${handle}: ${err.message}`,
      });
    }
  }

  core.setOutput("json", JSON.stringify({ imported, updated, errored }));
  core.setOutput("imported", imported.length);
  core.setOutput("updated", updated.length);

  core.notice(
    `Synced agent configs: imported ${imported.length}, updated ${updated.length}, errored ${errored.length}`
  );

  for (const agent of imported) {
    core.info(`  + ${agent.name} (${agent.file})`);
  }
  for (const agent of updated) {
    core.info(`  ~ ${agent.name} (${agent.file})`);
  }
  for (const err of errored) {
    core.warning(`${err.file}: ${err.message}`);
  }
}
