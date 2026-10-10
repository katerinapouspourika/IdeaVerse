namespace Pouspourika.IdeaVerse.Api.Notifications;

using Microsoft.Extensions.Options;

/// <summary>
/// Runs <see cref="ReminderService"/> at startup and then every <see cref="ReminderOptions.Interval"/>.
/// </summary>
/// <param name="scopes">Creates a scope per run, for the database context.</param>
/// <param name="options">Reminder settings.</param>
/// <param name="timeProvider">Clock driving the timer.</param>
/// <param name="logger">Logger for run outcomes.</param>
internal sealed partial class ReminderWorker(
  IServiceScopeFactory scopes,
  IOptions<ReminderOptions> options,
  TimeProvider timeProvider,
  ILogger<ReminderWorker> logger) : BackgroundService
{
  /// <inheritdoc/>
  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    if (!options.Value.Enabled)
    {
      return;
    }

    using var timer = new PeriodicTimer(options.Value.Interval, timeProvider);
    do
    {
      await RunOnceAsync(stoppingToken).ConfigureAwait(false);
    }
    while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Logs a completed reminder pass.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="raised">Reminders created.</param>
  /// <param name="emailed">Emails sent.</param>
  [LoggerMessage(Level = LogLevel.Information, Message = "Reminder run raised {Raised} and emailed {Emailed}")]
  private static partial void LogRun(ILogger logger, int raised, int emailed);

  /// <summary>
  /// Logs a failed reminder pass.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="exception">The failure.</param>
  [LoggerMessage(Level = LogLevel.Error, Message = "Reminder run failed; it will run again at the next interval")]
  private static partial void LogFailed(ILogger logger, Exception exception);

  /// <summary>
  /// Runs one reminder pass, logging rather than stopping the worker when it fails.
  /// </summary>
  /// <param name="cancellationToken">Token that stops the worker.</param>
  /// <returns>A task that completes when the pass ends.</returns>
  private async Task RunOnceAsync(CancellationToken cancellationToken)
  {
    try
    {
      await using var scope = scopes.CreateAsyncScope();
      var result = await scope.ServiceProvider.GetRequiredService<ReminderService>().RunAsync(cancellationToken).ConfigureAwait(false);
      LogRun(logger, result.Raised, result.Emailed);
    }
    catch (Exception ex) when (ex is not OperationCanceledException)
    {
      LogFailed(logger, ex);
    }
  }
}
