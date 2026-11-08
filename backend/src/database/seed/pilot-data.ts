/**
 * Test data for trying the app in the field: approximate SMKMC prabhags, a test ward around a
 * chosen village, and one real tester with an inspector and ward inspector above them.
 *
 * NOT official limits. The 20 prabhags are a plain grid over the Sangli-Miraj-Kupwad area,
 * replaced through PATCH /wards/:id when official GeoJSON arrives. Safe to run again: it updates
 * what exists. Never runs in production.
 */
import { readFileSync } from 'node:fs';
import type { INestApplicationContext } from '@nestjs/common';
import type { AuthUser } from '../../shared/auth/auth-user';
import { Role, type StaffRole } from '../../shared/auth/roles';
import { Clock } from '../../shared/clock/clock';
import { AppConfig } from '../../shared/config/app-config';
import { FaceEnrolmentService } from '../../modules/face/face-enrolment.service';
import { RostersService } from '../../modules/rosters/rosters.service';
import { StaffAdminService } from '../../modules/staff-admin/staff-admin.service';
import { StaffService } from '../../modules/staff/staff.service';
import type { Zone } from '../../modules/wards/wards.policy';
import { WardsService } from '../../modules/wards/wards.service';

export interface PilotOptions {
  testerName: string;
  testerPhone: string;
  /** JPEG to enrol for the tester; skipped when absent or the tester is already enrolled. */
  photoPath?: string;
}

const GRID = { west: 74.53, south: 16.79, columns: 5, rows: 4, cellLng: 0.032, cellLat: 0.0275 };

/** Rough centres, used only to give each grid cell a zone. */
const ZONE_CENTRES: { zone: Zone; lat: number; lng: number }[] = [
  { zone: 'SANGLI', lat: 16.855, lng: 74.57 },
  { zone: 'MIRAJ', lat: 16.82, lng: 74.645 },
  { zone: 'KUPWAD', lat: 16.875, lng: 74.625 },
];

/** Test ward: a square of about 4.3 km around Chincholi Bhose, Pandharpur taluka (OSM village point). */
const TEST_WARD = { code: '1919', lat: 17.7001, lng: 75.3114, halfSide: 0.02 };

const SHIFT = { shiftStart: '06:00', shiftEnd: '22:00' };
/** Placements are generated this many days ahead, within the roster rule's limit. */
const DAYS_AHEAD = 7;

function square(west: number, south: number, east: number, north: number): Record<string, unknown> {
  const ring = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
  return { type: 'Polygon', coordinates: [ring] };
}

