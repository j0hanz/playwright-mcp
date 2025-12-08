// Security - URL validation, script evaluation, and file upload security

import config from '../config/server-config.js';
import {
  ErrorCode,
  ErrorHandler,
  isMCPPlaywrightError,
  toError,
} from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { Page } from 'playwright';
import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = new Logger('Security');

export const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const SAFE_SCRIPT_TEMPLATES: Record<string, string> = {
  getTitle: 'document.title',
  getURL: 'window.location.href',
  getViewport:
    'JSON.stringify({ width: window.innerWidth, height: window.innerHeight })',
  getScrollPosition: 'JSON.stringify({ x: window.scrollX, y: window.scrollY })',
  getBodyText: 'document.body?.innerText || ""',
  getDocumentReadyState: 'document.readyState',
  getActiveElement:
    'JSON.stringify({ tagName: document.activeElement?.tagName, id: document.activeElement?.id, className: document.activeElement?.className })',
  getPageDimensions:
    'JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight })',
  getFormCount: 'document.forms.length',
  getLinkCount: 'document.links.length',
  getImageCount: 'document.images.length',
  getUserAgent: 'navigator.userAgent',
  getLanguage: 'navigator.language',
};

const STRICT_BLOCKLIST = [
  // Code execution
  'eval',
  'Function(',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'requestIdleCallback',
  // Storage access
  'document.cookie',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'openDatabase',
  'caches',
  // Network requests
  'XMLHttpRequest',
  'fetch(',
  'importScripts',
  'navigator.sendBeacon',
  'EventSource',
  'WebSocket',
  // DOM manipulation (XSS vectors)
  'window.open',
  'document.write',
  'document.writeln',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'createContextualFragment',
  'document.domain',
  'document.implementation',
  // Prototype pollution
  '__proto__',
  '.constructor',
  '.prototype',
  'Object.assign',
  'Object.defineProperty',
  'Object.setPrototypeOf',
  'Reflect.',
  'Proxy',
  // Script injection
  'script>',
  '<script',
  '<iframe',
  '<object',
  '<embed',
  '<svg',
  'onerror',
  'onload',
  'onclick',
  // URI schemes
  'javascript:',
  'data:',
  'vbscript:',
  'blob:',
  // Encoding bypass attempts
  'atob',
  'btoa',
  'unescape',
  'decodeURI',
  'decodeURIComponent',
  'String.fromCharCode',
  'String.fromCodePoint',
  // Dangerous APIs
  'execCommand',
  'document.execCommand',
  'postMessage',
  'BroadcastChannel',
  'SharedWorker',
  'Worker(',
  'ServiceWorker',
  'navigator.serviceWorker',
  // Module loading
  'import(',
  'require(',
  'define(',
  // Clipboard access
  'navigator.clipboard',
  'document.getSelection',
  // Location manipulation
  'location.href',
  'location.assign',
  'location.replace',
  'history.pushState',
  'history.replaceState',
];

