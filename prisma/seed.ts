import { parseArgs } from "util";
import { seedDatabase, type SeedPreset } from "./seed/index";

const { values } = parseArgs({
  options: {
    preset: { type: "string", default: "demo" },
    size: { type: "string" },
  },
});

const preset = (values.size || values.preset || "demo") as SeedPreset;

seedDatabase(preset)
  .then(() => {
    console.log("Database seeded successfully");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
