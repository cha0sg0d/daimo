import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import cors from "cors";
import http from "http";

import { Crontab } from "./cron";
import { PushNotifier } from "./pushNotifier";
import { createRouter } from "./router";
import { Telemetry } from "./telemetry";
import { createContext } from "./trpc";
import { AccountFactory } from "../contract/accountFactory";
import { CoinIndexer } from "../contract/coinIndexer";
import { Faucet } from "../contract/faucet";
import { KeyRegistry } from "../contract/keyRegistry";
import { NameRegistry } from "../contract/nameRegistry";
import { NoteIndexer } from "../contract/noteIndexer";
import { OpIndexer } from "../contract/opIndexer";
import { Paymaster } from "../contract/paymaster";
import { DB } from "../db/db";
import { chainConfig } from "../env";
import { getBundlerClientFromEnv } from "../network/bundlerClient";
import { getViemClientFromEnv } from "../network/viemClient";

async function main() {
  console.log(`[API] initializing telemetry...`);
  const monitor = new Telemetry();

  console.log(`[API] starting...`);
  const vc = getViemClientFromEnv();
  await vc.init();
  const bundlerClient = getBundlerClientFromEnv();

  console.log(`[API] initializing db...`);
  const db = new DB();
  await db.createTables();

  console.log(`[API] using wallet ${vc.walletClient.account.address}`);
  const keyReg = new KeyRegistry(vc);
  const nameReg = new NameRegistry(vc, await db.loadNameBlacklist());
  const opIndexer = new OpIndexer(vc);
  const paymaster = new Paymaster(vc, bundlerClient, db);
  const coinIndexer = new CoinIndexer(vc, opIndexer);
  const noteIndexer = new NoteIndexer(vc, nameReg);
  const faucet = new Faucet(vc, coinIndexer, db);
  const accountFactory = new AccountFactory(vc);
  const crontab = new Crontab(vc, coinIndexer, nameReg, monitor);

  const notifier = new PushNotifier(
    coinIndexer,
    nameReg,
    noteIndexer,
    opIndexer,
    keyReg,
    db
  );

  // Initialize in background
  (async () => {
    console.log(`[API] initializing indexers...`);
    await Promise.all([
      keyReg.init(),
      nameReg.init(),
      opIndexer.init(),
      paymaster.init(),
    ]);
    await Promise.all([coinIndexer.init(), noteIndexer.init()]);

    console.log(`[API] initializing push notifications...`);
    await Promise.all([notifier.init(), faucet.init(), crontab.init()]);

    console.log(`[API] polling logs...`);
    setInterval(() => vc.processLogsToLatestBlock(), 1000);
  })();

  console.log(`[API] serving...`);
  const router = createRouter(
    vc,
    bundlerClient,
    coinIndexer,
    noteIndexer,
    opIndexer,
    nameReg,
    keyReg,
    paymaster,
    faucet,
    notifier,
    accountFactory,
    monitor
  );
  const handler = createHTTPHandler({
    middleware: cors(),
    router,
    createContext,
  });

  const trpcPrefix = `/chain/${chainConfig.chainL2.id}/`;
  const server = http.createServer((req, res) => {
    // Only serve requests for the correct network.
    if (req.url == null || !req.url.startsWith(trpcPrefix)) {
      console.log(`[API] SKIPPING ${req.url}`);
      res.writeHead(404);
      res.end();
      return;
    }

    console.log(`[API] serving ${req.method} ${req.url}`);

    req.url = "/" + req.url.slice(trpcPrefix.length);
    handler(req, res);
  });
  server.listen(3000).address();

  console.log(`[API] listening`);
}

main().catch(console.error);
