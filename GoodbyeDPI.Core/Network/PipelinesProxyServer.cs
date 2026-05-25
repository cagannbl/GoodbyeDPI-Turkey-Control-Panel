using System;
using System.IO;
using System.IO.Pipelines;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Buffers;

namespace GoodbyeDPI.Core.Network
{
    public class PipelinesProxyServer
    {
        private readonly int _port;
        private readonly string _blacklistPath;
        private readonly Action<string> _logCallback;
        private TcpListener? _listener;
        private bool _running;
        private CancellationTokenSource? _cts;

        public PipelinesProxyServer(int port, string blacklistPath, Action<string> logCallback)
        {
            _port = port;
            _blacklistPath = blacklistPath;
            _logCallback = logCallback;
        }

        public async Task StartAsync()
        {
            _listener = new TcpListener(IPAddress.Any, _port);
            _listener.Start();
            _running = true;
            _cts = new CancellationTokenSource();

            _logCallback(string.Format("System.IO.Pipelines destekli SOCKS5/HTTP Proxy sunucu başlatıldı. Port: {0}", _port));

            try
            {
                while (_running)
                {
                    TcpClient client = await _listener.AcceptTcpClientAsync(_cts.Token);
                    _ = Task.Run(() => HandleClientAsync(client, _cts.Token));
                }
            }
            catch (ObjectDisposedException) {}
            catch (Exception ex)
            {
                _logCallback("Proxy sunucusu hatası: " + ex.Message);
            }
        }

        public void Stop()
        {
            _running = false;
            _cts?.Cancel();
            try
            {
                _listener?.Stop();
            }
            catch {}
            _logCallback("Proxy sunucu durduruldu.");
        }

        private async Task HandleClientAsync(TcpClient client, CancellationToken ct)
        {
            using (client)
            {
                client.ReceiveTimeout = 6000;
                client.SendTimeout = 6000;
                using (NetworkStream clientStream = client.GetStream())
                {
                    try
                    {
                        byte[] buffer = new byte[8192];
                        int bytesRead = await clientStream.ReadAsync(buffer, 0, buffer.Length, ct);
                        if (bytesRead <= 0) return;

                        byte firstByte = buffer[0];
                        if (firstByte == 0x05)
                        {
                            // SOCKS5 Protocol
                            await HandleSocks5Async(client, clientStream, buffer, bytesRead, ct);
                            return;
                        }

                        // HTTP/HTTPS Proxy Protocol fallback
                        string request = Encoding.ASCII.GetString(buffer, 0, bytesRead);
                        string[] lines = request.Split(new[] { "\r\n" }, StringSplitOptions.None);
                        if (lines.Length == 0) return;

                        string[] requestLine = lines[0].Split(' ');
                        if (requestLine.Length < 2) return;

                        string method = requestLine[0];
                        string target = requestLine[1];

                        // PAC File Request (Dynamic)
                        if (method.ToUpper() == "GET" && target.ToLower().Contains("/proxy.pac"))
                        {
                            await ServeDynamicPacFileAsync(clientStream, ct);
                            return;
                        }

                        // HTTPS Tunneling (CONNECT)
                        if (method.ToUpper() == "CONNECT")
                        {
                            string[] parts = target.Split(':');
                            string host = parts[0];
                            int port = parts.Length > 1 ? int.Parse(parts[1]) : 443;

                            using (TcpClient targetClient = new TcpClient())
                            {
                                targetClient.ReceiveTimeout = 6000;
                                targetClient.SendTimeout = 6000;
                                await targetClient.ConnectAsync(host, port, ct);
                                using (NetworkStream targetStream = targetClient.GetStream())
                                {
                                    byte[] response = Encoding.ASCII.GetBytes("HTTP/1.1 200 Connection Established\r\n\r\n");
                                    await clientStream.WriteAsync(response, 0, response.Length, ct);

                                    // Direct bidirectional tunneling using System.IO.Pipelines
                                    await TunnelPipelinesAsync(clientStream, targetStream, ct);
                                }
                            }
                        }
                        else // HTTP Proxy Relay
                        {
                            Uri uri = target.StartsWith("http") ? new Uri(target) : new Uri("http://" + target);
                            string host = uri.Host;
                            int port = uri.Port;

                            using (TcpClient targetClient = new TcpClient())
                            {
                                await targetClient.ConnectAsync(host, port, ct);
                                using (NetworkStream targetStream = targetClient.GetStream())
                                {
                                    await targetStream.WriteAsync(buffer, 0, bytesRead, ct);
                                    await TunnelPipelinesAsync(clientStream, targetStream, ct);
                                }
                            }
                        }
                    }
                    catch {}
                }
            }
        }

