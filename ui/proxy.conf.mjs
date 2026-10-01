// Loaded by `ng serve`; Node strips the TypeScript types on import.
import { HELPERS } from './src/app/shared/helpers.ts';
import { buildProxy } from './src/app/shared/proxy.ts';

export default buildProxy(HELPERS, process.env);
