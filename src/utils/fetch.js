const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Fetch with exponential backoff retry on server errors.
 * @param {string} url
 * @param {RequestInit} options
 * @param {import("@actions/core")} core
 * @returns {Promise<any>}
 */
export async function fetchWithRetry(url, options, core) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, options);

    if (response.ok) {
      return await response.json();
    }

    if (response.status < 500 && response.status !== 429) {
      const body = await response.text();
      throw new Error(`API error (${response.status}): ${body}`);
    }

    if (attempt < MAX_RETRIES) {
      const delayMs = BASE_DELAY_MS * 2 ** attempt;
      core.info(
        `Request failed (${response.status}), retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } else {
      const body = await response.text();
      throw new Error(
        `API error (${response.status}) after ${MAX_RETRIES} retries: ${body}`,
      );
    }
  }
}
