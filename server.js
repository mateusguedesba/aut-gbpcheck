const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/app/data/app.log' })
  ]
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota principal para automação
app.post('/automate', async (req, res) => {
  const { url, waitTime = 300000, extensionPath = '/chrome-extension' } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger.info(`Iniciando automação para URL: ${url}`);

    // Configurar argumentos do Chrome com extensão
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
      '--disable-default-apps'
    ];

    // Iniciar browser
    browser = await chromium.launch({
      headless: true, // ← MUDANÇA: true em vez de false
      args: browserArgs,
      slowMo: 100
    });

    // Criar contexto
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    // Criar página
    page = await context.newPage();

    // Navegar para a URL
    logger.info(`Navegando para: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Aguardar a página carregar completamente
    await page.waitForTimeout(5000);

    // Aguardar o botão da extensão aparecer
    logger.info('Aguardando botão da extensão...');
    
    // Seletores específicos para o botão "Pré Análise"
    const possibleSelectors = [
      '.start-main-check-btn',              // Classe específica do botão
      '.main-btn.start-main-check-btn',     // Combinação de classes
      'button.start-main-check-btn',        // Tag + classe
      'button.main-btn.start-main-check-btn', // Tag + ambas classes
      'button[class*="start-main-check-btn"]' // Atributo que contém a classe
    ];

    let buttonFound = false;
    let button = null;

    // Tentar encontrar o botão usando diferentes seletores
    for (const selector of possibleSelectors) {
      try {
        button = await page.waitForSelector(selector, { timeout: 10000 });
        if (button) {
          buttonFound = true;
          logger.info(`Botão encontrado com seletor: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue tentando outros seletores
        continue;
      }
    }

    // Se não encontrou com seletores específicos, tentar busca mais ampla
    if (!buttonFound) {
      logger.info('Tentando encontrar botão por texto...');
      try {
        // Procurar especificamente pelo texto "Pré Análise"
        button = await page.locator('button').filter({ hasText: /pré análise/i }).first();
        await button.waitFor({ timeout: 10000 });
        buttonFound = true;
        logger.info('Botão encontrado por texto "Pré Análise"');
      } catch (e) {
        // Tentar outras variações de texto
        try {
          button = await page.locator('button').filter({ hasText: /pre análise/i }).first();
          await button.waitFor({ timeout: 5000 });
          buttonFound = true;
          logger.info('Botão encontrado por texto "Pre Análise"');
        } catch (e2) {
          logger.error('Não foi possível encontrar o botão da extensão');
        }
      }
    }

    if (!buttonFound) {
      throw new Error('Botão da extensão não encontrado na página');
    }

    // Clicar no botão
    logger.info('Clicando no botão da extensão...');
    await button.click();

    // Aguardar o processo (5 minutos por padrão)
    logger.info(`Aguardando processo por ${waitTime / 1000} segundos...`);
    
    // Monitorar mudanças na página durante a espera de forma mais robusta
    const startTime = Date.now();
    let processComplete = false;
    
    while (Date.now() - startTime < waitTime && !processComplete) {
      try {
        // Verificar se a página ainda existe e está acessível
        if (page.isClosed()) {
          logger.info('Página foi fechada pela extensão, tentando reabrir...');
          page = await context.newPage();
          await page.waitForTimeout(2000);
        }

        // Verificar se o contexto ainda existe
        if (context.pages().length === 0) {
          logger.info('Todas as páginas foram fechadas, criando nova página...');
          page = await context.newPage();
          await page.waitForTimeout(2000);
        }

        // Se houver múltiplas páginas/abas abertas, monitorar a mais recente
        const pages = context.pages();
        if (pages.length > 1) {
          logger.info(`Detectadas ${pages.length} abas abertas, monitorando a mais recente...`);
          page = pages[pages.length - 1]; // Usar a página mais recente
        }

        // Aguardar a página carregar se houve redirecionamento
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
          // Se não conseguir aguardar o networkidle, continue
        }

        // Verificar indicadores de que o processo terminou
        const completionIndicators = [
          '.process-complete',
          '.success',
          '.finished',
          '.done',
          '.analysis-complete',
          '.result',
          '.results',
          '[data-status="complete"]',
          '[data-status="success"]',
          // Indicadores específicos que podem aparecer após a análise
          '.analysis-result',
          '.check-complete',
          '.verification-complete'
        ];

        for (const indicator of completionIndicators) {
          try {
            const element = await page.locator(indicator).first();
            if (await element.isVisible().catch(() => false)) {
              processComplete = true;
              logger.info(`Processo concluído - indicador encontrado: ${indicator}`);
              break;
            }
          } catch (e) {
            // Continuar verificando outros indicadores
            continue;
          }
        }

        // Verificar se o URL mudou significativamente (pode indicar conclusão)
        const currentUrl = page.url();
        if (currentUrl.includes('result') || currentUrl.includes('complete') || 
            currentUrl.includes('finish') || currentUrl.includes('done')) {
          logger.info(`Processo possivelmente concluído - URL final: ${currentUrl}`);
          processComplete = true;
          break;
        }

        // Verificar por texto que indica conclusão
        try {
          const pageContent = await page.textContent('body');
          if (pageContent && (
            pageContent.toLowerCase().includes('análise concluída') ||
            pageContent.toLowerCase().includes('processo finalizado') ||
            pageContent.toLowerCase().includes('resultado') ||
            pageContent.toLowerCase().includes('completo')
          )) {
            logger.info('Processo concluído - texto de conclusão detectado');
            processComplete = true;
            break;
          }
        } catch (e) {
          // Se não conseguir ler o conteúdo, continue
        }

        if (!processComplete) {
          await page.waitForTimeout(5000); // Aguardar 5 segundos antes de verificar novamente
        }

      } catch (error) {
        logger.warn(`Erro durante monitoramento (continuando): ${error.message}`);
        
        try {
          // Tentar recuperar se houver erro
          if (page.isClosed() || !page) {
            logger.info('Tentando recuperar página perdida...');
            const pages = context.pages();
            if (pages.length > 0) {
              page = pages[pages.length - 1];
            } else {
              page = await context.newPage();
            }
          }
          
          await page.waitForTimeout(5000);
        } catch (recoveryError) {
          logger.error(`Erro na recuperação: ${recoveryError.message}`);
          // Continue o loop mesmo com erro
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Capturar screenshot final (com tratamento de erro)
    let screenshot = null;
    try {
      // Tentar capturar screenshot da página final
      const pages = context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : page;
      
      if (finalPage && !finalPage.isClosed()) {
        screenshot = await finalPage.screenshot({ 
          fullPage: true,
          type: 'png'
        });
      }
    } catch (screenshotError) {
      logger.warn(`Erro ao capturar screenshot: ${screenshotError.message}`);
    }

    // Obter informações finais da página (com tratamento de erro)
    let finalUrl = url;
    let title = '';
    
    try {
      const pages = context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : page;
      
      if (finalPage && !finalPage.isClosed()) {
        finalUrl = finalPage.url();
        title = await finalPage.title();
      }
    } catch (infoError) {
      logger.warn(`Erro ao obter informações da página: ${infoError.message}`);
    }
    
    logger.info('Automação concluída com sucesso');

    res.json({
      success: true,
      message: 'Automação concluída com sucesso',
      data: {
        initialUrl: url,
        finalUrl: finalUrl,
        title: title,
        processTime: Date.now() - startTime,
        screenshot: screenshot.toString('base64'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`Erro na automação: ${error.message}`);
    
    // Capturar screenshot do erro se a página existir
    let errorScreenshot = null;
    if (page) {
      try {
        errorScreenshot = await page.screenshot({ type: 'png' });
      } catch (e) {
        // Ignore screenshot errors
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      screenshot: errorScreenshot ? errorScreenshot.toString('base64') : null,
      timestamp: new Date().toISOString()
    });

  } finally {
    // Limpeza
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor Playwright rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});