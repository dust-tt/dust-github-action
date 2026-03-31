/**
 * @typedef {"EU" | "US"} Region
 */

const API_URLS = /** @type {const} */ ({
  EU: "https://eu.dust.tt",
  US: "https://dust.tt",
});

/**
 * @typedef Inputs
 * @property {string} method - The action method to run (e.g. "upsert-skills").
 * @property {string} workspaceId - The Dust workspace sId.
 * @property {string} apiKey - The Dust API key.
 * @property {string} apiUrl - The resolved Dust API base URL.
 */

export default class Config {
  /** @type {Inputs} */
  inputs;

  /** @type {import("@actions/core")} */
  core;

  /**
   * @param {import("@actions/core")} core
   */
  constructor(core) {
    this.core = core;

    const region = core.getInput("region", { required: true }).toUpperCase();
    if (region !== "EU" && region !== "US") {
      throw new Error(`Invalid region "${region}". Must be "EU" or "US".`);
    }

    this.inputs = {
      method: core.getInput("method", { required: true }),
      workspaceId: core.getInput("workspace-id", { required: true }),
      apiKey: core.getInput("api-key", { required: true }),
      apiUrl: API_URLS[region],
    };

    core.setSecret(this.inputs.apiKey);
  }
}
