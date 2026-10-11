export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

// Configurable simulated latency for realistic asynchronous UI feedback
export const simulateNetworkDelay = async (ms: number = 300): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const IS_DEMO_MODE = import.meta.env.MODE === 'test'
  ? true
  : import.meta.env.DEV
  ? (import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false')
  : (import.meta.env.VITE_ENABLE_DEMO_MODE === 'true');
