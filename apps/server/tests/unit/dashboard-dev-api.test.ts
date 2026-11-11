import { describe, expect, it } from 'vitest';
import { dashboardDevApi, DashboardDevApiError } from '../../src/config/dashboard-dev-api';

describe('dashboardDevApi', () => {
  it('points vite dev at the host-run api by default', () => {
    expect(dashboardDevApi({})).toEqual({ host: 'http://localhost', port: 3100 });
    expect(dashboardDevApi({ API_HOST: '', API_PORT: '' })).toEqual({ host: 'http://localhost', port: 3100 });
  });

  it('takes the host and the port from the environment', () => {
    // Arrange
    const source = { API_HOST: 'https://api.dev.example.test', API_PORT: '8443' };

    // Act
    const api = dashboardDevApi(source);

    // Assert
    expect(api).toEqual({ host: 'https://api.dev.example.test', port: 8443 });
  });

  it.each(['localhost', 'ftp://localhost', 'http://localhost:3100', 'http://localhost/admin', 'http://'])(
    'refuses API_HOST=%s: a scheme and a host, nothing else',
    (host) => {
      expect(() => dashboardDevApi({ API_HOST: host })).toThrow(DashboardDevApiError);
      expect(() => dashboardDevApi({ API_HOST: host })).toThrow('API_HOST');
    },
  );

  it.each(['0', '65536', 'http'])('refuses API_PORT=%s', (port) => {
    expect(() => dashboardDevApi({ API_PORT: port })).toThrow('API_PORT');
  });
});
