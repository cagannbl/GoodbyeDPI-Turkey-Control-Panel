using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Linq;

namespace GoodbyeDPI.Core.Network
{
    public class DiagnosticTools
    {
        public struct DiagResult
        {
            public bool Success;
            public long Latency;
            public string ErrorMessage;

            public DiagResult(bool success, long latency, string errMsg)
            {
                Success = success;
                Latency = latency;
                ErrorMessage = errMsg;
            }
        }

        /// <summary>
        /// Tests a URL connection asynchronously using standard TCP Handshake.
        /// </summary>
        public async Task<DiagResult> TestUrlAsync(string url)
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var uri = new Uri(url);
                using (var tcpClient = new TcpClient())
                {
                    await tcpClient.ConnectAsync(uri.Host, uri.Port);
                    sw.Stop();
                    return new DiagResult(true, sw.ElapsedMilliseconds, "");
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new DiagResult(false, sw.ElapsedMilliseconds, ex.Message);
            }
        }

        /// <summary>
        /// Checks if a local port is currently in use using native .NET NetworkInformation APIs.
        /// </summary>
        public bool IsPortInUse(int port)
        {
            try
            {
                IPGlobalProperties ipProperties = IPGlobalProperties.GetIPGlobalProperties();
                
                // Check if any TCP Listener is bound to this port
                IPEndPoint[] listeners = ipProperties.GetActiveTcpListeners();
                if (listeners.Any(l => l.Port == port)) return true;

                // Check if any active TCP connection uses this port locally
                TcpConnectionInformation[] tcpConnections = ipProperties.GetActiveTcpConnections();
                if (tcpConnections.Any(c => c.LocalEndPoint.Port == port)) return true;
            }
            catch {}
            return false;
        }
    }
}
