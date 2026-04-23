const { spawn } = require('node-pty');
const path = require('path');
const fs = require('fs');

const DEFAULT_PROVIDER_ORDER = ['anthropic', 'codex_auth', 'openrouter', 'openai', 'gemini', 'bedrock', 'vertex'];
const PROVIDER_FAILURE_PATTERNS = [
  { reason: 'credit_exhausted', patterns: ['credit balance is too low', 'insufficient credits', 'quota exceeded'] },
  { reason: 'usage_window_exhausted', patterns: ['usage limit reached', 'try again in', 'hours remaining'] },
  { reason: 'rate_limited', patterns: ['rate limit', 'too many requests', '429'] },
  { reason: 'auth_invalid', patterns: ['invalid api key', 'authentication failed', 'unauthorized', 'forbidden'] },
  { reason: 'provider_unreachable', patterns: ['connection error', 'network error', 'temporarily unavailable', 'timed out'] },
];

class ClaudeBridge {
  constructor() {
    this.sessions = new Map();
  }

  _allowedCliCommands() {
    return new Set(['claude', 'openclaude']);
  }

  _allowedEnvVars() {
    return new Set([
      'ANTHROPIC_API_KEY',
      'CLAUDE_CODE_USE_OPENAI', 'CLAUDE_CODE_USE_GEMINI',
      'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
      'OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL',
      'CODEX_AUTH_JSON_PATH', 'CODEX_API_KEY',
      'GEMINI_API_KEY', 'GEMINI_MODEL',
      'AWS_REGION', 'AWS_BEARER_TOKEN_BEDROCK',
      'ANTHROPIC_VERTEX_PROJECT_ID', 'CLOUD_ML_REGION',
    ]);
  }

  _sanitizeProviderEnvVars(envVars = {}) {
    const allowedVars = this._allowedEnvVars();
    return Object.fromEntries(
      Object.entries(envVars).filter(([k, v]) => v !== '' && allowedVars.has(k))
    );
  }

  /**
   * Load active provider config from config/providers.json.
   * Returns the CLI command to use and env vars to inject.
   * Only allowlisted CLI commands and env var names are accepted.
   */
  _loadProviderConfig() {
    const ALLOWED_CLI = this._allowedCliCommands();

    try {
      // Resolve config relative to this file (src/ → terminal-server/ → dashboard/ → root)
      const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
      const configPath = path.join(workspaceRoot, 'config', 'providers.json');
      if (!fs.existsSync(configPath)) {
        console.log(`[provider] providers.json not found at ${configPath}, using defaults`);
        return { cli_command: 'claude', env_vars: {}, active: 'anthropic' };      }
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const providers = config.providers || {};
      const active = config.active_provider || 'anthropic';
      const provider = providers[active] || {};

      let cliCommand = provider.cli_command || 'claude';
      if (!ALLOWED_CLI.has(cliCommand)) {
        console.warn(`[provider] Rejected non-allowlisted CLI: ${cliCommand}, using claude`);
        cliCommand = 'claude';
      }

      const envVars = this._sanitizeProviderEnvVars(provider.env_vars || {});

      // Provider isolation — the active_provider in providers.json is the
      // user's explicit choice between API-key mode ('openai') and OAuth
      // mode ('codex_auth'). Respect it literally:
      //
      //   active === 'codex_auth' → OAuth mode: remove any stale
      //       OPENAI_API_KEY from the provider env so OpenClaude falls
      //       back to ~/.codex/auth.json (the OAuth token source).
      //
      //   active === 'openai'    → API-key mode: keep OPENAI_API_KEY.
      //       Even if ~/.codex/auth.json happens to exist on disk (from
      //       a past OAuth login), the user has chosen API-key mode now.
      //       Previously this branch also deleted the key, which caused
      //       the two cards to bleed into each other on toggle.
      //
      //   anything else          → untouched.
      if (active === 'codex_auth') {
        if ('OPENAI_API_KEY' in envVars) {
          delete envVars['OPENAI_API_KEY'];
          console.log('[provider] codex_auth active — stripping OPENAI_API_KEY, OpenClaude will use ~/.codex/auth.json');
        }
        const codexAuthPath = path.join(process.env.HOME || '/', '.codex', 'auth.json');
        if (!fs.existsSync(codexAuthPath)) {
          console.warn('[provider] codex_auth active but ~/.codex/auth.json is missing — run OAuth login in the Providers page');
        }
      }

      console.log(`[provider] Active provider: ${active} (cli: ${cliCommand})`);
      if (Object.keys(envVars).length > 0) {
        console.log(`[provider] Injecting env vars: ${Object.keys(envVars).join(', ')}`);
      }
      return {
        cli_command: cliCommand,
        env_vars: envVars,
        active,
        providers,
        provider_order: this._normalizeProviderOrder(config.provider_order, providers),
        fallback_enabled: config.fallback_enabled !== false,
        auto_return_to_primary: config.auto_return_to_primary !== false,
        provider_runtime: config.provider_runtime || {},
        configPath,
      };
    } catch (err) {
      console.warn(`[provider] Could not read providers.json: ${err.message}`);
      return {
        cli_command: 'claude',
        env_vars: {},
        active: 'anthropic',
        providers: {},
        provider_order: [],
        fallback_enabled: true,
        auto_return_to_primary: true,
        provider_runtime: {},
        configPath: null,
      };
    }
  }

