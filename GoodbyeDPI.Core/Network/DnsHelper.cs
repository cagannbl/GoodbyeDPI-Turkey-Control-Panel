using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public class DnsHelper
    {
        private readonly CommandExecutor _executor;

        public DnsHelper(CommandExecutor executor)
        {
            _executor = executor;
        }

        public async Task<string> SetDnsAsync(string[] dnsServers)
        {
            if (dnsServers == null || dnsServers.Length == 0)
            {
                return await ResetDnsAsync();
            }

            var ipv4List = dnsServers
                .Where(ip => System.Net.IPAddress.TryParse(ip, out var addr) && addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                .Select(ip => string.Format("'{0}'", ip.Trim()))
                .ToList();

            var ipv6List = dnsServers
                .Where(ip => System.Net.IPAddress.TryParse(ip, out var addr) && addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
                .Select(ip => string.Format("'{0}'", ip.Trim()))
                .ToList();

            if (ipv6List.Count == 0)
            {
                ipv6List.Add("'::1'"); // Block IPv6 DNS leaks by default
            }

            string ipv4String = string.Join(",", ipv4List);
            string ipv6String = string.Join(",", ipv6List);

            string psScript = string.Format(
                "Get-NetAdapter | Where-Object {{ $_.Status -eq 'Up' }} | ForEach-Object {{ " +
                "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses @({0}) -AddressFamily IPv4 -ErrorAction SilentlyContinue; " +
                "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses @({1}) -AddressFamily IPv6 -ErrorAction SilentlyContinue }}", 
                ipv4String, ipv6String
            );

            return await ExecutePowerShellScriptAsync(psScript);
        }

        /// <summary>
        /// Resets active network adapters to use automatic DNS (DHCP).
        /// </summary>
        public async Task<string> ResetDnsAsync()
        {
            string psScript = "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { " +
                             "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses -AddressFamily IPv4 -ErrorAction SilentlyContinue; " +
                             "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses -AddressFamily IPv6 -ErrorAction SilentlyContinue }";
            return await ExecutePowerShellScriptAsync(psScript);
        }

        /// <summary>
        /// Base64 encodes and executes a PowerShell script safely using EncodedCommand.
        /// </summary>
        private async Task<string> ExecutePowerShellScriptAsync(string script)
        {
            byte[] bytes = Encoding.Unicode.GetBytes(script);
            string base64Script = Convert.ToBase64String(bytes);

            string[] args = new[]
            {
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-EncodedCommand", base64Script
            };

            return await _executor.RunCommandAsync("powershell.exe", args);
        }
    }
}
