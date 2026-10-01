// Loaded by `ng serve`; Node strips the TypeScript types on import.
import { buildProxy } from './src/app/core/proxy.ts';
import { SERVICES } from './src/app/core/services.ts';

export default buildProxy(SERVICES, process.env);
