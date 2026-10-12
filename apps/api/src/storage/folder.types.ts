import { ApiProperty } from '@nestjs/swagger';
import { FOLDER_ASSET_TYPES, FOLDER_STAGES } from './folder-path.js';

export class DepartmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'Brand' })
  name!: string;

  @ApiProperty()
  active!: boolean;
}

export class DepartmentPageDto {
  @ApiProperty({ type: [DepartmentDto] })
  items!: DepartmentDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}

export class FolderCatalogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({ format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ example: 'Brand' })
  departmentName!: string;

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: 'Spring' })
  campaign!: string;

  @ApiProperty({ enum: FOLDER_STAGES })
  stage!: (typeof FOLDER_STAGES)[number];

  @ApiProperty({ enum: FOLDER_ASSET_TYPES })
  assetType!: (typeof FOLDER_ASSET_TYPES)[number];

  @ApiProperty({
    example: 'AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters',
  })
  path!: string;

  @ApiProperty({ nullable: true, type: String })
  driveFolderId!: string | null;

  @ApiProperty({ enum: ['not_run'] })
  liveCheck!: 'not_run';

  @ApiProperty()
  detail!: string;
}

export class FolderPageDto {
  @ApiProperty({ type: [FolderCatalogDto] })
  items!: FolderCatalogDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
