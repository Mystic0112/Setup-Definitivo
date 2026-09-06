import { execa } from "execa";
import { ADAPTERS } from "../adapters/index.js";
import { CATALOG } from "../registry/items.js";
import { HarnessSchema, type Item } from "../registry/schema.js";

async function hasBin(bin: string): Promise<boolean> {
  try {
    await execa(bin, ["--version"], { stdio: "ignore", timeout: 3000 });
    return true;
  } catch (err) {
    return (err as { code?: string }).code !== "ENOENT";
  }
}

async function detectHarness(harness: (typeof HarnessSchema.options)[number]): Promise<boolean> {
  const adapter = ADAPTERS[harness];
  if (!adapter) return false;

  try {
    return await adapter.detect("global");
  } catch {
    return false;
  }
}

export async function runDoctor(): Promise<void> {
  console.log("\nSetup Definitivo — doctor\n");

  console.log("Binários:");
  let failed = false;
  for (const bin of ["node", "git", "uv", "claude"]) {
    const ok = await hasBin(bin);
    if (!ok) failed = true;
    console.log(`  ${ok ? "✓" : "✗"} ${bin}`);
  }

  console.log("\nHarnesses (adapter + detecção):");
  let detectedHarnesses = 0;
  for (const harness of HarnessSchema.options) {
    const adapter = ADAPTERS[harness];
    if (!adapter) {
      console.log(`  ○ ${harness}: adapter não implementado`);
      continue;
    }
    const detected = await detectHarness(harness);
    if (detected) detectedHarnesses += 1;
    console.log(
      `  ${detected ? "✓" : "·"} ${harness}: adapter implementado · ${
        detected ? "detectado (global)" : "não detectado (global)"
      }`
    );
  }

  if (detectedHarnesses === 0) failed = true;

  const counts = CATALOG.reduce<Partial<Record<Item["kind"], number>>>((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1;
    return result;
  }, {});
  console.log("\nCatálogo:");
  for (const kind of ["mcp", "skill", "tool", "config"] as const) {
    console.log(`  ${counts[kind] ?? 0} ${kind}`);
  }

  console.log("\nDica: 'setup-definitivo init' para configurar.\n");
  if (failed) process.exitCode = 1;
}
