import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Glasses, Watch, Activity, Headphones, Smartphone, Wifi,
  Bluetooth, BluetoothSearching, Check, X, AlertTriangle,
  Signal, Battery, RefreshCw, ChevronRight, Loader2,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

type PairingStep = "idle" | "permissions" | "scanning" | "found" | "pairing" | "connected" | "failed";

interface DiscoveredDevice {
  id: string;
  name: string;
  signal: number; // 0-100
  battery?: number;
  type: string;
}

// Realistic discovered device names per category
const DISCOVERED_DEVICES: Record<string, DiscoveredDevice[]> = {
  "Smart Glasses": [
    { id: "mg1", name: "Meta Ray-Ban Stories", signal: 82, battery: 64, type: "Smart Glasses" },
    { id: "mg2", name: "Ray-Ban Meta Wayfarer", signal: 45, type: "Smart Glasses" },
  ],
  Smartwatch: [
    { id: "sw1", name: "Apple Watch Ultra 2", signal: 91, battery: 78, type: "Smartwatch" },
    { id: "sw2", name: "Galaxy Watch 6 Classic", signal: 67, battery: 55, type: "Smartwatch" },
    { id: "sw3", name: "Pixel Watch 2", signal: 33, type: "Smartwatch" },
  ],
  "Health Devices": [
    { id: "hd1", name: "Oura Ring Gen 3", signal: 88, battery: 92, type: "Health Devices" },
    { id: "hd2", name: "Whoop 4.0", signal: 74, battery: 41, type: "Health Devices" },
    { id: "hd3", name: "Fitbit Charge 6", signal: 59, battery: 23, type: "Health Devices" },
  ],
  Earbuds: [
    { id: "eb1", name: "AirPods Pro (2nd gen)", signal: 95, battery: 86, type: "Earbuds" },
    { id: "eb2", name: "Pixel Buds Pro", signal: 71, battery: 52, type: "Earbuds" },
  ],
  Phone: [
    { id: "ph1", name: "iPhone 16 Pro", signal: 97, battery: 73, type: "Phone" },
    { id: "ph2", name: "Pixel 9 Pro", signal: 62, battery: 45, type: "Phone" },
    { id: "ph3", name: "Galaxy S24 Ultra", signal: 54, type: "Phone" },
  ],
  "Other Devices": [
    { id: "od1", name: "Amazon Echo (4th gen)", signal: 80, type: "Other Devices" },
    { id: "od2", name: "Nest Hub Max", signal: 66, type: "Other Devices" },
  ],
};

const DEVICE_ICONS: Record<string, typeof Glasses> = {
  "Smart Glasses": Glasses,
  Smartwatch: Watch,
  "Health Devices": Activity,
  Earbuds: Headphones,
  Phone: Smartphone,
  "Other Devices": Wifi,
};

const PERMISSION_TYPES: Record<string, string[]> = {
  "Smart Glasses": ["Bluetooth", "Camera access", "Microphone", "Location"],
  Smartwatch: ["Bluetooth", "Health data", "Notifications", "Location"],
  "Health Devices": ["Bluetooth", "Health data", "Background refresh"],
  Earbuds: ["Bluetooth", "Microphone", "Audio routing"],
  Phone: ["Bluetooth", "Notifications", "Contacts", "Location"],
  "Other Devices": ["Wi-Fi", "Local network access", "Microphone"],
};

interface DevicePairingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceCategory: string | null;
  connectedDevices: string[];
  onDeviceConnected: (deviceId: string, deviceName: string, category: string) => void;
  onDeviceDisconnected: (deviceId: string) => void;
}

