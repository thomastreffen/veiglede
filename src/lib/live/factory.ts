// Factory + process-wide singleton for the active LiveBroadcaster.
// Today: always web. Later: native when Capacitor is detected.
import { getPlatform } from "@/lib/platform";
import type { LiveBroadcaster } from "./types";
import { WebLiveBroadcaster } from "./web-broadcaster";
import { NativeLiveBroadcaster } from "./native-broadcaster";

let _instance: LiveBroadcaster | null = null;

export function createLiveBroadcaster(): LiveBroadcaster {
  const platform = getPlatform();
  if (platform === "ios" || platform === "android") {
    // Reserved for future Capacitor integration. Currently a clear stub.
    return new NativeLiveBroadcaster();
  }
  return new WebLiveBroadcaster();
}

export function getLiveBroadcaster(): LiveBroadcaster {
  if (!_instance) _instance = createLiveBroadcaster();
  return _instance;
}

// Test/debug helper — not used in product code.
export function __resetLiveBroadcasterForTests() {
  _instance = null;
}
