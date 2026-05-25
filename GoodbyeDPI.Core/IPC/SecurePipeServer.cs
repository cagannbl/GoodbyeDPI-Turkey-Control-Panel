using System;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using StreamJsonRpc;

namespace GoodbyeDPI.Core.IPC
{
    public class SecurePipeServer
    {
        private readonly string _pipeName;
        private readonly IGoodbyeDpiService _serviceImpl;
        private CancellationTokenSource? _cts;

        public SecurePipeServer(IGoodbyeDpiService serviceImpl, string pipeName = "GoodbyeDPI_Secure_IPC")
        {
            _pipeName = pipeName;
            _serviceImpl = serviceImpl;
        }

        public void Start()
        {
            _cts = new CancellationTokenSource();
            _ = Task.Run(() => ListenLoopAsync(_cts.Token));
        }

        public void Stop()
        {
            _cts?.Cancel();
        }

        private async Task ListenLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    SecurityIdentifier? serverUser = null;
                    using (var currentIdentity = WindowsIdentity.GetCurrent())
                    {
                        serverUser = currentIdentity.User;
                    }

                    var pipeSecurity = new PipeSecurity();
                    
                    // Allow LocalSystem FullControl
                    pipeSecurity.AddAccessRule(new PipeAccessRule(
                        new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
                        PipeAccessRights.FullControl,
                        AccessControlType.Allow));

                    // Allow Local Admins FullControl
                    pipeSecurity.AddAccessRule(new PipeAccessRule(
                        new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
                        PipeAccessRights.FullControl,
                        AccessControlType.Allow));

                    // Allow the current user's session SID ReadWrite access to call service methods
                    if (serverUser != null)
                    {
                        pipeSecurity.AddAccessRule(new PipeAccessRule(
                            serverUser,
                            PipeAccessRights.ReadWrite,
                            AccessControlType.Allow));
                    }

                    using (var pipeStream = NamedPipeServerStreamAcl.Create(
                        _pipeName,
                        PipeDirection.InOut,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous,
                        0,
                        0,
                        pipeSecurity))
                    {
                        await pipeStream.WaitForConnectionAsync(ct);

                        bool authenticated = false;
                        pipeStream.RunAsClient(() =>
                        {
                            using (var clientIdentity = WindowsIdentity.GetCurrent())
                            {
                                var clientPrincipal = new WindowsPrincipal(clientIdentity);
                                var clientSid = clientIdentity.User;

                                // Allow if client is the server process user (active user), is system, or is local administrator
                                if ((serverUser != null && clientSid != null && clientSid.Equals(serverUser)) ||
                                    clientIdentity.IsSystem ||
                                    clientPrincipal.IsInRole(WindowsBuiltInRole.Administrator))
                                {
                                    authenticated = true;
                                }
                            }
                        });

                        if (!authenticated)
                        {
                            pipeStream.Close();
                            continue;
                        }

                        // Attach JSON-RPC handler to exchange messages
                        using (var jsonRpc = JsonRpc.Attach(pipeStream, _serviceImpl))
                        {
                            await jsonRpc.Completion;
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch
                {
                    try
                    {
                        await Task.Delay(1000, ct);
                    }
                    catch
                    {
                        break;
                    }
                }
            }
        }
    }
}
