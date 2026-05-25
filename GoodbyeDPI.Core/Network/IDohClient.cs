using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public interface IDohClient
    {
        Task<string?> QueryAsync(string endpoint, string hostname);
    }
}
