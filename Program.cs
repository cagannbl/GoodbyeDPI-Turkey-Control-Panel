using System;
using System.Diagnostics;
using System.Windows;

namespace GoodbyeDPILauncher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "--elevated-task")
            {
                RunElevatedTask(args);
                return;
            }

            var app = new Application();
            var mainWindow = new MainWindow();
            app.Run(mainWindow);
        }

        private static void RunElevatedTask(string[] args)
        {
            try
            {
                if (args.Length < 2) return;
                string task = args[1];

                if (task == "dns-set")
                {
                    if (args.Length < 3) return;
                    string dnsServersCsv = args[2];
                    string[] dnsServers = dnsServersCsv.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                    var executor = new CommandExecutor();
                    var dnsHelper = new DnsHelper(executor);
                    dnsHelper.SetDnsAsync(dnsServers).Wait();
                }
                else if (task == "dns-reset")
                {
                    var executor = new CommandExecutor();
                    var dnsHelper = new DnsHelper(executor);
                    dnsHelper.ResetDnsAsync().Wait();
                }
                else if (task == "service-install")
                {
                    if (args.Length < 4) return;
                    string exePath = args[2];
                    string arguments = args[3];
                    
                    var executor = new CommandExecutor();
                    var serviceManager = new ServiceManager();
                    
                    serviceManager.StopServiceAsync().Wait();
                    executor.RunCommandAsync("sc", new[] { "delete", "GoodbyeDPI" }).Wait();
                    System.Threading.Thread.Sleep(500);

                    executor.RunCommandAsync("sc", new[] { 
                        "create", "GoodbyeDPI", 
                        "binPath=", string.Format("\"{0}\" {1}", exePath, arguments), 
                        "start=", "auto" 
                    }).Wait();

                    executor.RunCommandAsync("sc", new[] { 
                        "description", "GoodbyeDPI", 
                        "GoodbyeDPI Turkey DPI Bypass Service" 
                    }).Wait();

                    serviceManager.StartServiceAsync().Wait();
                }
                else if (task == "service-start")
                {
                    var serviceManager = new ServiceManager();
                    serviceManager.StartServiceAsync().Wait();
                }
                else if (task == "service-stop")
                {
                    var serviceManager = new ServiceManager();
                    serviceManager.StopServiceAsync().Wait();
                }
                else if (task == "service-remove")
                {
                    var executor = new CommandExecutor();
                    var serviceManager = new ServiceManager();
                    
                    serviceManager.StopServiceAsync().Wait();
                    executor.RunCommandAsync("sc", new[] { "delete", "GoodbyeDPI" }).Wait();
                    executor.RunCommandAsync("sc", new[] { "stop", "WinDivert" }).Wait();
                    executor.RunCommandAsync("sc", new[] { "delete", "WinDivert" }).Wait();
                    executor.RunCommandAsync("sc", new[] { "stop", "WinDivert14" }).Wait();
                    executor.RunCommandAsync("sc", new[] { "delete", "WinDivert14" }).Wait();
                }
                else if (task == "kill-process")
                {
                    if (args.Length < 3) return;
                    string processName = args[2];
                    foreach (var proc in Process.GetProcessesByName(processName))
                    {
                        try { proc.Kill(); } catch {}
                    }
                }
                else if (task == "winsock-reset")
                {
                    var executor = new CommandExecutor();
                    executor.RunCommandAsync("netsh", new[] { "winsock", "reset" }).Wait();
                    executor.RunCommandAsync("ipconfig", new[] { "/flushdns" }).Wait();
                }
            }
            catch {}
        }
    }
}
