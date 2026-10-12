import { HealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

describe('HealthController liveness', () => {
  it('does not query the database', () => {
    const check = vi.fn();
    const controller = new HealthController({
      check,
    } as unknown as HealthService);

    const body = controller.live();

    expect(check).not.toHaveBeenCalled();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('aaradhya-dam-api');
  });
});
