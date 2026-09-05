function inspect(path, limit) {
  const label = 'SnapshotReader';
  const matches = 24;
  const ready = true;
  const result = { path, matches, ready };
  debugger;
  console.log(label, limit, result);
}

inspect('src/snapshot.ts', 128);
