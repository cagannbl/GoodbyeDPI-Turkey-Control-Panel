using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public class LocalDnsServer
    {
        private readonly FallbackDohResolver _resolver;
        private readonly Action<string> _logCallback;
        private UdpClient? _udpListener;
        private bool _running;
        private CancellationTokenSource? _cts;

        public LocalDnsServer(FallbackDohResolver resolver, Action<string> logCallback)
        {
            _resolver = resolver;
            _logCallback = logCallback;
        }

        public async Task StartAsync()
        {
            try
            {
                _udpListener = new UdpClient(53);
                _running = true;
                _cts = new CancellationTokenSource();
                _logCallback("Local DNS Server (DoH resolver) başlatıldı. UDP Port: 53");

                while (_running)
                {
                    var result = await _udpListener.ReceiveAsync(_cts.Token);
                    _ = Task.Run(() => HandleDnsQueryAsync(result, _cts.Token));
                }
            }
            catch (Exception ex)
            {
                _logCallback("DNS Sunucusu başlatılamadı (Port 53 meşgul olabilir veya yetki yetersizdir): " + ex.Message);
            }
        }

        public void Stop()
        {
            _running = false;
            _cts?.Cancel();
            try { _udpListener?.Close(); } catch {}
            _logCallback("Local DNS Server durduruldu.");
        }

        private async Task HandleDnsQueryAsync(UdpReceiveResult request, CancellationToken ct)
        {
            try
            {
                byte[] queryData = request.Buffer;
                if (queryData == null || queryData.Length < 12) return;

                ushort txId = (ushort)((queryData[0] << 8) | queryData[1]);
                ushort flags = (ushort)((queryData[2] << 8) | queryData[3]);

                if ((flags & 0x8000) != 0) return; // Ignore response packets

                ushort qdCount = (ushort)((queryData[4] << 8) | queryData[5]);
                if (qdCount == 0) return;

                int pos = 12;
                var domainName = new StringBuilder();
                
                while (pos < queryData.Length)
                {
                    byte len = queryData[pos++];
                    if (len == 0) break;
                    
                    // Bounds check before reading string content
                    if (pos + len > queryData.Length)
                    {
                        return; // Malformed packet / out of bounds
                    }
                    
                    if (domainName.Length > 0) domainName.Append(".");
                    domainName.Append(Encoding.ASCII.GetString(queryData, pos, len));
                    pos += len;
                }

                if (pos + 4 > queryData.Length) return;
                ushort qType = (ushort)((queryData[pos] << 8) | queryData[pos + 1]);
                ushort qClass = (ushort)((queryData[pos + 2] << 8) | queryData[pos + 3]);
                pos += 4;

                // Handle IPv6 (AAAA) queries immediately with an empty NOERROR reply
                if (qClass == 1 && qType == 28)
                {
                    await SendFailureResponseAsync(request.RemoteEndPoint, txId, queryData, 0, ct); // NOERROR (rcode: 0)
                    return;
                }

                // Only respond to standard Class IN, Type A (IPv4) queries
                if (qType != 1 || qClass != 1)
                {
                    await SendFailureResponseAsync(request.RemoteEndPoint, txId, queryData, 4, ct); // Not Implemented
                    return;
                }

                string hostname = domainName.ToString();
                string? ipStr = await _resolver.ResolveIpWithFallbackAsync(hostname);
                if (string.IsNullOrEmpty(ipStr) || !IPAddress.TryParse(ipStr, out var ip))
                {
                    await SendFailureResponseAsync(request.RemoteEndPoint, txId, queryData, 3, ct); // Name Error (NXDomain)
                    return;
                }

                if (_udpListener == null) return;

                using (var ms = new MemoryStream())
                {
                    using (var bw = new BinaryWriter(ms))
                    {
                        bw.Write((byte)(txId >> 8)); bw.Write((byte)(txId & 0xFF));
                        bw.Write((byte)0x81); bw.Write((byte)0x80); // Response, No Error
                        bw.Write((byte)0x00); bw.Write((byte)0x01); // Questions: 1
                        bw.Write((byte)0x00); bw.Write((byte)0x01); // Answers: 1
                        bw.Write((byte)0x00); bw.Write((byte)0x00);
                        bw.Write((byte)0x00); bw.Write((byte)0x00);

                        bw.Write(queryData, 12, pos - 12); // Re-echo question

                        bw.Write((byte)0xC0); bw.Write((byte)0x0C); // Pointer to domain in question
                        bw.Write((byte)0x00); bw.Write((byte)0x01); // Type: A
                        bw.Write((byte)0x00); bw.Write((byte)0x01); // Class: IN
                        bw.Write((byte)0x00); bw.Write((byte)0x00); bw.Write((byte)0x00); bw.Write((byte)0x3C); // TTL: 60s
                        bw.Write((byte)0x00); bw.Write((byte)0x04); // Data length: 4
                        bw.Write(ip.GetAddressBytes());

                        byte[] responseData = ms.ToArray();
                        await _udpListener.SendAsync(responseData.AsMemory(), request.RemoteEndPoint, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                _logCallback?.Invoke("DNS sorgu işleme hatası: " + ex.Message);
            }
        }

        private async Task SendFailureResponseAsync(IPEndPoint remoteEp, ushort txId, byte[] queryData, byte rcode, CancellationToken ct)
        {
            if (_udpListener == null) return;
            try
            {
                using (var ms = new MemoryStream())
                {
                    using (var bw = new BinaryWriter(ms))
                    {
                        bw.Write((byte)(txId >> 8)); bw.Write((byte)(txId & 0xFF));
                        bw.Write((byte)0x81); bw.Write((byte)(0x80 | rcode));
                        bw.Write((byte)0x00); bw.Write((byte)0x01); // Questions: 1
                        bw.Write((byte)0x00); bw.Write((byte)0x00); // Answers: 0
                        bw.Write((byte)0x00); bw.Write((byte)0x00);
                        bw.Write((byte)0x00); bw.Write((byte)0x00);

                        int pos = 12;
                        if (queryData != null && queryData.Length >= 12)
                        {
                            while (pos < queryData.Length)
                            {
                                byte len = queryData[pos++];
                                if (len == 0) break;
                                // Bounds check to make sure we don't advance pos past the queryData length
                                if (pos + len > queryData.Length)
                                {
                                    pos = queryData.Length; // Force termination or truncation
                                    break;
                                }
                                pos += len;
                            }
                            pos += 4;
                            if (pos <= queryData.Length)
                            {
                                bw.Write(queryData, 12, pos - 12);
                            }
                        }

                        byte[] responseData = ms.ToArray();
                        await _udpListener.SendAsync(responseData.AsMemory(), remoteEp, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                _logCallback?.Invoke($"SendFailureResponseAsync hatası: {ex.Message}");
            }
        }
    }
}
