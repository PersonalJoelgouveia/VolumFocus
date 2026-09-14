import { registerPlugin } from '@capacitor/core';
const Health = registerPlugin('Health', {
    web: () => import('./web').then((m) => new m.HealthWeb()),
});
export * from './definitions';
export { Health };
//# sourceMappingURL=index.js.map