        private async Task HandleSocks5Async(TcpClient client, NetworkStream clientStream, byte[] initialBuffer, int initialBytesRead, CancellationToken ct)
        {
            // Initial buffer contains Version (0x05), NMethods, and Methods.
            // Respond with Version 5 (0x05) and Selected Method (0x00 = No Auth)
            byte[] authResponse = new byte[] { 0x05, 0x00 };
            await clientStream.WriteAsync(authResponse, 0, authResponse.Length, ct);

            // Read SOCKS5 request header (4 bytes: ver, cmd, rsv, atyp)
            byte[] reqHeader = new byte[4];
            await ReadExactlyAsync(clientStream, reqHeader, 0, 4, ct);

            byte cmd = reqHeader[1];
            byte atyp = reqHeader[3];

            string host = "";
            int port = 0;

            if (atyp == 0x01) // IPv4
            {
                byte[] ipBytes = new byte[4];
                await ReadExactlyAsync(clientStream, ipBytes, 0, 4, ct);
                host = new IPAddress(ipBytes).ToString();
            }
            else if (atyp == 0x03) // Domain
            {
                int len = clientStream.ReadByte();
                if (len < 0) return;
                byte[] domainBytes = new byte[len];
                await ReadExactlyAsync(clientStream, domainBytes, 0, len, ct);
                host = Encoding.ASCII.GetString(domainBytes);
            }
            else if (atyp == 0x04) // IPv6
            {
                byte[] ipBytes = new byte[16];
                await ReadExactlyAsync(clientStream, ipBytes, 0, 16, ct);
                host = new IPAddress(ipBytes).ToString();
            }
            else
            {
                return;
            }

            byte[] portBytes = new byte[2];
            await ReadExactlyAsync(clientStream, portBytes, 0, 2, ct);
            port = (portBytes[0] << 8) | portBytes[1];

            if (cmd == 0x01) // CONNECT
            {
                try
                {
                    using (TcpClient targetClient = new TcpClient())
                    {
                        targetClient.ReceiveTimeout = 6000;
                        targetClient.SendTimeout = 6000;
                        await targetClient.ConnectAsync(host, port, ct);
                        using (NetworkStream targetStream = targetClient.GetStream())
                        {
                            byte[] reply = new byte[] { 0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
                            await clientStream.WriteAsync(reply, 0, reply.Length, ct);
                            await TunnelPipelinesAsync(clientStream, targetStream, ct);
                        }
                    }
                }
                catch (Exception ex)
                {
                    byte[] failureReply = new byte[] { 0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
                    try { await clientStream.WriteAsync(failureReply, 0, failureReply.Length, ct); } catch {}
                    _logCallback(string.Format("SOCKS5 Connect hatası: {0}:{1} - {2}", host, port, ex.Message));
                }
            }
            else if (cmd == 0x03) // UDP ASSOCIATE
            {
                try
                {
                    var clientTcpEp = (IPEndPoint)client.Client.RemoteEndPoint!;
                    await HandleUdpAssociateAsync(client, clientStream, clientTcpEp, ct);
                }
                catch (Exception ex)
                {
                    byte[] failureReply = new byte[] { 0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
                    try { await clientStream.WriteAsync(failureReply, 0, failureReply.Length, ct); } catch {}
                    _logCallback("SOCKS5 UDP Associate hatası: " + ex.Message);
                }
            }
        }

        private async Task HandleUdpAssociateAsync(TcpClient client, NetworkStream clientStream, IPEndPoint clientTcpEp, CancellationToken ct)
        {
            var udpServer = new UdpClient(new IPEndPoint(IPAddress.Any, 0));
            var localUdpEp = (IPEndPoint)udpServer.Client.LocalEndPoint!;
            int udpPort = localUdpEp.Port;

            var localIp = ((IPEndPoint)client.Client.LocalEndPoint!).Address;
            byte[] ipBytes = localIp.GetAddressBytes();
            if (ipBytes.Length != 4)
            {
                localIp = IPAddress.Loopback;
                ipBytes = localIp.GetAddressBytes();
            }

            byte[] socksResponse = new byte[6 + ipBytes.Length];
            socksResponse[0] = 0x05;
            socksResponse[1] = 0x00; // Success
            socksResponse[2] = 0x00; // Reserved
            socksResponse[3] = (byte)(ipBytes.Length == 4 ? 0x01 : 0x04);
            Array.Copy(ipBytes, 0, socksResponse, 4, ipBytes.Length);
            socksResponse[4 + ipBytes.Length] = (byte)((udpPort >> 8) & 0xFF);
            socksResponse[5 + ipBytes.Length] = (byte)(udpPort & 0xFF);

            await clientStream.WriteAsync(socksResponse, 0, socksResponse.Length, ct);

            var udpCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var forwardingTask = Task.Run(() => RunUdpRelayLoopAsync(udpServer, clientTcpEp.Address, udpCts.Token), ct);

            try
            {
                byte[] dummy = new byte[1024];
                while (true)
                {
                    int read = await clientStream.ReadAsync(dummy, 0, dummy.Length, ct);
                    if (read <= 0) break;
                }
            }
            catch {}
            finally
            {
                udpCts.Cancel();
                try { await forwardingTask; } catch {}
                udpServer.Close();
            }
        }

        private async Task RunUdpRelayLoopAsync(UdpClient udpServer, IPAddress clientIp, CancellationToken ct)
        {
            var targetSockets = new Dictionary<IPEndPoint, UdpClient>();
            var clientUdpEndpoint = new IPEndPoint(clientIp, 0);

            try
            {
                while (!ct.IsCancellationRequested)
                {
                    var result = await udpServer.ReceiveAsync(ct);
                    byte[] data = result.Buffer;
                    var fromEp = result.RemoteEndPoint;

                    if (fromEp.Address.Equals(clientIp))
                    {
                        if (clientUdpEndpoint.Port != fromEp.Port)
                        {
                            clientUdpEndpoint = fromEp;
                        }

                        if (data.Length < 10) continue;
                        byte frag = data[2];
                        if (frag != 0) continue;

                        byte atyp = data[3];
                        int offset = 4;
                        string targetHost = "";
                        IPAddress? targetIp = null;

                        if (atyp == 0x01)
                        {
                            byte[] ipBytes = new byte[4];
                            Array.Copy(data, offset, ipBytes, 0, 4);
                            targetIp = new IPAddress(ipBytes);
                            offset += 4;
                        }
                        else if (atyp == 0x03)
                        {
                            byte len = data[offset++];
                            targetHost = Encoding.ASCII.GetString(data, offset, len);
                            offset += len;
                        }
                        else if (atyp == 0x04)
                        {
                            byte[] ipBytes = new byte[16];
                            Array.Copy(data, offset, ipBytes, 0, 16);
                            targetIp = new IPAddress(ipBytes);
                            offset += 16;
                        }
                        else continue;

                        int targetPort = (data[offset] << 8) | data[offset + 1];
                        offset += 2;

                        int payloadLen = data.Length - offset;
                        if (payloadLen <= 0) continue;

                        byte[] payload = new byte[payloadLen];
                        Array.Copy(data, offset, payload, 0, payloadLen);

                        IPEndPoint? remoteEp = null;
                        if (targetIp != null)
                        {
                            remoteEp = new IPEndPoint(targetIp, targetPort);
                        }
                        else if (!string.IsNullOrEmpty(targetHost))
                        {
                            try
                            {
                                var ips = await Dns.GetHostAddressesAsync(targetHost, ct);
                                if (ips.Length > 0)
                                {
                                    remoteEp = new IPEndPoint(ips[0], targetPort);
                                }
                            }
                            catch {}
                        }

                        if (remoteEp == null) continue;

                        if (!targetSockets.TryGetValue(remoteEp, out var targetSocket))
                        {
                            targetSocket = new UdpClient(new IPEndPoint(IPAddress.Any, 0));
                            targetSockets[remoteEp] = targetSocket;

                            _ = Task.Run(() => ListenToTargetUdpAsync(targetSocket, remoteEp, udpServer, clientUdpEndpoint, atyp, targetHost, ct), ct);
                        }

                        await targetSocket.SendAsync(payload, payload.Length, remoteEp, ct);
                    }
                }
            }
            catch {}
            finally
            {
                foreach (var s in targetSockets.Values)
                {
                    try { s.Close(); } catch {}
                }
            }
        }

        private async Task ListenToTargetUdpAsync(UdpClient targetSocket, IPEndPoint remoteEp, UdpClient udpServer, IPEndPoint clientEp, byte atyp, string targetHost, CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    var result = await targetSocket.ReceiveAsync(ct);
                    byte[] replyPayload = result.Buffer;

                    int headerLen = 0;
                    byte[] header;
                    if (atyp == 0x01)
                    {
                        header = new byte[10];
                        header[0] = 0; header[1] = 0; header[2] = 0; header[3] = 0x01;
                        byte[] ipBytes = remoteEp.Address.GetAddressBytes();
                        Array.Copy(ipBytes, 0, header, 4, 4);
                        header[8] = (byte)((remoteEp.Port >> 8) & 0xFF);
                        header[9] = (byte)(remoteEp.Port & 0xFF);
                        headerLen = 10;
                    }
                    else if (atyp == 0x03)
                    {
                        byte[] hostBytes = Encoding.ASCII.GetBytes(targetHost);
                        header = new byte[6 + hostBytes.Length];
                        header[0] = 0; header[1] = 0; header[2] = 0; header[3] = 0x03;
                        header[4] = (byte)hostBytes.Length;
                        Array.Copy(hostBytes, 0, header, 5, hostBytes.Length);
                        header[5 + hostBytes.Length] = (byte)((remoteEp.Port >> 8) & 0xFF);
                        header[6 + hostBytes.Length] = (byte)(remoteEp.Port & 0xFF);
                        headerLen = header.Length;
                    }
                    else
                    {
                        header = new byte[22];
                        header[0] = 0; header[1] = 0; header[2] = 0; header[3] = 0x04;
                        byte[] ipBytes = remoteEp.Address.GetAddressBytes();
                        Array.Copy(ipBytes, 0, header, 4, 16);
                        header[20] = (byte)((remoteEp.Port >> 8) & 0xFF);
                        header[21] = (byte)(remoteEp.Port & 0xFF);
                        headerLen = 22;
                    }

                    byte[] fullReply = new byte[headerLen + replyPayload.Length];
                    Array.Copy(header, 0, fullReply, 0, headerLen);
                    Array.Copy(replyPayload, 0, fullReply, headerLen, replyPayload.Length);

                    await udpServer.SendAsync(fullReply, fullReply.Length, clientEp, ct);
                }
            }
            catch {}
        }

        private static async Task ReadExactlyAsync(Stream stream, byte[] buffer, int offset, int count, CancellationToken ct)
        {
            int totalRead = 0;
            while (totalRead < count)
            {
                int read = await stream.ReadAsync(buffer, offset + totalRead, count - totalRead, ct);
                if (read <= 0) throw new EndOfStreamException();
                totalRead += read;
            }
        }

        private async Task ServeDynamicPacFileAsync(NetworkStream stream, CancellationToken ct)
        {
            string localIp = "127.0.0.1";
            try
            {
                foreach (var ip in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !ip.ToString().StartsWith("127."))
                    {
                        localIp = ip.ToString();
                        break;
                    }
                }
            }
            catch {}

            var domains = new List<string> { "discord.com", "discordapp.com", "discord.gg", "gateway.discord.gg", "cdn.discordapp.com", "wikipedia.org", "tr.wikipedia.org", "youtube.com", "googlevideo.com", "ytimg.com" };
            try
            {
                if (File.Exists(_blacklistPath))
                {
                    var lines = File.ReadAllLines(_blacklistPath);
                    foreach (var line in lines)
                    {
                        string clean = line.Trim();
                        if (!string.IsNullOrEmpty(clean) && !clean.StartsWith("#") && !domains.Contains(clean))
                        {
                            domains.Add(clean);
                        }
                    }
                }
            }
            catch {}

            var sb = new StringBuilder();
            foreach (var d in domains)
            {
                if (sb.Length > 0) sb.Append(", ");
                sb.AppendFormat("'{0}'", d);
            }

            string pacScript = string.Format(
                "function FindProxyForURL(url, host) {{\n" +
                "    var blocked = [{0}];\n" +
                "    for (var i = 0; i < blocked.length; i++) {{\n" +
                "        if (dnsDomainIs(host, blocked[i]) || shExpMatch(host, '*.' + blocked[i])) {{\n" +
                "            return 'PROXY {1}:8085';\n" +
                "        }}\n" +
                "    }}\n" +
                "    return 'DIRECT';\n" +
                "}}", 
                sb.ToString(),
                localIp
            );

            byte[] scriptBytes = Encoding.UTF8.GetBytes(pacScript);
            string httpResponse = string.Format(
                "HTTP/1.1 200 OK\r\n" +
                "Content-Type: application/x-ns-proxy-autoconfig\r\n" +
                "Content-Length: {0}\r\n" +
                "Connection: close\r\n\r\n", 
                scriptBytes.Length
            );

            byte[] headerBytes = Encoding.ASCII.GetBytes(httpResponse);
            await stream.WriteAsync(headerBytes, 0, headerBytes.Length, ct);
            await stream.WriteAsync(scriptBytes, 0, scriptBytes.Length, ct);
            await stream.FlushAsync(ct);
        }

