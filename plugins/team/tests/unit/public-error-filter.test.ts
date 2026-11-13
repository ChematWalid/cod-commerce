import { type ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { TeamPublicRestFilter } from '../../api/public-error-filter';
import { InvitationInvalidError } from '../../domain/errors';

const TOKEN = 'Zk3r9QbX2mVt7LpW4sYh8NcD1aFe6GuJ0oRi5TyKwMx';
const URL_WITH_TOKEN = `/team/invitations/preview?token=${TOKEN}`;

/** What the filter wrote to the response. */
interface Answer {
  status?: number;
  body?: Record<string, unknown>;
  readonly headers: Record<string, string>;
}

/** A REST host for a request to `url`, recording the answer the filter writes. */
function restHost(url: string): { host: ArgumentsHost; answer: Answer } {
  const answer: Answer = { headers: {} };
  const res = {
    setHeader: (name: string, value: string) => {
      answer.headers[name] = value;
    },
    status(code: number) {
      answer.status = code;
      return res;
    },
    json(body: Record<string, unknown>) {
      answer.body = body;
      return res;
    },
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ url }), getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, answer };
}

/** The filter with Vendure's error handlers recording what they were handed. */
function filterWithHandlers(): { filter: TeamPublicRestFilter; handled: unknown[] } {
  const handled: unknown[] = [];
  const handler = { handleServerError: (error: unknown) => void handled.push(error) };
  const config = { systemOptions: { errorHandlers: [handler] } } as unknown as ConfigService;
  return { filter: new TeamPublicRestFilter(config), handled };
}

describe('TeamPublicRestFilter', () => {
  it('answers a server fault with a generic 500, the path without its token, and hands it to the error handlers', () => {
    // Arrange
    const { filter, handled } = filterWithHandlers();
    const { host, answer } = restHost(URL_WITH_TOKEN);
    const fault = new Error(`database refused ${TOKEN}`);

    // Act
    filter.catch(fault, host);

    // Assert
    expect(answer).toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      body: { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, path: '/team/invitations/preview' },
    });
    expect(JSON.stringify(answer.body)).not.toContain(TOKEN);
    expect(handled).toEqual([fault]);
  });

  it("keeps an HTTP exception's status without echoing the token", () => {
    // Arrange
    const { filter } = filterWithHandlers();
    const { host, answer } = restHost(URL_WITH_TOKEN);

    // Act
    filter.catch(new NotFoundException(`no route ${URL_WITH_TOKEN}`), host);

    // Assert
    expect(answer).toMatchObject({ status: HttpStatus.NOT_FOUND, body: { path: '/team/invitations/preview' } });
    expect(JSON.stringify(answer.body)).not.toContain(TOKEN);
  });

  it("answers a domain error with Team's REST mapping", () => {
    // Arrange
    const { filter, handled } = filterWithHandlers();
    const { host, answer } = restHost(URL_WITH_TOKEN);

    // Act
    filter.catch(new InvitationInvalidError(), host);

    // Assert
    expect(answer).toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      body: { code: 'team.invitation-invalid', path: '/team/invitations/preview' },
    });
    expect(handled).toEqual([]);
  });
});
