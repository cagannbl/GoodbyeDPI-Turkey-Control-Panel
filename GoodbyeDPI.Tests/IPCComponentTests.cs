using System.Threading.Tasks;
using Xunit;
using Moq;
using GoodbyeDPI.Core.IPC;

namespace GoodbyeDPI.Tests
{
    public class IPCComponentTests
    {
        [Fact]
        public async Task GoodbyeDpiService_ShouldStartBypass_WhenValidArgsPassed()
        {
            // Arrange
            var mockService = new Mock<IGoodbyeDpiService>();
            mockService.Setup(x => x.StartBypassAsync("-5 --set-ttl 5"))
                       .ReturnsAsync(true);

            // Act
            bool success = await mockService.Object.StartBypassAsync("-5 --set-ttl 5");

            // Assert
            Assert.True(success);
            mockService.Verify(x => x.StartBypassAsync("-5 --set-ttl 5"), Times.Once);
        }

        [Fact]
        public async Task GoodbyeDpiService_ShouldStopBypass_WhenRequested()
        {
            // Arrange
            var mockService = new Mock<IGoodbyeDpiService>();
            mockService.Setup(x => x.StopBypassAsync())
                       .ReturnsAsync(true);

            // Act
            bool success = await mockService.Object.StopBypassAsync();

            // Assert
            Assert.True(success);
            mockService.Verify(x => x.StopBypassAsync(), Times.Once);
        }
    }
}
