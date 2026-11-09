import { TenancyPlugin } from '@cod/plugin-tenancy';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, EventBus, PluginCommonModule, type RequestContext, Transaction, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import { withRbacErrors } from '../../../api/error-mapping';
import { requirePermission } from '../../../api/require-permission.decorator';
import { ActivityRecordEvent } from '../../../infrastructure/activity-record.event';

/** Publishes an `ActivityRecordEvent` inside its own transaction, then fails or not as told. */
@Resolver()
class ActivityPublisherResolver {
  constructor(private readonly eventBus: EventBus) {}

  @Transaction()
  @Mutation()
  @requirePermission('settings.activity-log.view')
  rbacTestPublishActivity(
    @Ctx() ctx: RequestContext,
    @Args('entityType') entityType: string,
    @Args('entityId') entityId: string,
    @Args('failAfter') failAfter: boolean,
  ): Promise<boolean> {
    return withRbacErrors(async () => {
      await this.eventBus.publish(
        new ActivityRecordEvent(ctx, {
          actorAdministratorId: null,
          action: 'test.event',
          entityType,
          entityId,
          summary: 'Published by a test',
          diff: { passwordHash: 'synthetic', name: 'kept' },
          ip: '203.0.113.7',
          userAgent: 'test-agent',
        }),
      );
      if (failAfter) throw new Error('The work after the event failed');
      return true;
    });
  }
}

/** The extension point a feature plugin uses: it only publishes the event. */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  adminApiExtensions: {
    schema: gql`
      extend type Mutation {
        rbacTestPublishActivity(entityType: String!, entityId: String!, failAfter: Boolean!): Boolean!
      }
    `,
    resolvers: [ActivityPublisherResolver],
  },
})
// A Vendure plugin is a decorated class; this one only registers the fixture.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ActivityPublisherTestPlugin {}
