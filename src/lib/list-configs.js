import { enumFilter, uuidFilter } from "./list-params";
import { ACTIVE_DRAFT_STATUSES } from "./draft-job-policy";

export const ARTICLE_LIST_FIELDS =
  "id, website_id, title, status, origin, category_id, sensitive, submitted_at, created_at, updated_at, published_at, scheduled_for, has_warnings, publication_status";

export const articleStatuses = ["all", "draft", "in_review", "approved", "published", "unpublished", "rejected"];
const origin = enumFilter("Origin", ["all", "manual", "automated"], "origin");
const category = uuidFilter("Category", "category_id");
const website = uuidFilter("Website");
const yesNo = (label, column) => enumFilter(label, ["all", "yes", "no"], column);

export const storyList = {
  sorts: { published: "source_published_at", discovered: "created_at", source: "source_name" },
  defaultSort: "published",
  search: ["title"],
  dateColumn: "created_at",
  filters: {
    website,
    source: uuidFilter("Source", "source_id"),
    kind: enumFilter("Source kind", ["all", "official", "news", "newsroom", "government", "api"]),
    status: enumFilter("Status", ["all", "new", "selected", "skipped", "used"], "status", "new"),
    automatic: yesNo("Auto-selected", "selected_automatically"),
  },
};
export const reviewList = {
  sorts: { submitted: "submitted_at", updated: "updated_at", title: "title" },
  defaultSort: "submitted",
  defaultDirection: "asc",
  search: ["title"],
  dateColumn: "submitted_at",
  filters: {
    website,
    category,
    status: enumFilter("Status", ["all", "in_review", "approved"], "status"),
    origin,
    sensitive: yesNo("Sensitive", "sensitive"),
    warnings: yesNo("Reviewer warnings", "has_warnings"),
  },
};
export const articleList = {
  sorts: { updated: "updated_at", published: "published_at", title: "title" },
  defaultSort: "updated",
  search: ["title"],
  dateColumn: "created_at",
  filters: {
    status: enumFilter("Status", articleStatuses, "status"),
    category,
    origin,
    publication: enumFilter("Publishing", ["all", "failed"], "publication_status"),
    scheduled: enumFilter("Scheduled", ["all", "yes", "no"]),
  },
};
export const globalArticleList = { ...articleList, filters: { website, ...articleList.filters } };
export const jobList = {
  sorts: { updated: "updated_at", created: "created_at" },
  defaultSort: "updated",
  search: ["story_title"],
  dateColumn: "created_at",
  filters: {
    website,
    status: {
      ...enumFilter(
        "Status",
        ["active", "all", "queued", "running", "failed", "succeeded", "cancelled"],
        "status",
        "active",
      ),
      groups: { active: ACTIVE_DRAFT_STATUSES },
    },
    step: enumFilter("Step", ["all", "collect", "research", "draft", "verify", "illustrate", "create_article"], "step"),
    waiting: enumFilter("Waiting for", ["all", "budget", "paused"], "waiting_kind"),
  },
};
export const websiteList = {
  legacyArchived: true,
  sorts: { name: "name", created: "created_at", last_published: "last_published_at" },
  defaultSort: "name",
  defaultDirection: "asc",
  search: ["name", "domain"],
  filters: {
    status: enumFilter("Status", ["active", "archived", "all"], undefined, "active"),
    niche: uuidFilter("Niche", "niche_id"),
    language: enumFilter("Language", ["all", "en", "ar"], "language"),
    problem: enumFilter("Needs attention", ["all", "budget", "traffic"], undefined),
  },
};
export const activityList = {
  sorts: { created: "created_at", action: "action" },
  defaultSort: "created",
  search: ["action"],
  dateColumn: "created_at",
  filters: {
    website,
    actor: uuidFilter("Actor", "actor_id"),
    entity: { ...uuidFilter("Article", "entity_id"), hidden: true },
    area: enumFilter("Area", [
      "all",
      "article",
      "website",
      "network",
      "user",
      "cost",
      "automation",
      "story",
      "niche",
      "source",
      "category",
    ]),
  },
};
export const userList = {
  sorts: { name: "full_name", email: "email", role: "role", joined: "created_at" },
  defaultSort: "email",
  defaultDirection: "asc",
  search: ["full_name", "email"],
  filters: {
    role: enumFilter("Role", ["all", "admin", "editor"], "role"),
    website: uuidFilter("Assigned website", "website_members.website_id"),
  },
};
export const alertList = {
  sorts: { created: "created_at", kind: "kind" },
  defaultSort: "created",
  search: ["message"],
  dateColumn: "created_at",
  filters: { website, kind: enumFilter("Kind", ["all", "budget", "slot", "publication", "job"], "kind") },
};
export const sourceList = {
  sorts: { name: "name", checked: "last_checked_at" },
  defaultSort: "name",
  defaultDirection: "asc",
  search: ["name", "url"],
  filters: {
    active: yesNo("Enabled", "active"),
    kind: enumFilter("Kind", ["all", "news", "newsroom", "government", "api"], "kind"),
    errors: enumFilter("Feed status", ["all", "errors"]),
  },
};
export const categoryList = {
  sorts: { order: "sort_order", name: "name" },
  defaultSort: "order",
  defaultDirection: "asc",
  search: ["name", "slug"],
  filters: { archived: enumFilter("Archived", ["all", "yes", "no"]) },
};
export const nicheList = {
  sorts: { order: "sort_order", name: "name" },
  defaultSort: "order",
  defaultDirection: "asc",
  search: ["name"],
  filters: {},
};
export const pageTrafficList = {
  sorts: { views: "page_views", clicks: "clicks", impressions: "impressions", path: "path", users: "users" },
  defaultSort: "views",
  search: ["path"],
  filters: {},
  tie: "path",
};
export const searchTrafficList = {
  sorts: { clicks: "clicks", impressions: "impressions", position: "position", query: "query", ctr: "ctr" },
  defaultSort: "clicks",
  search: ["query"],
  filters: {},
  tie: "query",
};
export const slotList = {
  sorts: { scheduled: "slot_at", status: "status" },
  defaultSort: "scheduled",
  dateColumn: "slot_at",
  filters: { status: enumFilter("Status", ["all", "problems", "running", "published", "skipped", "failed"]) },
};
