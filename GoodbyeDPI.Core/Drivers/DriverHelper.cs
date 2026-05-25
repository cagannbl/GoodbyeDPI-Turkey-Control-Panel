using System;
using System.IO;
using System.IO.Compression;
using System.ServiceProcess;
using System.Text;
using Microsoft.Win32;

namespace GoodbyeDPI.Core.Drivers
{
    public static class DriverHelper
    {
        /// <summary>
        /// Forces stopping and removing legacy driver handles via Service API and Registry ControlSet.
        /// </summary>
        public static void ForceUnloadWinDivert()
        {
            StopDriverService("WinDivert");
            StopDriverService("WinDivert14");

            try
            {
                using (RegistryKey? key = Registry.LocalMachine.OpenSubKey(@"System\CurrentControlSet\Services", true))
                {
                    if (key != null)
                    {
                        key.DeleteSubKeyTree("WinDivert", false);
                        key.DeleteSubKeyTree("WinDivert14", false);
                    }
                }
            }
            catch {}
        }

        private static void StopDriverService(string name)
        {
            try
            {
                using (var sc = new ServiceController(name))
                {
                    if (sc.Status != ServiceControllerStatus.Stopped)
                    {
                        sc.Stop();
                        sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(3));
                    }
                }
            }
            catch {}
        }

        /// <summary>
        /// Generates a troubleshooting zip archive containing bypass outputs and system specifications.
        /// </summary>
        public static void GenerateDiagnosticPack(string outputPath, string bypassLogPath)
        {
            string tempDir = Path.Combine(Path.GetTempPath(), "GoodbyeDPI_Diag_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            try
            {
                if (File.Exists(bypassLogPath))
                {
                    File.Copy(bypassLogPath, Path.Combine(tempDir, "goodbyedpi_bypass.log"), true);
                }

                var sb = new StringBuilder();
                sb.AppendLine("=== GOODBYEDPI TURKEY DIAGNOSTIC REPORT ===");
                sb.AppendLine(string.Format("Timestamp: {0}", DateTime.Now));
                sb.AppendLine(string.Format("OS Version: {0}", Environment.OSVersion));
                sb.AppendLine(string.Format("64-bit Architecture: {0}", Environment.Is64BitOperatingSystem));
                sb.AppendLine(string.Format("Machine Name: {0}", Environment.MachineName));
                
                File.WriteAllText(Path.Combine(tempDir, "diagnostic_report.txt"), sb.ToString(), Encoding.UTF8);

                if (File.Exists(outputPath))
                {
                    File.Delete(outputPath);
                }
                
                ZipFile.CreateFromDirectory(tempDir, outputPath);
            }
            finally
            {
                try
                {
                    Directory.Delete(tempDir, true);
                }
                catch {}
            }
        }
    }
}