        private async Task TunnelPipelinesAsync(Stream clientStream, Stream targetStream, CancellationToken ct)
        {
            try
            {
                using (var cts = CancellationTokenSource.CreateLinkedTokenSource(ct))
                {
                    var pipe1 = new Pipe();
                    var pipe2 = new Pipe();

                    var task1 = FillAndDrainPipeAsync(clientStream, targetStream, pipe1, cts.Token);
                    var task2 = FillAndDrainPipeAsync(targetStream, clientStream, pipe2, cts.Token);

                    var completedTask = await Task.WhenAny(task1, task2);
                    cts.Cancel();

                    try
                    {
                        await Task.WhenAll(task1, task2);
                    }
                    catch (Exception)
                    {
                        // Ignore exceptions from cancelled tasks
                    }
                }
            }
            finally
            {
                try { clientStream.Dispose(); } catch {}
                try { targetStream.Dispose(); } catch {}
            }
        }

        private async Task FillAndDrainPipeAsync(Stream source, Stream destination, Pipe pipe, CancellationToken ct)
        {
            using (var cts = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                var fillTask = FillPipeAsync(source, pipe.Writer, cts.Token);
                var readTask = ReadPipeAsync(destination, pipe.Reader, cts.Token);

                var completedTask = await Task.WhenAny(fillTask, readTask);
                cts.Cancel();

                try
                {
                    await Task.WhenAll(fillTask, readTask);
                }
                catch (Exception)
                {
                    // Ignore exceptions from cancelled tasks
                }
            }
        }

