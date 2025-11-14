import { platform } from "node:os";
import { logger } from "@reliverse/dler-logger";
import { $ } from "bun";

/**
 * Kills processes running on the specified port
 * @param port - The port number to kill processes on
 */
export async function killPort(port: number): Promise<void> {
  const portStr = port.toString();

  try {
    if (platform() === "win32") {
      // Windows command to find and kill processes using the port
      logger.info(`🔍 Finding processes using port ${port}...`);

      // Find processes using the port
      let tcpOutput: string = "";
      let udpOutput: string = "";

      try {
        // Check both TCP and UDP separately
        const tcpResult = await $`netstat -ano | findstr :${portStr}`.nothrow();
        const udpResult =
          await $`netstat -ano | findstr UDP | findstr :${portStr}`.nothrow();

        tcpOutput = tcpResult.stdout.toString();
        udpOutput = udpResult.stdout.toString();

        const processOutput = tcpOutput + udpOutput;

        if (!processOutput.trim()) {
          logger.success(`✅ No processes found using port ${port}`);
          return;
        }

        // Analyze the output to determine port types
        const hasTcp = tcpOutput.trim().length > 0;
        const hasUdp = udpOutput.trim().length > 0;

        logger.info(`📋 Processes using port ${port}:`);
        if (hasTcp) {
          logger.info(`  TCP:`);
          logger.info(tcpOutput);
        }
        if (hasUdp) {
          logger.info(`  UDP:`);
          logger.info(udpOutput);

          // Provide detailed UDP information
          logger.info(`\n⚠️  UDP Port Detection - Important Information:`);
          logger.info(`   • UDP ports are connectionless and harder to detect`);
          logger.info(`   • Some UDP processes may not show up in netstat`);
          logger.info(
            `   • UDP processes are often system services or drivers`,
          );
          logger.info(
            `   • Killing UDP processes may require elevated privileges`,
          );
          logger.info(`   • Some UDP processes restart automatically`);
          logger.info(`\n💡 If you're having trouble with UDP port ${port}:`);
          logger.info(`   1. Try running as Administrator`);
          logger.info(`   2. Check if it's a system service: services.msc`);
          logger.info(`   3. Use Task Manager to find the process by name`);
          logger.info(
            `   4. Restart the application that should use this port`,
          );
          logger.info(`   5. Check Windows Firewall settings`);
        }

        // Extract PIDs from both TCP and UDP output
        const allLines = (tcpOutput + udpOutput).trim().split("\n");
        const pids = new Set<string>();

        for (const line of allLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const pid = parts[parts.length - 1];
            if (pid && !Number.isNaN(Number(pid))) {
              pids.add(pid);
            }
          }
        }

        if (pids.size === 0) {
          logger.warn(`⚠️  No valid PIDs found for port ${port}`);
          if (hasUdp) {
            logger.info(`\n🔍 UDP Port Troubleshooting:`);
            logger.info(`   This might be a UDP-only port. Try these steps:`);
            logger.info(`   1. Check if any applications are using this port`);
            logger.info(`   2. Look for processes in Task Manager`);
            logger.info(`   3. Try restarting your application`);
            logger.info(`   4. Check Windows Defender or antivirus software`);
          }
          return;
        }

        // Kill each process
        for (const pid of pids) {
          try {
            logger.info(`💀 Killing process ${pid}...`);
            await $`taskkill /PID ${pid} /F`;
            logger.success(`✅ Successfully killed process ${pid}`);
          } catch (error) {
            logger.error(
              `❌ Failed to kill process ${pid}:`,
              error instanceof Error ? error.message : String(error),
            );
            if (hasUdp) {
              logger.info(
                `   💡 This might be a system process or require elevated privileges`,
              );
            }
          }
        }

        logger.success(`🎉 Finished killing processes on port ${port}`);
        return;
      } catch (error) {
        // If netstat fails, try using PowerShell instead
        try {
          // Check both TCP and UDP with PowerShell
          const tcpPsResult =
            await $`powershell -Command "Get-NetTCPConnection -LocalPort ${portStr} -ErrorAction SilentlyContinue | Select-Object OwningProcess"`.nothrow();
          const udpPsResult =
            await $`powershell -Command "Get-NetUDPEndpoint -LocalPort ${portStr} -ErrorAction SilentlyContinue | Select-Object OwningProcess"`.nothrow();

          const tcpLines = tcpPsResult.stdout
            .toString()
            .trim()
            .split("\n")
            .filter((line) => line.trim() && !line.includes("OwningProcess"));
          const udpLines = udpPsResult.stdout
            .toString()
            .trim()
            .split("\n")
            .filter((line) => line.trim() && !line.includes("OwningProcess"));

          if (tcpLines.length === 0 && udpLines.length === 0) {
            logger.success(`✅ No processes found using port ${port}`);
            return;
          }

          logger.info(`📋 Processes using port ${port} (PowerShell):`);
          const pids = new Set<string>();

          if (tcpLines.length > 0) {
            logger.info(`  TCP:`);
            for (const line of tcpLines) {
              const pid = line.trim();
              if (pid && !Number.isNaN(Number(pid))) {
                pids.add(pid);
                logger.info(`    PID: ${pid}`);
              }
            }
          }

          if (udpLines.length > 0) {
            logger.info(`  UDP:`);
            for (const line of udpLines) {
              const pid = line.trim();
              if (pid && !Number.isNaN(Number(pid))) {
                pids.add(pid);
                logger.info(`    PID: ${pid}`);
              }
            }

            // Provide detailed UDP information
            logger.info(`\n⚠️  UDP Port Detection - Important Information:`);
            logger.info(
              `   • UDP ports are connectionless and harder to detect`,
            );
            logger.info(`   • Some UDP processes may not show up in netstat`);
            logger.info(
              `   • UDP processes are often system services or drivers`,
            );
            logger.info(
              `   • Killing UDP processes may require elevated privileges`,
            );
            logger.info(`   • Some UDP processes restart automatically`);
            logger.info(`\n💡 If you're having trouble with UDP port ${port}:`);
            logger.info(`   1. Try running as Administrator`);
            logger.info(`   2. Check if it's a system service: services.msc`);
            logger.info(`   3. Use Task Manager to find the process by name`);
            logger.info(
              `   4. Restart the application that should use this port`,
            );
            logger.info(`   5. Check Windows Firewall settings`);
          }

          if (pids.size === 0) {
            logger.warn(`⚠️  No valid PIDs found for port ${port}`);
            if (udpLines.length > 0) {
              logger.info(`\n🔍 UDP Port Troubleshooting:`);
              logger.info(`   This might be a UDP-only port. Try these steps:`);
              logger.info(
                `   1. Check if any applications are using this port`,
              );
              logger.info(`   2. Look for processes in Task Manager`);
              logger.info(`   3. Try restarting your application`);
              logger.info(`   4. Check Windows Defender or antivirus software`);
            }
            return;
          }

          // Kill each process
          for (const pid of pids) {
            try {
              logger.info(`💀 Killing process ${pid}...`);
              await $`taskkill /PID ${pid} /F`;
              logger.success(`✅ Successfully killed process ${pid}`);
            } catch (killError) {
              logger.error(
                `❌ Failed to kill process ${pid}:`,
                killError instanceof Error
                  ? killError.message
                  : String(killError),
              );
              if (udpLines.length > 0) {
                logger.info(
                  `   💡 This might be a system process or require elevated privileges`,
                );
              }
            }
          }

          logger.success(`🎉 Finished killing processes on port ${port}`);
          return;
        } catch (psError) {
          // Check if it's a "no processes found" error by looking at stderr
          const errorOutput =
            psError instanceof Error && "stderr" in psError
              ? (psError as any).stderr
              : "";
          if (
            errorOutput.includes("No MSFT_NetTCPConnection objects found") ||
            errorOutput.includes("No MSFT_NetUDPEndpoint objects found") ||
            errorOutput.includes("ObjectNotFound")
          ) {
            logger.success(`✅ No processes found using port ${port}`);
            return;
          }
          logger.error(
            `❌ Both netstat and PowerShell failed:`,
            psError instanceof Error ? psError.message : String(psError),
          );
          process.exit(1);
        }
      }
    } else {
      // Unix-like systems (macOS, Linux)
      logger.info(`🔍 Finding processes using port ${port}...`);

      // Find processes using the port
      try {
        const tcpResult = await $`lsof -ti:${portStr}`.nothrow();
        const udpResult = await $`lsof -ti:UDP:${portStr}`.nothrow();

        const tcpPids = tcpResult.stdout.toString().trim();
        const udpPids = udpResult.stdout.toString().trim();

        if (!tcpPids && !udpPids) {
          logger.success(`✅ No processes found using port ${port}`);
          return;
        }

        logger.info(`📋 Processes using port ${port}:`);
        const allPids = new Set<string>();

        if (tcpPids) {
          logger.info(`  TCP:`);
          const tcpPidList = tcpPids.split("\n").filter((pid) => pid.trim());
          for (const pid of tcpPidList) {
            allPids.add(pid);
            logger.info(`    PID: ${pid}`);
          }
        }

        if (udpPids) {
          logger.info(`  UDP:`);
          const udpPidList = udpPids.split("\n").filter((pid) => pid.trim());
          for (const pid of udpPidList) {
            allPids.add(pid);
            logger.info(`    PID: ${pid}`);
          }

          // Provide detailed UDP information
          logger.info(`\n⚠️  UDP Port Detection - Important Information:`);
          logger.info(`   • UDP ports are connectionless and harder to detect`);
          logger.info(`   • Some UDP processes may not show up in lsof`);
          logger.info(
            `   • UDP processes are often system services or daemons`,
          );
          logger.info(`   • Killing UDP processes may require sudo privileges`);
          logger.info(`   • Some UDP processes restart automatically`);
          logger.info(`\n💡 If you're having trouble with UDP port ${port}:`);
          logger.info(
            `   1. Try running with sudo: sudo bun dler port kill --port ${port}`,
          );
          logger.info(
            `   2. Check if it's a system service: systemctl status <service>`,
          );
          logger.info(`   3. Use ps aux | grep <port> to find the process`);
          logger.info(
            `   4. Restart the application that should use this port`,
          );
          logger.info(
            `   5. Check firewall settings: ufw status or iptables -L`,
          );
        }

        const pidList = Array.from(allPids);

        // Kill each process
        for (const pid of pidList) {
          try {
            logger.info(`💀 Killing process ${pid}...`);
            await $`kill -9 ${pid}`;
            logger.success(`✅ Successfully killed process ${pid}`);
          } catch (error) {
            logger.error(
              `❌ Failed to kill process ${pid}:`,
              error instanceof Error ? error.message : String(error),
            );
            if (udpPids) {
              logger.info(
                `   💡 This might be a system process or require sudo privileges`,
              );
            }
          }
        }
      } catch (error) {
        // lsof returns exit code 1 when no processes are found, which is normal
        logger.success(`✅ No processes found using port ${port}`);
        return;
      }
    }

    logger.success(`🎉 Finished killing processes on port ${port}`);
  } catch (error) {
    logger.error(
      `❌ Error killing processes on port ${port}:`,
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
