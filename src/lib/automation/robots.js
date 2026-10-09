import { USER_AGENT } from "./public-fetch";

/** robots.txt rules for our bot (or "*"); the longest matching Allow/Disallow path wins. */
export function robotsAllows(robotsTxt, path) {
  const groups = [];
  let current = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const [field, ...rest] = raw.replace(/#.*/, "").split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow") && value)
      current.rules.push({ allow: key === "allow", path: value });
  }
  const ours = groups.filter((group) =>
    group.agents.some((agent) => agent && USER_AGENT.toLowerCase().startsWith(agent)),
  );
  const rules = (ours.length ? ours : groups.filter((group) => group.agents.includes("*"))).flatMap(
    (group) => group.rules,
  );
  const matches = (rule) =>
    new RegExp(
      `^${rule.path
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$")}`,
    ).test(path);
  const best = rules
    .filter(matches)
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))[0];
  return !best || best.allow;
}

export async function allowedByRobots(url, requestImpl, cache) {
  if (!cache.has(url.origin)) {
    cache.set(
      url.origin,
      requestImpl(new URL("/robots.txt", url.origin), 5_000).then(
        (response) => (response.status === 200 ? response.body : ""),
        () => "",
      ),
    );
  }
  return robotsAllows(await cache.get(url.origin), url.pathname + url.search);
}
