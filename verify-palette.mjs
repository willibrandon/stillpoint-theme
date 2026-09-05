// Public palette/state gate. All composites are read from generated theme JSON.
const { verifyStates } = await import('./scripts/verify-states.mjs');
await verifyStates();
