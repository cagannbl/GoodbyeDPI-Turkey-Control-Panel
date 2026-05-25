using System.Threading.Tasks;

namespace GoodbyeDPI.Core.IPC
{
    public interface IGoodbyeDpiService
    {
        Task<bool> StartBypassAsync(string arguments);
        Task<bool> StopBypassAsync();
        Task<bool> SetDnsAsync(string[] dnsServers);
        Task<bool> ResetDnsAsync();
        Task<string> GetServiceStatusAsync();
    }
}
