import * as nodeOs from "node:os";
import type { BirthplaceHost } from "./birthplace";

/**
 * The subset of node:os used to describe the build machine. Tests inject a stub so
 * results do not depend on the machine running them.
 */
export interface HostProvider {
  arch(): string;
  cpus(): ReadonlyArray<{ model: string }>;
  totalmem(): number;
  endianness(): "BE" | "LE";
}

// OTel semantic conventions host.arch vocabulary (Development in 1.43.0). Node.js
// architectures without a semconv value (for example riscv64) pass through unchanged.
const SEMCONV_ARCH: Readonly<Record<string, string>> = {
  x64: "amd64",
  ia32: "x86",
  arm: "arm32",
  arm64: "arm64",
  ppc: "ppc32",
  ppc64: "ppc64",
  s390x: "s390x",
};

export const toSemconvArch = (arch: string): string =>
  Object.hasOwn(SEMCONV_ARCH, arch) ? SEMCONV_ARCH[arch] : arch;

/**
 * Describes the machine running the build. Only hardware facts are read: never the
 * username, home directory, shell, or host name.
 */
export const collectHost = (os: HostProvider = nodeOs): BirthplaceHost => {
  const host: BirthplaceHost = {};

  const arch = os.arch();
  if (arch.length > 0) {
    host.arch = toSemconvArch(arch);
  }

  // os.cpus() is empty on platforms where CPU information is unavailable; the CPU
  // fields are then omitted. The count is os.cpus().length rather than
  // os.availableParallelism() because the latter reports what this process may use
  // (CPU affinity, container limits), not what the machine has.
  const cpus = os.cpus();
  if (cpus.length > 0) {
    const modelName = cpus[0].model.trim();
    host.cpu = {
      ...(modelName.length === 0 ? {} : { model: { name: modelName } }),
      logical: { count: cpus.length },
    };
  }

  const totalMemory = os.totalmem();
  if (Number.isSafeInteger(totalMemory) && totalMemory > 0) {
    host.memory = { total: totalMemory };
  }

  host.endianness = os.endianness() === "BE" ? "big" : "little";
  return host;
};
