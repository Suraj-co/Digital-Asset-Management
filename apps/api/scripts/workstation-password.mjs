const WORKSTATION_DATABASE_PASSWORD = 'dam_local_dev_only';

export function usesWorkstationDatabasePassword(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return decodeURIComponent(url.password) === WORKSTATION_DATABASE_PASSWORD;
  } catch {
    return false;
  }
}
