import { ApiProperty } from '@nestjs/swagger';

export class InvitationDeliveryDto {
  @ApiProperty({ enum: ['pending', 'queued', 'held', 'sent', 'failed'] })
  status!: 'pending' | 'queued' | 'held' | 'sent' | 'failed';

  @ApiProperty()
  detail!: string;
}

export class CreatorInvitationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ type: InvitationDeliveryDto })
  delivery!: InvitationDeliveryDto;
}

export class CreatorInvitationListDto {
  @ApiProperty({ type: [CreatorInvitationDto] })
  items!: CreatorInvitationDto[];
}

export class AcceptedInvitationDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty()
  passwordSet!: boolean;
}
