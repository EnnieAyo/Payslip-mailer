/**
 * Soft delete middleware for Prisma
 * Intercepts delete operations and converts them to updates with deletedAt timestamp
 * Filters out soft-deleted records from queries automatically
 */
export function softDeleteMiddleware(params: any, next: any) {
  // Models that support soft delete
  const softDeleteModels = [
    'Employee',
    'Payslip',
    'PayslipUpload',
    'User',
    'Role',
  ];

  if (!softDeleteModels.includes(params.model)) {
    return next(params);
  }

  // Convert delete to update with deletedAt
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }

  // Convert deleteMany to updateMany with deletedAt
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (params.args.data !== undefined) {
      params.args.data.deletedAt = new Date();
    } else {
      params.args.data = { deletedAt: new Date() };
    }
  }

  // Exclude soft-deleted records from findUnique
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    params.action = 'findFirst';
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    };
  }

  // Exclude soft-deleted records from findMany
  if (params.action === 'findMany') {
    if (params.args.where) {
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    } else {
      params.args.where = { deletedAt: null };
    }
  }

  // Exclude soft-deleted records from update
  if (params.action === 'update') {
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    };
  }

  // Exclude soft-deleted records from updateMany
  if (params.action === 'updateMany') {
    if (params.args.where !== undefined) {
      params.args.where.deletedAt = null;
    } else {
      params.args.where = { deletedAt: null };
    }
  }

  // Exclude soft-deleted records from count
  if (params.action === 'count') {
    if (params.args.where) {
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    } else {
      params.args.where = { deletedAt: null };
    }
  }

  return next(params);
}
