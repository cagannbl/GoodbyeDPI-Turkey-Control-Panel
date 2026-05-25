using System;
using System.Diagnostics;
using System.ServiceProcess;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class ServiceManager
    {
        private const string ServiceName = "GoodbyeDPI";

        private static bool IsAdministrator()
        {
            using (var identity = System.Security.Principal.WindowsIdentity.GetCurrent())
            {
                var principal = new System.Security.Principal.WindowsPrincipal(identity);
                return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            }
        }

        private static async Task<bool> RunElevatedTaskAsync(string taskArgs)
        {
            var tcs = new TaskCompletionSource<bool>();
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule.FileName;
                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--elevated-task " + taskArgs,
                    Verb = "runas",
                    UseShellExecute = true,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                var process = new Process { StartInfo = psi };
                process.EnableRaisingEvents = true;
                process.Exited += (sender, e) =>
                {
                    tcs.TrySetResult(process.ExitCode == 0);
                    process.Dispose();
                };

                if (process.Start())
                {
                    await tcs.Task;
                    return true;
                }
            }
            catch {}
            return false;
        }

        /// <summary>
        /// Checks the service status. Accessible by Standard Users.
        /// </summary>
        public async Task<ServiceControllerStatus?> GetStatusAsync()
        {
            return await Task.Run(() =>
            {
                try
                {
                    using (var sc = new ServiceController(ServiceName))
                    {
                        return (ServiceControllerStatus?)sc.Status;
                    }
                }
                catch
                {
                    return null; // Not installed
                }
            });
        }

        /// <summary>
        /// Starts the service, requesting UAC if not Administrator.
        /// </summary>
        public async Task<bool> StartServiceAsync()
        {
            if (!IsAdministrator())
            {
                return await RunElevatedTaskAsync("service-start");
            }

            return await Task.Run(() =>
            {
                try
                {
                    using (var sc = new ServiceController(ServiceName))
                    {
                        if (sc.Status == ServiceControllerStatus.Stopped)
                        {
                            sc.Start();
                            sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(5));
                            return true;
                        }
                    }
                }
                catch {}
                return false;
            });
        }

        /// <summary>
        /// Stops the service, requesting UAC if not Administrator.
        /// </summary>
        public async Task<bool> StopServiceAsync()
        {
            if (!IsAdministrator())
            {
                return await RunElevatedTaskAsync("service-stop");
            }

            return await Task.Run(() =>
            {
                try
                {
                    using (var sc = new ServiceController(ServiceName))
                    {
                        if (sc.Status == ServiceControllerStatus.Running || sc.Status == ServiceControllerStatus.StartPending)
                        {
                            sc.Stop();
                            sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(5));
                            return true;
                        }
                    }
                }
                catch {}
                return false;
            });
        }

        /// <summary>
        /// Installs the GoodbyeDPI Windows service, requesting UAC if not Administrator.
        /// </summary>
        public async Task<bool> InstallServiceAsync(string exePath, string arguments)
        {
            if (!IsAdministrator())
            {
                // Put arguments inside double quotes for Command line parsing safety
                string taskArgs = string.Format("service-install \"{0}\" \"{1}\"", exePath, arguments);
                return await RunElevatedTaskAsync(taskArgs);
            }

            try
            {
                var executor = new CommandExecutor();
                await StopServiceAsync();
                await executor.RunCommandAsync("sc", new[] { "delete", "GoodbyeDPI" });
                await Task.Delay(500);

                await executor.RunCommandAsync("sc", new[] { 
                    "create", "GoodbyeDPI", 
                    "binPath=", string.Format("\"{0}\" {1}", exePath, arguments), 
                    "start=", "auto" 
                });

                await executor.RunCommandAsync("sc", new[] { 
                    "description", "GoodbyeDPI", 
                    "GoodbyeDPI Turkey DPI Bypass Service" 
                });

                await StartServiceAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Removes the GoodbyeDPI Windows service and all WinDivert drivers, requesting UAC if not Administrator.
        /// </summary>
        public async Task<bool> RemoveServiceAsync()
        {
            if (!IsAdministrator())
            {
                return await RunElevatedTaskAsync("service-remove");
            }

            try
            {
                var executor = new CommandExecutor();
                await StopServiceAsync();
                await executor.RunCommandAsync("sc", new[] { "delete", "GoodbyeDPI" });
                await executor.RunCommandAsync("sc", new[] { "stop", "WinDivert" });
                await executor.RunCommandAsync("sc", new[] { "delete", "WinDivert" });
                await executor.RunCommandAsync("sc", new[] { "stop", "WinDivert14" });
                await executor.RunCommandAsync("sc", new[] { "delete", "WinDivert14" });
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