function nearestZone(lat: number, lng: number): Zone {
  const distance = (c: { lat: number; lng: number }): number => (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
  return ZONE_CENTRES.reduce((best, c) => (distance(c) < distance(best) ? c : best)).zone;
}

/** Numbered from the north-west corner, row by row. Exported for its test. */
export function prabhagGrid(): { code: string; name: string; nameMr: string; zone: Zone; boundary: Record<string, unknown> }[] {
  const marathiDigits = '०१२३४५६७८९';
  const wards = [];
  for (let row = 0; row < GRID.rows; row++) {
    for (let column = 0; column < GRID.columns; column++) {
      const n = row * GRID.columns + column + 1;
      const west = GRID.west + column * GRID.cellLng;
      const north = GRID.south + (GRID.rows - row) * GRID.cellLat;
      const south = north - GRID.cellLat;
      wards.push({
        code: `W${String(n).padStart(2, '0')}`,
        name: `Prabhag ${n}`,
        nameMr: `प्रभाग ${String(n).replace(/\d/g, (d) => marathiDigits[Number(d)])}`,
        zone: nearestZone((south + north) / 2, west + GRID.cellLng / 2),
        boundary: square(west, south, west + GRID.cellLng, north),
      });
    }
  }
  return wards;
}

export async function seedPilotData(app: INestApplicationContext, options: PilotOptions): Promise<Record<string, unknown>> {
  const config = app.get(AppConfig);
  if (config.isProduction) throw new Error('The pilot seed never runs in production.');

  const wards = app.get(WardsService);
  const staff = app.get(StaffService);
  const staffAdmin = app.get(StaffAdminService);
  const rosters = app.get(RostersService);
  const enrolment = app.get(FaceEnrolmentService);
  const clock = app.get(Clock);

  const find = async (code: string) => {
    const [rows] = await staff.findPage({ search: code }, 0, 5);
    return rows.find((r) => r.employeeCode === code) ?? null;
  };
  const adminRow = await find('SMK-ADM-001');
  if (!adminRow) throw new Error('Run the sample seed first (npm run db:seed:dev): no administrator found.');
  const admin: AuthUser = { staffId: adminRow.id, role: Role.ADMIN, sessionId: 'seed', homeWardId: null, officeId: null };

  const upsertWard = async (def: { code: string; name: string; nameMr: string; zone: Zone; boundary: Record<string, unknown> }) => {
    const existing = (await wards.list(1, 200)).items.find((w) => w.code === def.code);
    if (!existing) return wards.create(def);
    return wards.update(existing.id, {
      name: def.name,
      nameMr: def.nameMr,
      zone: def.zone,
      boundary: def.boundary,
      expectedVersion: existing.version,
    });
  };
  const grid = prabhagGrid();
  for (const def of grid) await upsertWard(def);

  const { lat, lng, halfSide } = TEST_WARD;
  const testWard = await upsertWard({
    code: TEST_WARD.code,
    name: 'Test Ward 1919 (Chincholi Bhose)',
    nameMr: 'चाचणी प्रभाग १९१९ (चिंचोली भोसे)',
    zone: 'SANGLI', // Every ward needs one of the three zones; this test ward lies outside them.
    boundary: square(lng - halfSide, lat - halfSide, lng + halfSide, lat + halfSide),
  });

  const upsertStaff = async (employeeCode: string, fullName: string, phone: string, role: StaffRole, reportsToId: string, password?: string) => {
    const existing = await find(employeeCode);
    if (existing) {
      return staffAdmin.update(admin, existing.id, { expectedVersion: existing.version, fullName, phone, ...SHIFT });
    }
    return staffAdmin.create(admin, {
      employeeCode,
      fullName,
      phone,
      role,
      homeWardId: testWard.id,
      reportsToId,
      department: 'Pilot test',
      ...SHIFT,
      ...(password ? { initialPassword: password } : {}),
    });
  };
  const wardInspector = await upsertStaff('SMK-WI-1919', 'Test Ward Inspector 1919', '6000019191', Role.WARD_INSPECTOR, admin.staffId, config.seedWebPassword || undefined);
  const inspector = await upsertStaff('SMK-IN-1919', 'Test Inspector 1919', '6000019192', Role.INSPECTOR, wardInspector.id);
  const tester = await upsertStaff('SMK-WK-1919', options.testerName, options.testerPhone, Role.WORKER, inspector.id);

  const existingRoster = (await rosters.listRosters(admin, { wardId: testWard.id, page: 1, pageSize: 50 })).items.find(
    (r) => r.workerId === tester.id,
  );
  if (!existingRoster) await rosters.createRoster(admin, { workerId: tester.id, inspectorId: inspector.id });

  const wardActor: AuthUser = { staffId: wardInspector.id, role: Role.WARD_INSPECTOR, sessionId: 'seed', homeWardId: testWard.id, officeId: null };
  let placements = 0;
  const startMs = clock.now().getTime() + 330 * 60_000; // IST calendar day
  for (let day = 0; day <= DAYS_AHEAD; day++) {
    const date = new Date(startMs + day * 86_400_000).toISOString().slice(0, 10);
    try {
      placements += (await rosters.generate(wardActor, date)).created;
    } catch {
      break; // Past the roster rule's plan-ahead limit.
    }
  }

  let enrolled = (await enrolment.list(admin, tester.id)).items.length;
  if (options.photoPath && enrolled === 0) {
    await enrolment.enrol(admin, tester.id, readFileSync(options.photoPath));
    enrolled = 1;
  }

  return {
    prabhags: grid.length,
    testWard: { id: testWard.id, code: testWard.code },
    tester: { id: tester.id, employeeCode: 'SMK-WK-1919', phone: options.testerPhone },
    placementsCreated: placements,
    faceTemplates: enrolled,
  };
}
