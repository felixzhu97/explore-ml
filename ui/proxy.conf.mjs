// Loaded by `ng serve`; Node strips the TypeScript types on import.
import { buildProxy } from './src/app/shared/proxy.ts';
import { SERVICES } from './src/app/shared/services.ts';

export default buildProxy(SERVICES, process.env);
