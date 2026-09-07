import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_EXAMPLE_SOURCES } from "../src/engine/examples/projectSources";

export function writeExampleProjects(root: string = process.cwd()): string[] {
  const written: string[] = [];
  for (const { file, build } of PROJECT_EXAMPLE_SOURCES) {
    writeFileSync(join(root, "examples", file), `${JSON.stringify(build(), null, 2)}\n`);
    written.push(file);
  }
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for (const file of writeExampleProjects()) {
    console.log(file);
  }
}
