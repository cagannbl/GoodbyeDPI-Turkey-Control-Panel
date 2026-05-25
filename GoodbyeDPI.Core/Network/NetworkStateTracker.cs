using System;
using System.Net.NetworkInformation;
using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public class NetworkStateTracker
    {
        public event Action? OnNetworkChanged;
        private bool _isStarted;

        public void Start()
        {
            if (_isStarted) return;
            _isStarted = true;
            NetworkChange.NetworkAddressChanged += NetworkChange_NetworkAddressChanged;
            NetworkChange.NetworkAvailabilityChanged += NetworkChange_NetworkAvailabilityChanged;
        }

        public void Stop()
        {
            if (!_isStarted) return;
            _isStarted = false;
            NetworkChange.NetworkAddressChanged -= NetworkChange_NetworkAddressChanged;
            NetworkChange.NetworkAvailabilityChanged -= NetworkChange_NetworkAvailabilityChanged;
        }

        private void NetworkChange_NetworkAddressChanged(object? sender, EventArgs e)
        {
            TriggerChange();
        }

        private void NetworkChange_NetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
        {
            TriggerChange();
        }

        private void TriggerChange()
        {
            Task.Run(() => OnNetworkChanged?.Invoke());
        }
    }
}
