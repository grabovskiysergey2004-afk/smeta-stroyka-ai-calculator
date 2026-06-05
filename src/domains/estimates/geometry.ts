import type { Point } from "../projects/types";

export function roundQuantity(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function distanceMeters(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function polygonAreaM2(points: Point[]): number {
  if (points.length < 3) return 0;

  const sum = points.reduce((acc, point, index) => {
    const next = points[(index + 1) % points.length];
    return acc + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(sum) / 2;
}
