import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, Matches, Max, Min } from 'class-validator';
import { FOLDER_ASSET_TYPES, FOLDER_STAGES } from './folder-path.js';

export class ResolveFolderDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  departmentId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/, {
    message: 'Use letters, numbers, spaces, hyphens, or underscores.',
  })
  campaign!: string;

  @IsIn(FOLDER_STAGES)
  stage!: (typeof FOLDER_STAGES)[number];

  @IsIn(FOLDER_ASSET_TYPES)
  assetType!: (typeof FOLDER_ASSET_TYPES)[number];
}
