using System;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.SyncPlayChat.Infrastructure;

/// <summary>
/// Registers SyncPlay Chat transformation after plugin startup.
/// </summary>
public class SyncChatWebInjectionStartupService : IHostedService
{
    private static readonly Guid TransformationId = Guid.Parse("5e2846e6-173f-45ff-9d16-f2f83cf64719");
    private readonly ILogger<SyncChatWebInjectionStartupService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="SyncChatWebInjectionStartupService"/> class.
    /// </summary>
    /// <param name="logger">Logger instance.</param>
    public SyncChatWebInjectionStartupService(ILogger<SyncChatWebInjectionStartupService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        RegisterTransformation();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    private void RegisterTransformation()
    {
        try
        {
            Assembly? fileTransformationAssembly = AssemblyLoadContext.All
                .SelectMany(loadContext => loadContext.Assemblies)
                .FirstOrDefault(assembly => assembly.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);

            if (fileTransformationAssembly is null)
            {
                _logger.LogWarning("File Transformation assembly not found; sync-chat.js will not be injected.");
                return;
            }

            Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            MethodInfo? registerTransformationMethod = pluginInterfaceType?.GetMethod("RegisterTransformation", BindingFlags.Public | BindingFlags.Static);

            if (registerTransformationMethod is null)
            {
                _logger.LogWarning("File Transformation RegisterTransformation API not found.");
                return;
            }

            string payloadJson = "{" +
                $"\"id\":\"{TransformationId}\"," +
                "\"fileNamePattern\":\"index.html\"," +
                $"\"callbackAssembly\":\"{typeof(SyncChatWebTransformer).Assembly.FullName}\"," +
                $"\"callbackClass\":\"{typeof(SyncChatWebTransformer).FullName}\"," +
                "\"callbackMethod\":\"TransformIndexHtml\"" +
                "}";

            Type? payloadType = registerTransformationMethod.GetParameters().FirstOrDefault()?.ParameterType;
            object? payload;

            if (payloadType?.Name == "String")
            {
                payload = payloadJson;
            }
            else
            {
                MethodInfo? parseMethod = payloadType?.GetMethod("Parse", [typeof(string)]);
                if (parseMethod is null)
                {
                    _logger.LogWarning("Unable to resolve JSON payload parser for File Transformation API.");
                    return;
                }

                payload = parseMethod.Invoke(null, [payloadJson]);
                if (payload is null)
                {
                    _logger.LogWarning("Failed to parse File Transformation payload.");
                    return;
                }
            }

            registerTransformationMethod.Invoke(null, [payload]);
            _logger.LogInformation("Registered File Transformation for sync-chat.js injection.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register sync-chat.js transformation.");
        }
    }
}
