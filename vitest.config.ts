import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Isola os backups da CLI num tmp durante os testes, para não escrever no
// ~/.setup-definitivo real da máquina de quem roda a suíte.
export default defineConfig({
  test: {
    env: {
      SETUP_DEFINITIVO_HOME: path.join(os.tmpdir(), "setup-definitivo-test-home"),
    },
  },
});