const DevicePairingSheet = ({
  open, onOpenChange, deviceCategory,
  connectedDevices, onDeviceConnected, onDeviceDisconnected,
}: DevicePairingSheetProps) => {
  const [step, setStep] = useState<PairingStep>("idle");
  const [permissionsGranted, setPermissionsGranted] = useState<string[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [pairProgress, setPairProgress] = useState(0);
  const [failReason, setFailReason] = useState("");
  const scanTimerRef = useRef<number | null>(null);

  const permissions = deviceCategory ? (PERMISSION_TYPES[deviceCategory] || []) : [];
  const DeviceIcon = deviceCategory ? (DEVICE_ICONS[deviceCategory] || Wifi) : Wifi;

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (open && deviceCategory) {
      setStep("permissions");
      setPermissionsGranted([]);
      setDiscoveredDevices([]);
      setSelectedDevice(null);
      setScanProgress(0);
      setPairProgress(0);
      setFailReason("");
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    }
  }, [open, deviceCategory]);

  const grantPermission = (perm: string) => {
    setPermissionsGranted((prev) => [...prev, perm]);
  };

  const allPermissionsGranted = permissions.every((p) => permissionsGranted.includes(p));

  const startScanning = useCallback(() => {
    setStep("scanning");
    setScanProgress(0);
    setDiscoveredDevices([]);

    const devices = deviceCategory ? (DISCOVERED_DEVICES[deviceCategory] || []) : [];
    let progress = 0;
    let devicesFound = 0;

    scanTimerRef.current = window.setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 100) progress = 100;
      setScanProgress(progress);

      // Discover devices progressively
      if (devicesFound < devices.length && Math.random() > 0.4) {
        const newDevice = devices[devicesFound];
        setDiscoveredDevices((prev) => [...prev, newDevice]);
        devicesFound++;
      }

      if (progress >= 100) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        // Add remaining devices
        setDiscoveredDevices(devices);
        setStep("found");
      }
    }, 400);
  }, [deviceCategory]);

  const startPairing = useCallback((device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setStep("pairing");
    setPairProgress(0);

    let progress = 0;
    const willFail = Math.random() < 0.15; // 15% chance of failure
    const failAt = 40 + Math.random() * 40;

    const timer = setInterval(() => {
      progress += Math.random() * 12 + 3;
      if (progress > 100) progress = 100;
      setPairProgress(progress);

      if (willFail && progress >= failAt) {
        clearInterval(timer);
        setStep("failed");
        const reasons = [
          "Device out of range. Move closer and try again.",
          "Connection timed out. Make sure the device is in pairing mode.",
          "Authentication failed. Check that the device is not connected to another phone.",
          "Bluetooth error. Toggle Bluetooth off and on, then retry.",
        ];
        setFailReason(reasons[Math.floor(Math.random() * reasons.length)]);
        return;
      }

      if (progress >= 100) {
        clearInterval(timer);
        setStep("connected");
        onDeviceConnected(device.id, device.name, device.type);
        toast.success(`${device.name} connected successfully`);
      }
    }, 300);
  }, [onDeviceConnected]);

  const retry = () => {
    if (selectedDevice) {
      startPairing(selectedDevice);
    } else {
      startScanning();
    }
  };

  const renderContent = () => {
    switch (step) {
      case "permissions":
        return (
          <motion.div key="permissions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DeviceIcon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">Connect {deviceCategory}</p>
                <p className="text-[12px] text-muted-foreground">Grant permissions to continue</p>
              </div>
            </div>

            <div className="space-y-2">
              {permissions.map((perm) => {
                const granted = permissionsGranted.includes(perm);
                return (
                  <button
                    key={perm}
                    onClick={() => !granted && grantPermission(perm)}
                    disabled={granted}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      granted
                        ? "border-primary/30 bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      granted ? "bg-primary" : "border-2 border-muted-foreground/30"
                    }`}>
                      {granted && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <span className={`text-[13px] ${granted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {perm}
                    </span>
                    {!granted && (
                      <span className="ml-auto text-[11px] text-primary font-medium">Allow</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={startScanning}
              disabled={!allPermissionsGranted}
              className={`w-full py-3 rounded-xl text-[14px] font-medium transition-all ${
                allPermissionsGranted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {allPermissionsGranted ? "Start scanning" : `Grant all permissions (${permissionsGranted.length}/${permissions.length})`}
            </button>
          </motion.div>
        );

      case "scanning":
        return (
          <motion.div key="scanning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex flex-col items-center text-center py-4">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
              >
                <BluetoothSearching size={28} className="text-primary" />
              </motion.div>
              <p className="text-[15px] font-semibold text-foreground">Scanning for devices…</p>
              <p className="text-[12px] text-muted-foreground mt-1">Make sure your device is nearby and in pairing mode</p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                style={{ width: `${scanProgress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* Discovered devices appearing */}
            {discoveredDevices.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Found {discoveredDevices.length} device{discoveredDevices.length > 1 ? "s" : ""}
                </p>
                {discoveredDevices.map((device, i) => (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50"
                  >
                    <DeviceIcon size={16} className="text-muted-foreground" />
                    <span className="text-[13px] text-foreground flex-1">{device.name}</span>
                    <Loader2 size={14} className="text-muted-foreground animate-spin" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        );

      case "found":
        return (
          <motion.div key="found" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  {discoveredDevices.length} device{discoveredDevices.length > 1 ? "s" : ""} found
                </p>
                <p className="text-[12px] text-muted-foreground">Select a device to pair</p>
              </div>
              <button
                onClick={startScanning}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              >
                <RefreshCw size={14} className="text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              {discoveredDevices.map((device) => {
                const isAlreadyConnected = connectedDevices.includes(device.id);
                return (
                  <button
                    key={device.id}
                    onClick={() => !isAlreadyConnected && startPairing(device)}
                    disabled={isAlreadyConnected}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${
                      isAlreadyConnected
                        ? "border-primary/20 bg-primary/5 opacity-60"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <DeviceIcon size={18} className="text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{device.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Signal size={10} />
                          {device.signal}%
                        </span>
                        {device.battery !== undefined && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Battery size={10} />
                            {device.battery}%
                          </span>
                        )}
                      </div>
                    </div>
                    {isAlreadyConnected ? (
                      <span className="text-[11px] text-primary font-medium">Connected</span>
                    ) : (
                      <ChevronRight size={16} className="text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        );

      case "pairing":
        return (
          <motion.div key="pairing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex flex-col items-center text-center py-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
              >
                <Bluetooth size={28} className="text-primary" />
              </motion.div>
              <p className="text-[15px] font-semibold text-foreground">Pairing with {selectedDevice?.name}…</p>
              <p className="text-[12px] text-muted-foreground mt-1">Establishing secure connection</p>
            </div>

            <div className="space-y-2">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${pairProgress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{pairProgress < 30 ? "Authenticating…" : pairProgress < 70 ? "Exchanging keys…" : "Finalizing…"}</span>
                <span>{Math.round(pairProgress)}%</span>
              </div>
            </div>
          </motion.div>
        );

      case "connected":
        return (
          <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex flex-col items-center text-center py-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4"
              >
                <Check size={28} className="text-primary" />
              </motion.div>
              <p className="text-[15px] font-semibold text-foreground">Connected!</p>
              <p className="text-[13px] text-muted-foreground mt-1">{selectedDevice?.name}</p>
              {selectedDevice && (
                <div className="flex items-center gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Signal size={12} /> {selectedDevice.signal}% signal
                  </span>
                  {selectedDevice.battery !== undefined && (
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Battery size={12} /> {selectedDevice.battery}% battery
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </motion.div>
        );

      case "failed":
        return (
          <motion.div key="failed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Connection failed</p>
              <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed px-4">{failReason}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={retry}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="w-full py-3 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[16px] font-semibold">
            {step === "permissions" && "Permissions Required"}
            {step === "scanning" && "Scanning"}
            {step === "found" && "Available Devices"}
            {step === "pairing" && "Pairing"}
            {step === "connected" && "Success"}
            {step === "failed" && "Error"}
          </SheetTitle>
        </SheetHeader>
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
};

export default DevicePairingSheet;