// Patterns for allowed safe scripts
const SAFE_PATTERNS = [
  /^\s*document\.querySelector\s*\([^)]+\)(\s*\?\.\s*|\s*\.\s*|\s*$)/,
  /^\s*document\.querySelectorAll\s*\([^)]+\)/,
  /^\s*document\.getElementById\s*\([^)]+\)(\s*\?\.\s*|\s*\.\s*|\s*$)/,
  /^\s*document\.getElementsByClassName\s*\([^)]+\)/,
  /^\s*document\.getElementsByTagName\s*\([^)]+\)/,
  /^\s*document\.title\s*$/,
  /^\s*document\.readyState\s*$/,
  /^\s*document\.body\s*(\?\.)?\s*\w+/,
  /^\s*document\.documentElement\s*(\?\.)?\s*\w+/,
  /^\s*document\.activeElement\s*(\?\.)?\s*\w+/,
  /^\s*document\.forms\b/,
  /^\s*document\.links\b/,
  /^\s*document\.images\b/,
  /^\s*document\.head\b/,
  /^\s*window\.innerWidth\s*$/,
  /^\s*window\.innerHeight\s*$/,
  /^\s*window\.scrollY\s*$/,
  /^\s*window\.scrollX\s*$/,
  /^\s*window\.pageYOffset\s*$/,
  /^\s*window\.pageXOffset\s*$/,
  /^\s*window\.screen\s*\.\s*\w+/,
  /^\s*window\.devicePixelRatio\s*$/,
  /^\s*window\.getComputedStyle\s*\(/,
  /^\s*Array\.from\s*\(\s*document\.(querySelector|getElementById|getElementsBy)/,
  /^\s*\[\s*\.\.\.document\.(querySelector|getElementById|getElementsBy)/,
  /^\s*JSON\.stringify\s*\(/,
  /\.(textContent|innerText|value|checked|selected|disabled|hidden|id|className|classList|tagName|nodeName|nodeType|href|src|alt|title|placeholder|name|type|getAttribute|hasAttribute|dataset|style\.\w+|offsetWidth|offsetHeight|offsetTop|offsetLeft|clientWidth|clientHeight|scrollWidth|scrollHeight|getBoundingClientRect)\s*(\(|$)/,
  /^\s*\(\s*\)\s*=>\s*(document|window)\./,
  /^\s*\(function\s*\(\)\s*\{[^}]*return\s+(document|window)\./,
  /^\s*navigator\.(userAgent|language|languages|platform|vendor|onLine|cookieEnabled|hardwareConcurrency|maxTouchPoints)\s*$/,
  /^\s*performance\.(now|timeOrigin|navigation|timing)\b/,
];

function isBlockedOperation(script: string): boolean {
  const normalized = script.normalize('NFKC').toLowerCase();
  return STRICT_BLOCKLIST.some((blocked) =>
    normalized.includes(blocked.toLowerCase())
  );
}

function isSafeScript(script: string): boolean {
  const trimmed = script.trim();

  // Check against safe patterns
  return SAFE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

const ALLOWED_UPLOAD_DIR = process.env.ALLOWED_UPLOAD_DIR
  ? path.resolve(process.env.ALLOWED_UPLOAD_DIR)
  : fileURLToPath(new URL('../../uploads', import.meta.url));

export function validateUrlProtocol(url: string): void {
  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Invalid URL protocol: ${parsedUrl.protocol}. Only http: and https: are allowed.`
      );
    }
  } catch (error) {
    // Re-throw if it's already our error type
    if (isMCPPlaywrightError(error)) throw error;

    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Invalid URL format: ${url}`
    );
  }
}

function validateScript(script: string): void {
  if (script.length > config.limits.maxScriptLength) {
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Script exceeds maximum length of ${config.limits.maxScriptLength} characters`
    );
  }

  if (isBlockedOperation(script)) {
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Script contains blocked operation. Use predefined templates: ${Object.keys(SAFE_SCRIPT_TEMPLATES).join(', ')}`
    );
  }
}

export async function evaluateScript(
  page: Page,
  script: string
): Promise<{ result: unknown }> {
  validateScript(script);

  const templateScript = SAFE_SCRIPT_TEMPLATES[script.trim()];
  const scriptToExecute = templateScript || script;

  if (!templateScript && !isSafeScript(script)) {
    const templateList = Object.keys(SAFE_SCRIPT_TEMPLATES).join(', ');
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Script does not match allowed patterns. Use template shortcuts (${templateList}) or DOM query patterns like: document.querySelector('.selector').textContent`
    );
  }

  try {
    const result = await page.evaluate(scriptToExecute);
    return { result };
  } catch (error) {
    const err = toError(error);
    logger.error('Script evaluation failed', { error: err.message });
    throw ErrorHandler.handlePlaywrightError(err);
  }
}

export async function validateUploadPath(filePath: string): Promise<string> {
  try {
    // First check: resolve path before symlink resolution
    const initialResolved = path.resolve(filePath);
    if (!initialResolved.startsWith(ALLOWED_UPLOAD_DIR)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `File path not allowed: ${filePath}. Files must be in the uploads directory.`
      );
    }

    // Second check: resolve symlinks and verify still in upload dir (TOCTOU mitigation)
    const resolvedPath = await fs.realpath(initialResolved);
    if (!resolvedPath.startsWith(ALLOWED_UPLOAD_DIR)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Symlink points outside upload directory: ${filePath}`
      );
    }

    // Check file exists and is readable
    await fs.access(resolvedPath, fsConstants.R_OK);

    // Verify it's a regular file, not a directory
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Path is not a file: ${filePath}`
      );
    }

    // Enforce file size limit
    if (stats.size > config.limits.maxFileSizeForUpload) {
      const maxSizeMB = Math.round(
        config.limits.maxFileSizeForUpload / (1024 * 1024)
      );
      const actualSizeMB = Math.round(stats.size / (1024 * 1024));
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `File size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB): ${filePath}`
      );
    }

    return resolvedPath;
  } catch (error) {
    if (isMCPPlaywrightError(error)) throw error;
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `File not found or not accessible: ${filePath}`
    );
  }
}
