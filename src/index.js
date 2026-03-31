import * as core from "@actions/core";
import Config from "./config.js";
import upsertSkills from "./methods/upsert-skills.js";

try {
  const config = new Config(core);

  switch (config.inputs.method) {
    case "upsert-skills":
      await upsertSkills(config);
      break;
    default:
      throw new Error(
        `Unknown method "${config.inputs.method}". Supported: upsert-skills`,
      );
  }
} catch (error) {
  if (error instanceof Error) {
    core.setFailed(error.message);
  } else {
    core.setFailed(`${error}`);
  }
}
