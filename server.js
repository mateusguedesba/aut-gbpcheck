const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Criar diretórios necessários
const screenshotsDir = path.join(__dirname, 'data', 'screenshots');
const userDataDir = path.join(__dirname, 'data', 'browser-data');

[screenshotsDir, userDataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, 'data', 'app.log') })
  ]
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir arquivos estáticos (screenshots)
app.use('/screenshots', express.static(screenshotsDir));

class PlaywrightAutomation {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.userDataDir = userDataDir;
  }
  
  async setupBrowser(extensionPath = "/chrome-extension", headless = true, enableVnc = false) {
    try {
      logger.info(`Configurando browser - headless: ${headless}, VNC: ${enableVnc}, extensão: ${extensionPath}`);
      
      // Verificar se diretório da extensão existe
      if (!fs.existsSync(extensionPath)) {
        logger.error(`Diretório da extensão não encontrado: ${extensionPath}`);
        throw new Error(`Extensão não encontrada em: ${extensionPath}`);
      }
      
      // Verificar arquivos da extensão
      const extensionFiles = fs.readdirSync(extensionPath);
      logger.info(`Arquivos na extensão: ${extensionFiles.join(', ')}`);
      
      if (!extensionFiles.includes('manifest.json')) {
        logger.error('manifest.json não encontrado na extensão');
        throw new Error('manifest.json não encontrado na extensão');
      }
      
      // Argumentos do Chrome com extensão (sem --user-data-dir)
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--enable-logging',
        '--log-level=0'
      ];
      
      // Se VNC estiver habilitado, configurar display
      if (enableVnc && !headless) {
        browserArgs.push('--display=:99', '--disable-gpu');
      }
      
      logger.info(`Argumentos do browser: ${browserArgs.join(' ')}`);
      
      // Importar Playwright
      const { chromium } = require('playwright');
      
      // Usar launchPersistentContext para dados persistentes
      logger.info('Iniciando browser Chromium com contexto persistente...');
      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: headless,
        args: browserArgs,
        slowMo: 100,
        timeout: 30000,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      logger.info('Contexto persistente criado com sucesso');
      
      // O browser é acessível através do contexto
      this.browser = this.context.browser();
      
      // Criar ou usar página existente
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        logger.info('Usando página existente');
      } else {
        this.page = await this.context.newPage();
        logger.info('Nova página criada');
      }
      
      logger.info("Browser configurado com sucesso");
      return true;
      
    } catch (error) {
      logger.error(`Erro detalhado ao configurar browser: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      
      // Tentar limpeza em caso de erro
      try {
        if (this.page && !this.page.isClosed()) await this.page.close();
        if (this.context) await this.context.close();
      } catch (cleanupError) {
        logger.error(`Erro na limpeza: ${cleanupError.message}`);
      }
      
      return false;
    }
  }
  
  async checkExtensionLoaded() {
    try {
      logger.info("Verificando se extensão foi carregada...");
      
      await this.page.goto('chrome://extensions/');
      await this.page.waitForTimeout(3000);
      
      // Verificar se há extensões carregadas
      const extensions = await this.page.$$eval('.extension-list-item, [class*="extension"]', 
        elements => elements.length
      );
      
      if (extensions > 0) {
        logger.info(`Encontradas ${extensions} extensões carregadas`);
        
        // Capturar screenshot da página de extensões
        const screenshot = await this.page.screenshot({ type: 'png' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `extensions-check-${timestamp}.png`;
        const filePath = path.join(screenshotsDir, fileName);
        
        fs.writeFileSync(filePath, screenshot);
        logger.info(`Screenshot das extensões salvo: ${fileName}`);
        
        return true;
      } else {
        logger.warning("Nenhuma extensão encontrada");
        return false;
      }
      
    } catch (error) {
      logger.error(`Erro ao verificar extensões: ${error.message}`);
      return false;
    }
  }
  
  async navigateToUrl(url) {
    try {
      logger.info(`Navegando para: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.page.waitForTimeout(5000);
      return true;
    } catch (error) {
      logger.error(`Erro ao navegar para ${url}: ${error.message}`);
      return false;
    }
  }
  
  async performLoginIfNeeded(loginUrl = null, username = null, password = null) {
    try {
      if (!loginUrl) {
        logger.info("URL de login não fornecida");
        return true;
      }
      
      logger.info(`Realizando login em: ${loginUrl}`);
      await this.page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await this.page.waitForTimeout(3000);
      
      // Verificar se já está logado
      if (await this.checkIfAlreadyLoggedIn()) {
        logger.info("Usuário já está logado");
        return true;
      }
      
      // Tentar login automático se credenciais fornecidas
      if (username && password) {
        const success = await this.autoFillLogin(username, password);
        if (success) {
          logger.info("Login realizado com sucesso");
          return true;
        }
      }
      
      // Aguardar login manual
      logger.info("Aguardando login manual por 60 segundos...");
      try {
        await this.page.waitForFunction(
          `() => window.location.href !== "${loginUrl}" || document.querySelector('.logged-in, .user-menu, [class*="profile"]') !== null`,
          { timeout: 60000 }
        );
        logger.info("Login detectado");
        return true;
      } catch {
        logger.warning("Timeout no login - continuando");
        return true;
      }
      
    } catch (error) {
      logger.error(`Erro no login: ${error.message}`);
      return false;
    }
  }
  
  async checkIfAlreadyLoggedIn() {
    try {
      const loginIndicators = [
        '.user-menu', '.profile', '.logout', '.dashboard',
        '[class*="logged-in"]', '[class*="authenticated"]', '.user-avatar'
      ];
      
      for (const indicator of loginIndicators) {
        const element = await this.page.$(indicator);
        if (element && await element.isVisible()) {
          return true;
        }
      }
      
      const currentUrl = this.page.url();
      return ['dashboard', 'profile', 'account', 'home'].some(keyword => 
        currentUrl.includes(keyword)
      );
      
    } catch (error) {
      logger.error(`Erro ao verificar login: ${error.message}`);
      return false;
    }
  }
  
  async autoFillLogin(username, password) {
    try {
      const usernameSelectors = [
        'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
        'input[id*="email"]', 'input[id*="username"]', '#email', '#username'
      ];
      
      const passwordSelectors = [
        'input[type="password"]', 'input[name="password"]', 
        'input[id*="password"]', '#password'
      ];
      
      // Preencher username
      let usernameFilled = false;
      for (const selector of usernameSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (await element.isVisible()) {
            await element.fill(username);
            usernameFilled = true;
            logger.info(`Username preenchido: ${selector}`);
            break;
          }
        } catch { continue; }
      }
      
      if (!usernameFilled) return false;
      
      // Preencher password
      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (await element.isVisible()) {
            await element.fill(password);
            passwordFilled = true;
            logger.info(`Password preenchido: ${selector}`);
            break;
          }
        } catch { continue; }
      }
      
      if (!passwordFilled) return false;
      
      // Clicar submit
      const submitSelectors = [
        'button[type="submit"]', 'input[type="submit"]',
        'button[class*="login"]', '.login-button'
      ];
      
      for (const selector of submitSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (await element.isVisible()) {
            await element.click();
            await this.page.waitForTimeout(3000);
            return true;
          }
        } catch { continue; }
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Erro no auto-fill: ${error.message}`);
      return false;
    }
  }
  
  async findAndClickButton(selectors = null) {
    if (!selectors) {
      selectors = [
        '.start-main-check-btn',
        'button.start-main-check-btn',
        '.main-btn.start-main-check-btn',
        'button.main-btn.start-main-check-btn'
      ];
    }
    
    try {
      logger.info("Procurando botão...");
      
      // Tentar cada seletor
      for (const selector of selectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 10000 });
          if (await element.isVisible()) {
            await element.click();
            logger.info(`Botão clicado: ${selector}`);
            return true;
          }
        } catch { continue; }
      }
      
      // Buscar por texto como fallback
      logger.info('Buscando botão por texto...');
      try {
        const button = await this.page.locator('button').filter({ hasText: /pré análise|pre análise/i }).first();
        await button.waitFor({ timeout: 10000 });
        await button.click();
        logger.info('Botão encontrado por texto "Pré Análise"');
        return true;
      } catch {
        logger.error('Botão não encontrado');
        return false;
      }
      
    } catch (error) {
      logger.error(`Erro ao procurar botão: ${error.message}`);
      return false;
    }
  }
  
  async waitForCompletion(waitTime = 300, completionSelectors = null) {
    if (!completionSelectors) {
      completionSelectors = [
        '.process-complete', '.success', '.finished', '.done',
        '.analysis-complete', '.result', '.results',
        '[data-status="complete"]', '[data-status="success"]'
      ];
    }
    
    try {
      logger.info(`Aguardando conclusão por ${waitTime} segundos...`);
      const startTime = Date.now();
      
      while (Date.now() - startTime < waitTime * 1000) {
        try {
          // Verificar se página ainda existe
          if (this.page.isClosed()) {
            logger.info('Página fechada, recuperando...');
            const pages = this.context.pages();
            this.page = pages.length > 0 ? pages[pages.length - 1] : await this.context.newPage();
          }
          
          // Verificar múltiplas páginas
          const pages = this.context.pages();
          if (pages.length > 1) {
            logger.info(`${pages.length} abas abertas, usando a mais recente`);
            this.page = pages[pages.length - 1];
          }
          
          // Aguardar carregamento
          try {
            await this.page.waitForLoadState('networkidle', { timeout: 5000 });
          } catch { /* continuar */ }
          
          // Verificar indicadores de conclusão
          for (const indicator of completionSelectors) {
            try {
              const element = await this.page.$(indicator);
              if (element && await element.isVisible()) {
                logger.info(`Processo concluído: ${indicator}`);
                return true;
              }
            } catch { continue; }
          }
          
          // Verificar URL para indicação de conclusão
          const currentUrl = this.page.url();
          if (['result', 'complete', 'finish', 'done'].some(keyword => 
            currentUrl.includes(keyword))) {
            logger.info(`Conclusão detectada pela URL: ${currentUrl}`);
            return true;
          }
          
          // Verificar texto na página
          try {
            const content = await this.page.textContent('body');
            if (content && ['análise concluída', 'processo finalizado', 'resultado', 'completo'].some(keyword => 
              content.toLowerCase().includes(keyword))) {
              logger.info('Conclusão detectada pelo texto');
              return true;
            }
          } catch { /* continuar */ }
          
          await this.page.waitForTimeout(5000);
          
        } catch (error) {
          logger.warn(`Erro durante monitoramento: ${error.message}`);
          try {
            if (this.page.isClosed()) {
              const pages = this.context.pages();
              this.page = pages.length > 0 ? pages[pages.length - 1] : await this.context.newPage();
            }
            await this.page.waitForTimeout(5000);
          } catch { /* continuar */ }
        }
      }
      
      logger.info('Timeout atingido');
      return true;
      
    } catch (error) {
      logger.error(`Erro na espera: ${error.message}`);
      return false;
    }
  }
  
  async takeScreenshot() {
    try {
      const pages = this.context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : this.page;
      
      if (finalPage && !finalPage.isClosed()) {
        const screenshotBuffer = await finalPage.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `screenshot-${timestamp}.png`;
        const filePath = path.join(screenshotsDir, fileName);
        
        fs.writeFileSync(filePath, screenshotBuffer);
        logger.info(`Screenshot salvo: ${fileName}`);
        
        return `/screenshots/${fileName}`;
      }
      
      return null;
      
    } catch (error) {
      logger.warn(`Erro ao capturar screenshot: ${error.message}`);
      return null;
    }
  }
  
  getPageInfo() {
    try {
      const pages = this.context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : this.page;
      
      if (finalPage && !finalPage.isClosed()) {
        return {
          url: finalPage.url(),
          title: '', // Remover await aqui pois não é função async
          timestamp: new Date().toISOString()
        };
      }
      
      return { timestamp: new Date().toISOString() };
      
    } catch (error) {
      logger.error(`Erro ao obter info da página: ${error.message}`);
      return { timestamp: new Date().toISOString() };
    }
  }
  
  async cleanup() {
    try {
      if (this.page && !this.page.isClosed()) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      logger.info("Recursos liberados");
    } catch (error) {
      logger.error(`Erro na limpeza: ${error.message}`);
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Playwright Automation Service'
  });
});

// Endpoint de diagnóstico
app.get('/diagnose', async (req, res) => {
  try {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      directories: {},
      playwright: {},
      extension: {}
    };
    
    // Verificar diretórios
    try {
      diagnosis.directories.screenshots = {
        exists: fs.existsSync(screenshotsDir),
        path: screenshotsDir,
        files: fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).length : 0
      };
      
      diagnosis.directories.userData = {
        exists: fs.existsSync(userDataDir),
        path: userDataDir,
        files: fs.existsSync(userDataDir) ? fs.readdirSync(userDataDir).length : 0
      };
    } catch (e) {
      diagnosis.directories.error = e.message;
    }
    
    // Verificar extensão
    try {
      const extensionPath = '/chrome-extension';
      diagnosis.extension = {
        path: extensionPath,
        exists: fs.existsSync(extensionPath),
        files: fs.existsSync(extensionPath) ? fs.readdirSync(extensionPath) : [],
        manifest_exists: fs.existsSync(path.join(extensionPath, 'manifest.json'))
      };
      
      if (diagnosis.extension.manifest_exists) {
        const manifestContent = fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8');
        diagnosis.extension.manifest = JSON.parse(manifestContent);
      }
    } catch (e) {
      diagnosis.extension.error = e.message;
    }
    
    // Verificar Playwright
    try {
      const { chromium } = require('playwright');
      diagnosis.playwright.available = true;
      
      // Tentar iniciar browser simples para teste
      const testBrowser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 10000
      });
      
      const testContext = await testBrowser.newContext();
      const testPage = await testContext.newPage();
      await testPage.goto('about:blank');
      
      diagnosis.playwright.browser_test = 'success';
      
      await testPage.close();
      await testContext.close();
      await testBrowser.close();
      
    } catch (e) {
      diagnosis.playwright.error = e.message;
      diagnosis.playwright.browser_test = 'failed';
    }
    
    res.json({ success: true, diagnosis });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Listar screenshots
app.get('/screenshots', (req, res) => {
  try {
    const files = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        return {
          filename: file,
          url: `/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({ success: true, screenshots: files, count: files.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Limpar screenshots antigos
app.delete('/screenshots/cleanup', (req, res) => {
  try {
    const daysOld = parseInt(req.query.daysOld) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const files = fs.readdirSync(screenshotsDir);
    let deletedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(screenshotsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.birthtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    
    res.json({
      success: true,
      message: `${deletedCount} screenshots removidos`,
      deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint principal de automação
app.post('/automate', async (req, res) => {
  let automation = null;
  
  try {
    const {
      url,
      wait_time = 300,
      button_selectors = [],
      completion_selectors = [],
      login_url,
      username,
      password,
      headless = true,
      enable_vnc = false
    } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    logger.info(`Iniciando automação para: ${url}`);
    
    automation = new PlaywrightAutomation();
    
    // Configurar browser
    if (!(await automation.setupBrowser('/chrome-extension', headless, enable_vnc))) {
      throw new Error('Falha ao configurar browser');
    }
    
    // Verificar extensão
    const extensionLoaded = await automation.checkExtensionLoaded();
    
    // Realizar login se necessário
    if (login_url) {
      await automation.performLoginIfNeeded(login_url, username, password);
    }
    
    // Navegar para URL principal
    if (!(await automation.navigateToUrl(url))) {
      throw new Error('Falha ao navegar para URL');
    }
    
    // Encontrar e clicar botão
    const selectors = button_selectors.length > 0 ? button_selectors : null;
    if (!(await automation.findAndClickButton(selectors))) {
      throw new Error('Falha ao encontrar/clicar no botão');
    }
    
    // Aguardar conclusão
    const completionSels = completion_selectors.length > 0 ? completion_selectors : null;
    await automation.waitForCompletion(wait_time, completionSels);
    
    // Capturar resultado
    const screenshotUrl = await automation.takeScreenshot();
    const pageInfo = automation.getPageInfo();
    
    res.json({
      success: true,
      message: 'Automação concluída com sucesso',
      data: {
        initial_url: url,
        final_url: pageInfo.url || url,
        title: pageInfo.title || '',
        screenshot_url: screenshotUrl,
        extension_loaded: extensionLoaded,
        login_performed: !!login_url,
        wait_time_used: wait_time,
        timestamp: pageInfo.timestamp
      }
    });
    
  } catch (error) {
    logger.error(`Erro na automação: ${error.message}`);
    
    // Screenshot de erro
    let errorScreenshotUrl = null;
    if (automation && automation.page && !automation.page.isClosed()) {
      try {
        const errorScreenshot = await automation.page.screenshot({ type: 'png' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `error-screenshot-${timestamp}.png`;
        const filePath = path.join(screenshotsDir, fileName);
        fs.writeFileSync(filePath, errorScreenshot);
        errorScreenshotUrl = `/screenshots/${fileName}`;
      } catch { /* ignorar */ }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      screenshot_url: errorScreenshotUrl,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (automation) {
      await automation.cleanup();
    }
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor Playwright rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Encerrando servidor...');
  process.exit(0);
});