export interface BundleMember {
  id: string;
  from: string;
  to: string;
}

export interface BundleSlot {
  /** 0..size-1 in input order (file / builder order). */
  index: number;
  size: number;
  /** Canvas px. 0 iff size === 1. Centered: (index - (size-1)/2) * spacing. */
  offset: number;
}

export const BUNDLE_SPACING_PX = 28;

/** Directed pair key. */
export function pairKey(from: string, to: string): string {
  return `${from}\0${to}`;
}

/** Map member id → slot. Singletons get offset 0. */
export function bundleSlots(
  members: readonly BundleMember[],
  spacing: number = BUNDLE_SPACING_PX,
): Map<string, BundleSlot> {
  const groups = new Map<string, BundleMember[]>();
  for (const member of members) {
    const key = pairKey(member.from, member.to);
    const group = groups.get(key);
    if (group) group.push(member);
    else groups.set(key, [member]);
  }

  const slots = new Map<string, BundleSlot>();
  for (const group of groups.values()) {
    const size = group.length;
    const center = (size - 1) / 2;
    for (let index = 0; index < size; index++) {
      slots.set(group[index].id, {
        index,
        size,
        offset: (index - center) * spacing,
      });
    }
  }
  return slots;
}

/**
 * Point offset `offset` px along the left-hand perpendicular of B−A.
 * Degenerate chord (len ≈ 0) returns `origin` unchanged.
 */
export function offsetAlongChord(
  origin: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  offset: number,
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: origin.x, y: origin.y };
  const ux = -dy / len;
  const uy = dx / len;
  return { x: origin.x + ux * offset, y: origin.y + uy * offset };
}

/**
 * Quadratic through the perpendicular midpoint. Label sits on the control point.
 * Caller uses getBezierPath instead when offset === 0.
 */
export function offsetQuadPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  offset: number,
): { path: string; labelX: number; labelY: number } {
  const control = offsetAlongChord(
    { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 },
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    offset,
  );
  return {
    path: `M ${sourceX} ${sourceY} Q ${control.x} ${control.y} ${targetX} ${targetY}`,
    labelX: control.x,
    labelY: control.y,
  };
}
