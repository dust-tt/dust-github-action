import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { fetchWithRetry } from "../utils/fetch.js";

const MAX_ZIP_SIZE_MB = 5;

/**
 * Zips the current directory and uploads to Dust.
 * The API handles SKILL.md detection.
 * @param {Config} config
 */
export default async function upsertSkills(config) {
  const { core } = config;

  const zip = new AdmZip();
  addDirectoryToZip(zip, ".", ".");
  const zipBuffer = zip.toBuffer();

  if (zipBuffer.length > MAX_ZIP_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `ZIP is ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB, exceeding the ${MAX_ZIP_SIZE_MB} MB limit.`
    );
  }

  core.info(`Uploading ${(zipBuffer.length / 1024).toFixed(0)} KB ZIP.`);

  const { apiUrl, workspaceId, apiKey } = config.inputs;

  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const form = new FormData();
  form.append("files", blob, "skills.zip");

  const data = await fetchWithRetry(
    `${apiUrl}/api/v1/w/${workspaceId}/skills`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
    core
  );

  const importedCount = data.imported?.length ?? 0;
  const updatedCount = data.updated?.length ?? 0;
  const erroredCount = data.errored?.length ?? 0;

  core.setOutput("json", JSON.stringify(data));
  core.setOutput("imported", importedCount);
  core.setOutput("updated", updatedCount);

  core.notice(
    `Synced skills: imported ${importedCount}, updated ${updatedCount}, errored ${erroredCount}`
  );

  for (const skill of data.imported ?? []) {
    core.info(`  + ${skill.name}`);
  }
  for (const skill of data.updated ?? []) {
    core.info(`  ~ ${skill.name}`);
  }
  for (const err of data.errored ?? []) {
    core.warning(`Skill ${err.name}: ${err.message}`);
  }
}

/**
 * Recursively adds a directory's contents to an AdmZip instance,
 * skipping .git and node_modules.
 * @param {AdmZip} zip
 * @param {string} dirPath - Path on disk (relative to cwd).
 * @param {string} zipPath - Path inside the ZIP.
 */
function addDirectoryToZip(zip, dirPath, zipPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const entryPath = path.join(dirPath, entry.name);
    const entryZipPath = path.join(zipPath, entry.name);
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, entryPath, entryZipPath);
    } else {
      zip.addFile(entryZipPath, fs.readFileSync(entryPath));
    }
  }
}
