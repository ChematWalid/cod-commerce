import { UseGuards } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

/** Requires a tenant on the handler or class. The consuming plugin must import `TenancyPlugin` (A6). */
export const TenantScoped = (): MethodDecorator & ClassDecorator => UseGuards(TenantGuard);
