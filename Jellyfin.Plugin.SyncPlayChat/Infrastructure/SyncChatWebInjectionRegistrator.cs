using System;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jellyfin.Plugin.SyncPlayChat.Infrastructure;

/// <summary>
/// Registers SyncPlay Chat web transformations.
/// </summary>
public class SyncChatWebInjectionRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHostedService<SyncChatWebInjectionStartupService>();
    }
}
