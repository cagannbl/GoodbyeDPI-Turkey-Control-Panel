using System;
using System.Text.RegularExpressions;

namespace GoodbyeDPI.Core.Network
{
    public class PacketStatisticsEngine
    {
        private readonly Regex _fragmentRegex = new Regex(@"(fragment|split|segment)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private readonly Regex _ttlRegex = new Regex(@"(ttl|modify\sttl|setting\sttl)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public long TcpFragmentCount { get; private set; }
        public long TtlModificationCount { get; private set; }
        public long BypassedConnectionsCount { get; private set; }

        public event Action? OnStatsUpdated;

        /// <summary>
        /// Asynchronously parses standard outputs of GoodbyeDPI process to monitor packet actions.
        /// </summary>
        public void ParseLogLine(string logLine)
        {
            if (string.IsNullOrEmpty(logLine)) return;

            bool updated = false;

            if (_fragmentRegex.IsMatch(logLine))
            {
                TcpFragmentCount++;
                updated = true;
            }

            if (_ttlRegex.IsMatch(logLine))
            {
                TtlModificationCount++;
                updated = true;
            }

            if (logLine.Contains("Filter") || logLine.Contains("redirect") || logLine.Contains("bypass"))
            {
                BypassedConnectionsCount++;
                updated = true;
            }

            if (updated)
            {
                OnStatsUpdated?.Invoke();
            }
        }

        public void Reset()
        {
            TcpFragmentCount = 0;
            TtlModificationCount = 0;
            BypassedConnectionsCount = 0;
            OnStatsUpdated?.Invoke();
        }
    }
}
