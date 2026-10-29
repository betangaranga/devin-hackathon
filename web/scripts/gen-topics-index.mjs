// Genera src/topics/index.ts importando todos los módulos de src/topics/*.ts.
// Así los temas se auto-descubren: agregar un archivo basta, sin editar listas.
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const topicsDir = join(dirname(fileURLToPath(import.meta.url)), "../src/topics");

const files = readdirSync(topicsDir)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .sort();

const imports = files
  .map((f, i) => `import t${i} from "./${f.replace(/\.ts$/, "")}";`)
  .join("\n");

const out = `// GENERADO por scripts/gen-topics-index.mjs — no editar a mano.
import type { TopicMeta } from "@/lib/topics";

${imports}

export const TOPICS: TopicMeta[] = [${files.map((_, i) => `t${i}`).join(", ")}];
export const SCORED_TOPICS = TOPICS.filter((t) => t.scored);
export const TOPIC_BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));
`;

writeFileSync(join(topicsDir, "index.ts"), out);
console.log(`topics/index.ts: ${files.length} temas (${files.join(", ")})`);
