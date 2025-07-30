export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableNetwork: boolean;
  enableStorage: boolean;
}

class Logger {
  private config: LogConfig = {
    level: process.env.NODE_ENV === "production" ? LogLevel.WARN : LogLevel.DEBUG,
    enableConsole: true,
    enableNetwork: false,
    enableStorage: false,
  };

  private logs: Array<{
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: number;
  }> = [];

  configure(config: Partial<LogConfig>) {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    return `[${timestamp}] ${levelName}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(level, message, data);
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.log(formattedMessage);
          break;
      }
    }
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  // Game-specific logging methods
  physics(message: string, data?: any) {
    this.debug(`[PHYSICS] ${message}`, data);
  }

  network(message: string, data?: any) {
    this.debug(`[NETWORK] ${message}`, data);
  }

  game(message: string, data?: any) {
    this.debug(`[GAME] ${message}`, data);
  }

  auth(message: string, data?: any) {
    this.debug(`[AUTH] ${message}`, data);
  }

  getLogs(): Array<any> {
    return [...this.logs];
  }

  clearLogs() {
    this.logs.length = 0;
  }
}

export const logger = new Logger();