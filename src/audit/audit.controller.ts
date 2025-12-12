import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuditService } from '../auth/services/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('users:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query() pagination?: PaginationDto,
    @CurrentUser() user?: any,
  ) {
    const page = pagination?.page ?? 0;
    const limit = pagination?.limit ?? 50;

    return this.auditService.getLogs({
      userId: userId ? parseInt(userId) : undefined,
      action,
      resource,
      page,
      limit,
    });
  }

  @Get('trail/:resourceId/:resource')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('users:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit trail for a specific resource' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getAuditTrail(
    @Query('resourceId') resourceId: string,
    @Query('resource') resource: string,
  ) {
    return this.auditService.getAuditTrail(parseInt(resourceId), resource);
  }
}
