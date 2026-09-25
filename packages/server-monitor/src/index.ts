import { mkdir, chmod, readFile } from "node:fs/promises";
import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { Telemetry } from "./telemetry.js";
import { Collector } from "./collector.js";
import { evidence } from "./ai/evidence.js";
import { AiService } from "./ai/service.js";
import { Vault } from "./ai/vault.js";
import { BrokerClient } from "./ai/broker-client.js";
import { listen } from "./server.js";
const cfg = loadConfig();
await mkdir(cfg.dataDir, { recursive: true, mode: 0o700 });
const store = new Store(`${cfg.dataDir}/monitor.sqlite`);
await chmod(`${cfg.dataDir}/monitor.sqlite`, 0o600);
const telemetry = new Telemetry(store),
  collector = new Collector(cfg, store, telemetry);
const ai = new AiService(
  store,
  new Vault(store, (await readFile(cfg.signingKeyFile, "utf8")).trim()),
  new BrokerClient(cfg.brokerSocket, cfg.brokerTokenFile),
  () => collector.snapshot,
  () => evidence(cfg),
);
await telemetry.listen(cfg.eventsSocket);
const servers = await listen({ cfg, store, collector, telemetry, ai });
collector.start();
ai.start();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    collector.stop();
    ai.stop();
    telemetry.close();
    void Promise.all([servers.web.close(), servers.local.close()]).finally(
      () => {
        store.close();
        process.exit(0);
      },
    );
    setTimeout(() => process.exit(0), 5000).unref();
  });
