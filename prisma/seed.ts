import { parseArgs } from "util";
import { provisionDemoInvestigator, seedDatabase, type SeedPreset } from "./seed/index";

const { values } = parseArgs({
  options: {
    preset: { type: "string", default: "demo" },
    size: { type: "string" },
    userOnly: { type: "boolean", default: false },
  },
});

const preset = (values.size || values.preset || "demo") as SeedPreset;
const userOnly = values.userOnly;

const seedOperation = userOnly ? provisionDemoInvestigator() : seedDatabase(preset);

seedOperation
  .then(() => {
    console.log(userOnly ? "Demo investigator provisioned" : "Database seeded successfully");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
