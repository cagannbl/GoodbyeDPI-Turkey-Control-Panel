using System;
using System.Net.Http;
using System.Threading.Tasks;
using Xunit;
using Moq;
using GoodbyeDPI.Core.Network;

namespace GoodbyeDPI.Tests
{
    public class NetworkTests
    {
        [Fact]
        public async Task DohResolver_ShouldFallback_OnConnectionFailure()
        {
            // Arrange
            var mockDohClient = new Mock<IDohClient>();
            
            // Cloudflare fails with a timeout exception
            mockDohClient.Setup(x => x.QueryAsync("https://cloudflare-dns.com/dns-query", "discord.com"))
                         .ThrowsAsync(new HttpRequestException("Connection timed out"));

            // Google succeeds and resolves the IP
            mockDohClient.Setup(x => x.QueryAsync("https://dns.google/dns-query", "discord.com"))
                         .ReturnsAsync("162.159.135.234");

            var resolver = new FallbackDohResolver(mockDohClient.Object);

            // Act
            string? ip = await resolver.ResolveIpWithFallbackAsync("discord.com");

            // Assert
            Assert.Equal("162.159.135.234", ip);
            
            // Verify that QueryAsync was called for both endpoints sequentially
            mockDohClient.Verify(x => x.QueryAsync("https://cloudflare-dns.com/dns-query", "discord.com"), Times.Once);
            mockDohClient.Verify(x => x.QueryAsync("https://dns.google/dns-query", "discord.com"), Times.Once);
        }

        [Fact]
        public void DiagnosticTools_PortCheck_ShouldReturnFalse_ForUnusedPort()
        {
            // Arrange
            var diag = new DiagnosticTools();
            // We assume port 49999 is highly unlikely to be used on the test runner machine
            int testPort = 49999;

            // Act
            bool inUse = diag.IsPortInUse(testPort);

            // Assert
            Assert.False(inUse);
        }
    }
}
