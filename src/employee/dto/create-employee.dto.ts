import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  ippisNumber: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  department?: string;
}
