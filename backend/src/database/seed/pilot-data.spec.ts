import { checkLocationInWard, parseWardBoundary } from '../../modules/wards/wards.policy';
import { prabhagGrid } from './pilot-data';

describe('prabhagGrid', () => {
  const grid = prabhagGrid();
  const wardAt = (latitude: number, longitude: number): string[] =>
    grid
      .filter((w) => checkLocationInWard(parseWardBoundary(w.boundary), { latitude, longitude }).inside)
      .map((w) => w.code);

  it('has 20 valid wards with unique codes', () => {
    expect(new Set(grid.map((w) => w.code)).size).toBe(20);
    grid.forEach((w) => expect(() => parseWardBoundary(w.boundary)).not.toThrow());
  });

  it.each([
    ['Sangli', 16.853, 74.583, 'SANGLI'],
    ['Miraj', 16.83, 74.63, 'MIRAJ'],
  ])('%s falls in exactly one ward of its zone', (_town, lat, lng, zone) => {
    const codes = wardAt(lat, lng);
    expect(codes).toHaveLength(1);
    expect(grid.find((w) => w.code === codes[0])?.zone).toBe(zone);
  });
});
