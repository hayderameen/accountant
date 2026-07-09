import 'dotenv/config';
import { Account } from './models/Account.js';
import { Category } from './models/Category.js';
import { Transaction } from './models/Transaction.js';
import { app, ensureDb } from './app.js';

const port = Number(process.env.PORT) || 4000;

async function start() {
  await ensureDb();
  await Promise.all([
    Category.syncIndexes(),
    Account.syncIndexes(),
    Transaction.syncIndexes(),
  ]);
  app.listen(port, () => console.log(`API http://localhost:${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
