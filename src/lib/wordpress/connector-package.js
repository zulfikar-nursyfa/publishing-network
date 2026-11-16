import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";

export const CONNECTOR_SOURCE = "wordpress/plugins/publishing-network/publishing-network.php";
const ZIP_ENTRY = "publishing-network/publishing-network.php";

/** The connector's PHP with this dashboard's address filled in, so installed copies update from here. */
export async function connectorSource(dashboardUrl) {
  const source = await readFile(path.join(process.cwd(), CONNECTOR_SOURCE), "utf8");
  return source.replaceAll("__PN_DASHBOARD_URL__", dashboardUrl.replace(/\/+$/, ""));
}

export function connectorVersion(source) {
  return source.match(/^ \* Version:\s*(\S+)/m)?.[1] ?? null;
}

/** The installable plugin zip: one file inside a publishing-network/ folder, as WordPress expects. */
export function connectorZip(source) {
  return storedZip(ZIP_ENTRY, Buffer.from(source, "utf8"));
}

// Single uncompressed entry; WordPress's ZipArchive and PclZip both read it. Fixed 1980-01-01 timestamp.
function storedZip(name, data) {
  const fileName = Buffer.from(name, "utf8");
  const crc = crc32(data);
  const shared = (header) => {
    header.writeUInt16LE(0x0800, 0); // UTF-8 names
    header.writeUInt16LE(0, 2); // stored
    header.writeUInt16LE(0, 4); // time
    header.writeUInt16LE(0x21, 6); // date
    header.writeUInt32LE(crc, 8);
    header.writeUInt32LE(data.length, 12);
    header.writeUInt32LE(data.length, 16);
    header.writeUInt16LE(fileName.length, 20);
    return header;
  };

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  shared(local.subarray(6)).writeUInt16LE(0, 22); // extra length

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  shared(central.subarray(8)); // extra, comment, disk, attributes and offset stay 0

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(local.length + fileName.length + data.length, 16);

  return Buffer.concat([local, fileName, data, central, fileName, end]);
}