  _normalizeProviderOrder(order, providers) {
    const normalized = [];
    const safeOrder = Array.isArray(order) ? order : [];
    for (const providerId of safeOrder) {
      if (providers[providerId] && !normalized.includes(providerId)) normalized.push(providerId);
    }
    for (const providerId of DEFAULT_PROVIDER_ORDER) {
      if (providers[providerId] && !normalized.includes(providerId)) normalized.push(providerId);
    }
    for (const providerId of Object.keys(providers)) {
      if (!normalized.includes(providerId)) normalized.push(providerId);
    }
    return normalized;
  }

  _isRuntimeBlocked(state) {
    if (!state) return false;
    if (state.status === 'healthy') return false;
    if (state.cooldown_until == null) return state.status === 'blocked';
    const parsed = Number(state.cooldown_until);
    if (!Number.isFinite(parsed)) return state.status === 'blocked';
    return parsed > Math.floor(Date.now() / 1000);
  }

  _classifyProviderFailure(text = '') {
    const haystack = String(text).toLowerCase();
    for (const entry of PROVIDER_FAILURE_PATTERNS) {
      if (entry.patterns.some((pattern) => haystack.includes(pattern))) {
        return entry.reason;
      }
    }
    return null;
  }

  _runtimeCooldownSeconds(reason) {
    if (reason === 'credit_exhausted' || reason === 'usage_window_exhausted') return 6 * 3600;
    return 15 * 60;
  }

