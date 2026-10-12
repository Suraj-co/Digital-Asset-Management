import { IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @IsUUID()
  companyId!: string;
}
