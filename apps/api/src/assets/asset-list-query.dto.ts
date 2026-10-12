import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { PageQueryDto } from '../http/page-query.dto.js';

function NoControlCharacters() {
  return ValidateBy({
    name: 'noControlCharacters',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        [...value].every((char) => char.charCodeAt(0) >= 32),
      defaultMessage: () => 'Search text cannot include control characters.',
    },
  });
}

export class AssetListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Use 80 characters or fewer.' })
  @NoControlCharacters()
  q?: string;
}