  _updateProviderRuntime(providerId, status, reason = null) {
    const providerConfig = this._loadProviderConfig();
    if (!providerConfig.configPath || !providerId) return;
    try {
      const config = JSON.parse(fs.readFileSync(providerConfig.configPath, 'utf8'));
      if (!config.provider_runtime || typeof config.provider_runtime !== 'object') config.provider_runtime = {};
      if (status === 'healthy') {
        config.provider_runtime[providerId] = {
          status: 'healthy',
          reason: null,
          cooldown_until: null,
          last_failure_at: null,
        };
      } else {
        config.provider_runtime[providerId] = {
          status: 'blocked',
          reason: reason || 'unknown',
          cooldown_until: Math.floor(Date.now() / 1000) + this._runtimeCooldownSeconds(reason),
          last_failure_at: Math.floor(Date.now() / 1000),
        };
      }
      fs.writeFileSync(providerConfig.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    } catch (err) {
      console.warn(`[provider] Could not update runtime state for ${providerId}: ${err.message}`);
    }
  }

  _buildProviderCandidates(providerConfig) {
    const providers = providerConfig.providers || {};
    const active = providerConfig.active;
    const order = providerConfig.provider_order || [];
    const runtime = providerConfig.provider_runtime || {};
    const chain = [];

    if (providers[active]) chain.push(active);
    if (providerConfig.fallback_enabled) {
      for (const providerId of order) {
        if (providers[providerId] && !chain.includes(providerId)) chain.push(providerId);
      }
    }

    const candidates = [];
    for (const providerId of chain) {
      const provider = providers[providerId] || {};
      if (this._isRuntimeBlocked(runtime[providerId])) continue;

      let cliCommand = provider.cli_command || 'claude';
      if (!this._allowedCliCommands().has(cliCommand)) cliCommand = 'claude';
      const envVars = this._sanitizeProviderEnvVars(provider.env_vars || {});

      if (!envVars.OPENAI_MODEL) {
        if (providerId === 'codex_auth') envVars.OPENAI_MODEL = 'codexplan';
        if (providerId === 'openai') envVars.OPENAI_MODEL = 'gpt-4.1';
      }

      candidates.push({ id: providerId, cli_command: cliCommand, env_vars: envVars });
    }

    if (candidates.length === 0 && !this._isRuntimeBlocked(runtime[active])) {
      candidates.push({ id: active || 'anthropic', cli_command: 'claude', env_vars: {} });
    }
    return candidates;
  }

  findClaudeCommand(cliCommand = 'claude') {
    const { execSync } = require('child_process');

    // Use shell-based `which` to resolve with full PATH (incl. nvm, fnm, etc.)
    // Hardcoded dispatch to satisfy semgrep — each branch is a literal string
    try {
      let resolved;
      if (cliCommand === 'openclaude') {
        resolved = execSync('which openclaude', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      } else {
        resolved = execSync('which claude', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      }
      if (resolved) {
        console.log(`[provider] Found ${cliCommand} at: ${resolved}`);
        return resolved;
      }
    } catch {
      // which failed — try hardcoded paths below
    }

    // Fallback: check common hardcoded paths
    const home = process.env.HOME || '/';
    const paths = cliCommand === 'openclaude'
      ? [
          path.join(home, '.local', 'bin', 'openclaude'),
          '/usr/local/bin/openclaude',
          '/usr/bin/openclaude',
        ]
      : [
          path.join(home, '.claude', 'local', 'claude'),
          path.join(home, '.local', 'bin', 'claude'),
          '/usr/local/bin/claude',
          '/usr/bin/claude',
        ];

    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          console.log(`[provider] Found ${cliCommand} at hardcoded path: ${p}`);
          return p;
        }
      } catch {
        continue;
      }
    }

    console.error(`[provider] ${cliCommand} not found anywhere, using bare command name`);
    return cliCommand;
  }

