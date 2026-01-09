import { createPlugin, createPluginStore } from "@reliverse/rempts-core/plugin";

interface MetricsStore {
  metrics: {
    events: Array<{
      name: string;
      timestamp: Date;
      data: Record<string, any>;
    }>;
    recordEvent: (name: string, data?: Record<string, any>) => void;
    getEvents: (
      name?: string
    ) => Array<{ name: string; timestamp: Date; data: Record<string, any> }>;
    clearEvents: () => void;
  };
}

export const metricsPlugin = createPlugin<MetricsStore>(() => ({
  store: createPluginStore<MetricsStore>({
    metrics: {
      events: [],
      recordEvent(name: string, data: Record<string, any> = {}) {
        this.events.push({
          name,
          timestamp: new Date(),
          data,
        });

        // Keep only last 100 events to prevent memory leaks
        if (this.events.length > 100) {
          this.events = this.events.slice(-100);
        }
      },
      getEvents(name?: string) {
        if (name) {
          return this.events.filter((event) => event.name === name);
        }
        return [...this.events];
      },
      clearEvents() {
        this.events = [];
      },
    },
  }),

  beforeCommand({ store, command }) {
    if (store) {
      // Record command start
      store.getState().metrics.recordEvent("command_started", {
        command,
        timestamp: new Date().toISOString(),
      });
    }
  },

  afterCommand({ store, command }) {
    if (store) {
      // Record command completion
      store.getState().metrics.recordEvent("command_completed", {
        command,
        timestamp: new Date().toISOString(),
      });
    }
  },
}));
