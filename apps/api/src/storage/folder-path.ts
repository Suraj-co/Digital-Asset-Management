export const FOLDER_STAGES = ['working', 'approved', 'archive'] as const;
export const FOLDER_ASSET_TYPES = [
  'images',
  'videos',
  'posters',
  'banners',
  'source_files',
  'other',
] as const;

export type FolderStageName = (typeof FOLDER_STAGES)[number];
export type FolderAssetTypeName = (typeof FOLDER_ASSET_TYPES)[number];

const STAGE_FOLDERS: Record<FolderStageName, string> = {
  working: '01_Working',
  approved: '02_Approved',
  archive: '03_Archive',
};

const TYPE_FOLDERS: Record<FolderAssetTypeName, string> = {
  images: 'Images',
  videos: 'Videos',
  posters: 'Posters',
  banners: 'Banners',
  source_files: 'Source_Files',
  other: 'Other',
};

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/;

export function isSafeSegment(value: string): boolean {
  return SEGMENT.test(value);
}

export function folderPath(input: {
  companyCode: string;
  departmentName: string;
  year: number;
  campaign: string;
  stage: FolderStageName;
  assetType: FolderAssetTypeName;
}): string {
  return [
    'AARADHYA_DAM',
    input.companyCode,
    input.departmentName,
    String(input.year),
    input.campaign,
    STAGE_FOLDERS[input.stage],
    TYPE_FOLDERS[input.assetType],
  ].join('/');
}