  async startSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId);
      if (existing.active) {
        // Idempotent: a duplicate startSession can arrive when the WebSocket
        // reconnects through a reverse proxy (Traefik) and the frontend
        // re-sends start_claude before learning the session is still alive.
        // Returning the existing session instead of throwing prevents a
        // confusing "Session already exists" toast on the user's terminal
        // while keeping the original PTY intact.
        console.log(`[bridge] startSession(${sessionId}) — already active, returning existing session`);
        return existing;
      }
      // Orphaned dead session — clean up and restart
      if (existing.process) {
        try { existing.process.kill('SIGKILL'); } catch (_) {}
      }
      this.sessions.delete(sessionId);
    }

    const {
      workingDir = process.cwd(),
      dangerouslySkipPermissions = false,
      agent = null,
      onOutput = () => {},
      onExit = () => {},
      onError = () => {},
      cols = 80,
      rows = 24
    } = options;

    try {
      // Reload provider config fresh on every session start
      // so switching provider in the dashboard takes effect immediately
      const providerConfig = this._loadProviderConfig();
      const providerCandidates = this._buildProviderCandidates(providerConfig);

      // Block session if no provider is active
      if (!providerConfig.active || providerConfig.active === 'none') {
        const msg = '\r\n\x1b[1;33mNo AI provider is active.\x1b[0m\r\nGo to \x1b[1;32mProviders\x1b[0m in the dashboard to configure and activate a provider.\r\n';
        if (onOutput) onOutput(msg);
        if (onExit) onExit(1, null);
        return;
      }

      if (providerCandidates.length === 0) {
        const msg = '\r\n\x1b[1;33mNo AI providers are currently healthy.\x1b[0m\r\nReview \x1b[1;32mProviders\x1b[0m in the dashboard and reset or reconfigure a blocked provider.\r\n';
        if (onOutput) onOutput(msg);
        if (onExit) onExit(1, null);
        return;
      }

      const session = {
        process: null,
        workingDir,
        created: new Date(),
        active: true,
        killTimeout: null,
        candidateIndex: 0,
        providerCandidates,
        currentProviderId: null,
        currentOutputBuffer: '',
        onOutput,
        onExit,
        onError,
      };

      this.sessions.set(sessionId, session);
      this._spawnProviderCandidate(sessionId, session, options);
      console.log(`Claude session ${sessionId} started successfully`);
      return session;

    } catch (error) {
      console.error(`Failed to start Claude session ${sessionId}:`, error);
      throw new Error(`Failed to start Claude Code: ${error.message}`);
    }
  }

  _spawnProviderCandidate(sessionId, session, options) {
    const candidate = session.providerCandidates[session.candidateIndex];
    if (!candidate) {
      session.active = false;
      this.sessions.delete(sessionId);
      session.onExit(1, null);
      return;
    }

    const { workingDir, dangerouslySkipPermissions = false, agent = null, cols = 80, rows = 24 } = options;
    const cliCommand = this.findClaudeCommand(candidate.cli_command);
    session.currentProviderId = candidate.id;
    session.currentOutputBuffer = '';

    console.log(`Starting session ${sessionId} with ${candidate.id}/${candidate.cli_command}`);
    console.log(`Command: ${cliCommand}`);
    console.log(`Working directory: ${workingDir}`);
    console.log(`Agent: ${agent || 'none'}`);
    console.log(`Terminal size: ${cols}x${rows}`);

    const isRoot = process.getuid && process.getuid() === 0;
    const args = (dangerouslySkipPermissions && !isRoot) ? ['--dangerously-skip-permissions'] : [];
    if (agent) args.push('--agent', agent);

    if (candidate.id !== 'anthropic' && agent) {
      const agentFile = path.join(workingDir, '.claude', 'agents', `${agent}.md`);
      let agentPrompt = '';
      try {
        const content = fs.readFileSync(agentFile, 'utf8');
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        agentPrompt = match ? match[1].trim() : content;
      } catch {
        agentPrompt = `You are the ${agent} agent.`;
      }

      const enforcePrompt = agentPrompt + '\n\n' +
        'CRITICAL: You MUST fully embody this agent persona. ' +
        'You are NOT Claude, OpenClaude, or a generic assistant — you ARE ' + agent + '. ' +
        'When asked who you are, ALWAYS respond as ' + agent + '. ' +
        'Never break character. Follow ALL instructions above.';

      args.push('--system-prompt', enforcePrompt);
    }

    const SYSTEM_VARS = [
      'HOME', 'USER', 'SHELL', 'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE',
      'LOGNAME', 'HOSTNAME', 'XDG_RUNTIME_DIR', 'XDG_DATA_HOME',
      'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'TMPDIR',
      'SSH_AUTH_SOCK', 'SSH_AGENT_PID',
      'NVM_DIR', 'NVM_BIN', 'NVM_INC',
      'CODEX_HOME', 'CLAUDE_CONFIG_DIR',
    ];
    const cleanEnv = {};
    for (const key of SYSTEM_VARS) {
      if (process.env[key]) cleanEnv[key] = process.env[key];
    }

    console.log(`[spawn] Args: ${JSON.stringify(args)}`);
    const claudeProcess = spawn(cliCommand, args, {
      cwd: workingDir,
      env: {
        ...cleanEnv,
        ...candidate.env_vars,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        COLORTERM: 'truecolor',
      },
      cols,
      rows,
      name: 'xterm-color',
    });
    session.process = claudeProcess;

    let trustPromptHandled = false;
    claudeProcess.onData((data) => {
      if (process.env.DEBUG) {
        console.log(`Session ${sessionId} output:`, data);
      }

      session.currentOutputBuffer += data;
      if (!trustPromptHandled && session.currentOutputBuffer.includes('Do you trust the files in this folder?')) {
        trustPromptHandled = true;
        setTimeout(() => {
          claudeProcess.write('\r');
        }, 500);
      }
      if (session.currentOutputBuffer.length > 12000) {
        session.currentOutputBuffer = session.currentOutputBuffer.slice(-6000);
      }
      session.onOutput(data);
    });

    claudeProcess.onExit((exitCode, signal) => {
      console.log(`Claude session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
      if (session.killTimeout) {
        clearTimeout(session.killTimeout);
        session.killTimeout = null;
      }

      const failureReason = exitCode === 0 ? null : this._classifyProviderFailure(session.currentOutputBuffer);
      const hasFallback = failureReason && session.candidateIndex < session.providerCandidates.length - 1;
      if (hasFallback) {
        this._updateProviderRuntime(session.currentProviderId, 'blocked', failureReason);
        session.candidateIndex += 1;
        session.onOutput(`\r\n[provider] ${session.currentProviderId} unavailable (${failureReason}). Switching to ${session.providerCandidates[session.candidateIndex].id}...\r\n`);
        this._spawnProviderCandidate(sessionId, session, options);
        return;
      }

      if (exitCode === 0 && session.currentProviderId) {
        this._updateProviderRuntime(session.currentProviderId, 'healthy');
      }

      session.active = false;
      this.sessions.delete(sessionId);
      session.onExit(exitCode, signal);
    });

    claudeProcess.on('error', (error) => {
      console.error(`Claude session ${sessionId} error:`, error);
      if (session.killTimeout) {
        clearTimeout(session.killTimeout);
        session.killTimeout = null;
      }
      session.active = false;
      this.sessions.delete(sessionId);
      session.onError(error);
    });
  }

  async sendInput(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      throw new Error(`Session ${sessionId} not found or not active`);
    }

    try {
      session.process.write(data);
    } catch (error) {
      throw new Error(`Failed to send input to session ${sessionId}: ${error.message}`);
    }
  }

  async resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      throw new Error(`Session ${sessionId} not found or not active`);
    }

    try {
      session.process.resize(cols, rows);
    } catch (error) {
      console.warn(`Failed to resize session ${sessionId}:`, error.message);
    }
  }

  async stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Clear any existing kill timeout
      if (session.killTimeout) {
        clearTimeout(session.killTimeout);
        session.killTimeout = null;
      }

      if (session.active && session.process) {
        session.process.kill('SIGTERM');
        
        session.killTimeout = setTimeout(() => {
          if (session.active && session.process) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }
    } catch (error) {
      console.warn(`Error stopping session ${sessionId}:`, error.message);
    }

    session.active = false;
    this.sessions.delete(sessionId);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      workingDir: session.workingDir,
      created: session.created,
      active: session.active
    }));
  }

  async cleanup() {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.stopSession(sessionId);
    }
  }

}

module.exports = ClaudeBridge;
