import { defaults as pgDefaults, types as pgTypes } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from '../../database/entities';
import { MIGRATIONS } from '../../database/migrations';
import type { DatabaseSettings } from './database-settings';
import { OracleSafeNamingStrategy } from './oracle-safe-naming.strategy';

/**
 * One builder for every place that opens the database: the Nest app, the TypeORM CLI
 * and tests. Entities and migrations are listed explicitly (no globs), which works the
 * same on Windows and Linux.
 */
export function buildDataSourceOptions(settings: DatabaseSettings): DataSourceOptions {
  const common = {
    entities: ENTITIES,
    migrations: MIGRATIONS,
    namingStrategy: new OracleSafeNamingStrategy(),
    synchronize: false,
    migrationsRun: false,
    maxQueryExecutionTime: settings.slowQueryMs,
    logging: ['error', 'warn', 'migration'] as ('error' | 'warn' | 'migration')[],
  };

  if (settings.type === 'oracle') {
    return {
      ...common,
      type: 'oracle',
      host: settings.host,
      port: settings.port,
      username: settings.username,
      password: settings.password,
      serviceName: settings.serviceName,
      extra: {
        poolMax: settings.poolMax,
        // DATE columns hold IST calendar days and queries bind them as 'YYYY-MM-DD' strings, so
        // every session reads that format (Oracle's default depends on the server's language).
        sessionCallback: async (connection: { execute(sql: string): Promise<unknown> }): Promise<void> => {
          await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'`);
        },
      },
    };
  }

  // TIMESTAMP (without time zone) columns always hold UTC. Do not rely on TZ=UTC:
  // on Windows the process time zone can stay IST, which shifts values by 5h30.
  // Writes: serialise JS Dates as UTC. Reads: parse column values as UTC.
  (pgDefaults as { parseInputDatesAsUTC?: boolean }).parseInputDatesAsUTC = true;
  pgTypes.setTypeParser(1114, parseUtcTimestamp);

  return {
    ...common,
    type: 'postgres',
    host: settings.host,
    port: settings.port,
    username: settings.username,
    password: settings.password,
    database: settings.database,
    ssl: settings.ssl ? { rejectUnauthorized: true } : false,
    // Session time zone UTC so server-side now() / CURRENT_TIMESTAMP agree with the app.
    extra: { max: settings.poolMax, options: '-c timezone=UTC' },
  };
}

/** Parses a PostgreSQL TIMESTAMP text value ("2026-10-31 13:40:35.848") as UTC. */
export function parseUtcTimestamp(value: string): Date {
  if (value === 'infinity' || value === '-infinity') {
    return new Date(value === 'infinity' ? 8.64e15 : -8.64e15);
  }
  return new Date(value.replace(' ', 'T') + 'Z');
}
