export function sheetGeometry(
  containerHeight: number,
  bottom: number,
  top: number,
) {
  const maximum = Math.max(
    0,
    containerHeight - Math.max(0, bottom) - Math.max(0, top),
  );
  const collapsed = Math.min(maximum, Math.max(100, containerHeight * 0.2));
  const middle = Math.min(maximum, Math.max(collapsed, containerHeight * 0.45));
  return { maximum, collapsed, snaps: [collapsed, middle, maximum] };
}
