import assert from "node:assert/strict";
import test from "node:test";
import { crc32 } from "node:zlib";
import { connectorSource, connectorVersion, connectorZip } from "../src/lib/wordpress/connector-package.js";

test("the connector points its updates at this dashboard and reports one version", async () => {
  const source = await connectorSource("https://dash.example/");
  assert.ok(!source.includes("__PN_DASHBOARD_URL__"));
  assert.match(source, /^ \* Update URI: https:\/\/dash\.example\/api\/connector\/info$/m);
  const version = connectorVersion(source);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(source.includes(`const PN_CONNECTOR_VERSION = '${version}';`), "header and constant versions match");
});

test("the zip holds the plugin inside a publishing-network folder", async () => {
  const source = await connectorSource("https://dash.example");
  const zip = connectorZip(source);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const size = zip.readUInt32LE(22);
  const nameLength = zip.readUInt16LE(26);
  assert.equal(zip.toString("utf8", 30, 30 + nameLength), "publishing-network/publishing-network.php");
  const data = zip.subarray(30 + nameLength, 30 + nameLength + size);
  assert.equal(data.toString("utf8"), source);
  assert.equal(zip.readUInt32LE(14), crc32(data));
  const end = zip.subarray(zip.length - 22);
  assert.equal(end.readUInt32LE(0), 0x06054b50);
  assert.equal(end.readUInt32LE(16) + end.readUInt32LE(12) + 22, zip.length, "central directory offset and size");
});