        private async Task FillPipeAsync(Stream source, PipeWriter writer, CancellationToken ct)
        {
            const int minimumBufferSize = 8192;
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    Memory<byte> memory = writer.GetMemory(minimumBufferSize);
                    try
                    {
                        int bytesRead = await source.ReadAsync(memory, ct);
                        if (bytesRead <= 0) break;

                        writer.Advance(bytesRead);
                    }
                    catch
                    {
                        break;
                    }

                    FlushResult result = await writer.FlushAsync(ct);
                    if (result.IsCompleted || result.IsCanceled) break;
                }
            }
            finally
            {
                await writer.CompleteAsync();
            }
        }

        private async Task ReadPipeAsync(Stream destination, PipeReader reader, CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    ReadResult result = await reader.ReadAsync(ct);
                    ReadOnlySequence<byte> buffer = result.Buffer;

                    try
                    {
                        if (buffer.Length > 0)
                        {
                            foreach (var segment in buffer)
                            {
                                await destination.WriteAsync(segment, ct);
                            }
                            await destination.FlushAsync(ct);
                        }
                    }
                    catch
                    {
                        break;
                    }

                    reader.AdvanceTo(buffer.End);
                    if (result.IsCompleted || result.IsCanceled) break;
                }
            }
            finally
            {
                await reader.CompleteAsync();
            }
        }
    }
}
