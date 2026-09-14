import { registerAdapter } from "./registry.js";
import { finabillAdapter } from "./adapters/finabill.js";
import { glomishAdapter } from "./adapters/glomish.js";

export { getAdapter, listAdapters, registerAdapter, clearAdapters } from "./registry.js";
export type { IntegrationAdapter, IntegrationConnection, IntegrationFeature } from "./adapter.js";

// Register built-in adapters
registerAdapter(finabillAdapter);
registerAdapter(glomishAdapter);
