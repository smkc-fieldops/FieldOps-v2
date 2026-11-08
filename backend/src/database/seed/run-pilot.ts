/**
 * Loads the field-test data (see pilot-data.ts). Run after the sample seed:
 *   npm run db:seed:pilot -- --name "Tester Name" --phone 6000019190 --photo storage/pilot/me.jpg
 * The photo stays out of git (backend/storage is ignored) and is not kept in the database.
 */
import '../../shared/config/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { seedPilotData } from './pilot-data';

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

async function run(): Promise<void> {
  const testerName = argument('name');
  const testerPhone = argument('phone');
  if (!testerName || !testerPhone) throw new Error('Pass --name "Tester Name" --phone 10-digit-number');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const summary = await seedPilotData(app, { testerName, testerPhone, photoPath: argument('photo') });
    process.stdout.write(`Pilot data loaded:\n${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`Pilot seed failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
