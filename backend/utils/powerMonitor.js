const { execSync } = require("child_process");

function isOnBattery() {
    try {
        const output = execSync(
            "WMIC Path Win32_Battery Get BatteryStatus",
            { encoding: "utf-8" }
        );

        // BatteryStatus meanings:
        // 1 = Discharging (ON BATTERY)
        // 2 = AC Charging (PLUGGED IN)
        // 6 = Charging

        return output.includes("1");
    } catch {
        // If no battery info (desktop), assume plugged in
        return false;
    }
}

module.exports = { isOnBattery };
