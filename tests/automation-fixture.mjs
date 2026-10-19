// In-memory query adapter for worker tests; all network and database writes stay in the fixture.
export function automationFixture(tables) {
  const rpcCalls = [];
  const db = {
    tables,
    rpcCalls,
    from(table) {
      const filters = [];
      let patch;
      let insert;
      let bounds = [0, Infinity];
      let single = false;
      const valueAt = (row, key) => key.split(".").reduce((value, part) => value?.[part], row);
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters.push((row) => valueAt(row, key) === value);
          return query;
        },
        neq(key, value) {
          filters.push((row) => valueAt(row, key) !== value);
          return query;
        },
        is(key, value) {
          return query.eq(key, value);
        },
        gte(key, value) {
          filters.push((row) => row[key] >= value);
          return query;
        },
        in(key, values) {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        not(key, _operator, value) {
          filters.push((row) => row[key] !== value);
          return query;
        },
        or(expression) {
          const since = expression.split("created_at.gte.")[1];
          filters.push((row) => row.status === "selected" || row.created_at >= since);
          return query;
        },
        order() {
          return query;
        },
        range(start, end) {
          bounds = [start, end];
          return query;
        },
        limit(limit) {
          bounds = [0, limit - 1];
          return query;
        },
        single() {
          single = true;
          return query;
        },
        update(input) {
          patch = input;
          return query;
        },
        upsert(input) {
          insert = input;
          return query;
        },
        then(resolve, reject) {
          try {
            if (
              insert &&
              !tables[table].some(
                (row) => row.website_id === insert.website_id && row.fingerprint === insert.fingerprint,
              )
            )
              tables[table].push({
                ...insert,
                id: `inserted-${tables[table].length}`,
                created_at: new Date().toISOString(),
              });
            let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
            if (insert) rows = rows.filter((row) => row.fingerprint === insert.fingerprint);
            if (patch) rows.forEach((row) => Object.assign(row, patch));
            const count = rows.length;
            rows = rows.slice(bounds[0], bounds[1] + 1);
            return Promise.resolve({ data: single ? rows[0] : rows, count, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return query;
    },
    async rpc(name, input) {
      rpcCalls.push({ name, input });
      if (name === "auto_select_stories") {
        for (const row of tables.story_candidates.filter((row) => input.ranked_stories.includes(row.id))) {
          row.status = "selected";
          row.selected_automatically = true;
        }
        return { data: input.ranked_stories.length, error: null };
      }
      if (name === "queue_story_draft") {
        const story = tables.story_candidates.find((row) => row.id === input.target_story);
        tables.jobs.push({ id: `job-${story.id}`, story_id: story.id, website_id: story.website_id, status: "queued" });
        return { data: `job-${story.id}`, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  return db;
}
