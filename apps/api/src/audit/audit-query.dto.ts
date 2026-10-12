import { IsUUID } from 'class-validator';
import { PageQueryDto } from '../http/page-query.dto.js';

export class AuditQueryDto extends PageQueryDto {
  @IsUUID()
  companyId!: string;
}
