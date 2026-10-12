export function retireDriveFiles(input: {
  approvedVersionId: string;
  versions: { id: string; driveFileId: string | null }[];
}): { versionId: string; driveFileId: string }[] {
  const approved = input.versions.find((version) => version.id === input.approvedVersionId);
  if (!approved?.driveFileId) {
    return [];
  }
  const activeFileId = approved.driveFileId;
  return input.versions.flatMap((version) => {
    if (version.id === approved.id || !version.driveFileId || version.driveFileId === activeFileId) {
      return [];
    }
    return [{ versionId: version.id, driveFileId: version.driveFileId }];
  });
}
