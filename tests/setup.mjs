// Lets plain Node load app modules: resolves "@/" imports and extensionless paths like Next.js does,
// treats src/ as ES modules and stubs "server-only". Used by `npm test`.
import { registerHooks } from "node:module";

const src = new URL("../src/", import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.js`, src).href, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[cm]?js$/.test(specifier) && context.parentURL?.startsWith(src)) {
      return next(`${specifier}.js`, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url.startsWith(src)
      ? { ...next(url, { ...context, format: "module" }), format: "module" }
      : next(url, context);
  },
});
