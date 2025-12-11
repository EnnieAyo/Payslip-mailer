import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  ippisNumber!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
