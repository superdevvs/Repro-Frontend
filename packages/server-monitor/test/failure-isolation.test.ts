import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { diskReadings } from "../src/collectors/host.js";
import { configSchema } from "../src/config.js";
import { Rpc } from "../src/ai/rpc.js";

const cfg = configSchema.parse({});
const mounts = [
  { target: "/", source: "/dev/nvme0n1p2", uuid: "root", fstype: "ext4" },
  { target: "/mnt/16tb", source: "/dev/sda", uuid: cfg.expectedMediaUuid, fstype: "ext4" },
  { target: "/media/maverick/Expansion", source: "/dev/sdb2", uuid: "external", fstype: "exfat" },
];
const stats = { blocks: 100, bsize: 4096, bavail: 60, files: 1000, ffree: 800 };

test("an unreadable removable mount retains other disk readings and its known identity", async () => {
  const disks = await diskReadings(cfg, mounts, async (mount) => {
    if (mount.endsWith("Expansion")) throw new Error("EACCES: permission denied");
    return stats;
  });
  assert.equal(disks.length, 3);
  assert.equal(disks[0].bytes, 409600);
  assert.equal(disks[1].free, 245760);
  assert.equal(disks[2].valid, true);
  assert.equal(disks[2].bytes, null);
  assert.equal(disks[2].free, null);
  assert.match(disks[2].readingError!, /EACCES/);
});

test("a missing required mount and unsupported inodes remain explicitly unknown", async () => {
  const disks = await diskReadings(cfg, mounts.filter(m => m.target !== "/mnt/16tb"), async () => ({ ...stats, files: 0, ffree: 0 }));
  assert.equal(disks[1].valid, false);
  assert.equal(disks[1].expected, true);
  assert.equal(disks[1].bytes, null);
  assert.equal(disks[2].inodesFree, null);
});

test("a missing provider process rejects current and later RPC calls", async () => {
  const rpc = new Rpc("/repro-nonexistent-provider-fixture", [], {});
  try {
    await assert.rejects(rpc.call("initialize", {}), /ENOENT/);
    await assert.rejects(rpc.call("model/list", {}), /ENOENT/);
  } finally { rpc.close(); }
});

test("a provider closing stdin rejects a real write without crashing the broker", async () => {
  const rpc = new Rpc(process.execPath, ["-e", "require('node:fs').closeSync(0);process.stdout.write('ready\\n');setTimeout(()=>{},1000)"], {});
  try {
    await once(rpc.child.stdout, "data");
    await assert.rejects(rpc.call("initialize", {}), /Provider input/);
    await assert.rejects(rpc.call("model/list", {}), /Provider input/);
  } finally { rpc.close(); }
});

test("provider exit diagnostics preserve the cause and redact credentials", async () => {
  const secret = "fixture-sensitive-token-abc123";
  const rpc = new Rpc(process.execPath, ["-e", `process.stderr.write("bwrap: setup denied; Authorization: Bearer ${secret}\\n");process.exitCode=7`], {});
  try {
    await once(rpc.child, "close");
    await assert.rejects(rpc.call("initialize", {}), error => {
      const message = (error as Error).message;
      assert.match(message, /exited \(7\)/);
      assert.match(message, /bwrap: setup denied/);
      assert.ok(!message.includes(secret));
      return true;
    });
  } finally { rpc.close(); }
});
