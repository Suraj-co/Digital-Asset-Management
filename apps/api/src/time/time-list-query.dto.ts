import { IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from '../http/page-query.dto.js';

export class TimeListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
