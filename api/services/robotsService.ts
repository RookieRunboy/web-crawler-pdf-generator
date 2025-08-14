import axios from 'axios';
import { URL } from 'node:url';

interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
  sitemap?: string[];
}

interface RobotsCache {
  [domain: string]: {
    rules: RobotsRule[];
    timestamp: number;
    ttl: number; // Time to live in milliseconds
  };
}

export class RobotsService {
  private cache: RobotsCache = {};
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly requestTimeout = 10000; // 10 seconds

  /**
   * 获取指定域名的robots.txt内容
   */
  private async fetchRobotsTxt(domain: string): Promise<string> {
    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: this.requestTimeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        validateStatus: (status) => status === 200
      });
      return response.data;
    } catch (error) {
      console.warn(`Failed to fetch robots.txt for ${domain}:`, error);
      return ''; // 如果获取失败，返回空字符串（允许所有爬取）
    }
  }

  /**
   * 解析robots.txt内容
   */
  private parseRobotsTxt(content: string): RobotsRule[] {
    const lines = content.split('\n').map(line => line.trim());
    const rules: RobotsRule[] = [];
    let currentRule: Partial<RobotsRule> | null = null;

    for (const line of lines) {
      // 跳过空行和注释
      if (!line || line.startsWith('#')) {
        continue;
      }

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const lowerKey = key.toLowerCase().trim();

      switch (lowerKey) {
        case 'user-agent':
          // 如果有当前规则，先保存它
          if (currentRule && currentRule.userAgent) {
            rules.push({
              userAgent: currentRule.userAgent,
              disallow: currentRule.disallow || [],
              allow: currentRule.allow || [],
              crawlDelay: currentRule.crawlDelay,
              sitemap: currentRule.sitemap
            });
          }
          // 开始新规则
          currentRule = {
            userAgent: value,
            disallow: [],
            allow: [],
            sitemap: []
          };
          break;

        case 'disallow':
          if (currentRule) {
            currentRule.disallow = currentRule.disallow || [];
            if (value) {
              currentRule.disallow.push(value);
            }
          }
          break;

        case 'allow':
          if (currentRule) {
            currentRule.allow = currentRule.allow || [];
            if (value) {
              currentRule.allow.push(value);
            }
          }
          break;

        case 'crawl-delay':
          if (currentRule) {
            const delay = parseInt(value);
            if (!isNaN(delay)) {
              currentRule.crawlDelay = delay * 1000; // 转换为毫秒
            }
          }
          break;

        case 'sitemap':
          if (currentRule) {
            currentRule.sitemap = currentRule.sitemap || [];
            if (value) {
              currentRule.sitemap.push(value);
            }
          }
          break;
      }
    }

    // 保存最后一个规则
    if (currentRule && currentRule.userAgent) {
      rules.push({
        userAgent: currentRule.userAgent,
        disallow: currentRule.disallow || [],
        allow: currentRule.allow || [],
        crawlDelay: currentRule.crawlDelay,
        sitemap: currentRule.sitemap
      });
    }

    return rules;
  }

  /**
   * 获取域名的robots.txt规则（带缓存）
   */
  async getRobotsRules(domain: string): Promise<RobotsRule[]> {
    const now = Date.now();
    const cached = this.cache[domain];

    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.rules;
    }

    // 获取并解析robots.txt
    const content = await this.fetchRobotsTxt(domain);
    const rules = this.parseRobotsTxt(content);

    // 缓存结果
    this.cache[domain] = {
      rules,
      timestamp: now,
      ttl: this.defaultTTL
    };

    return rules;
  }

  /**
   * 检查URL是否被robots.txt允许访问
   */
  async isUrlAllowed(url: string, userAgent: string = '*'): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;
      const path = parsedUrl.pathname;

      const rules = await this.getRobotsRules(domain);
      
      // 如果没有规则，默认允许
      if (rules.length === 0) {
        return true;
      }

      // 查找匹配的规则（优先匹配具体的user-agent，然后是*）
      const matchingRules = rules.filter(rule => 
        rule.userAgent === userAgent || rule.userAgent === '*'
      );

      if (matchingRules.length === 0) {
        return true; // 没有匹配的规则，默认允许
      }

      // 检查每个匹配的规则
      for (const rule of matchingRules) {
        // 首先检查Allow规则（优先级更高）
        for (const allowPattern of rule.allow) {
          if (this.matchesPattern(path, allowPattern)) {
            return true;
          }
        }

        // 然后检查Disallow规则
        for (const disallowPattern of rule.disallow) {
          if (this.matchesPattern(path, disallowPattern)) {
            return false;
          }
        }
      }

      return true; // 没有匹配的禁止规则，默认允许
    } catch (error) {
      console.warn(`Error checking robots.txt for ${url}:`, error);
      return true; // 出错时默认允许
    }
  }

  /**
   * 获取URL的爬取延迟时间
   */
  async getCrawlDelay(url: string, userAgent: string = '*'): Promise<number> {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;

      const rules = await this.getRobotsRules(domain);
      
      // 查找匹配的规则
      const matchingRules = rules.filter(rule => 
        rule.userAgent === userAgent || rule.userAgent === '*'
      );

      // 返回第一个有crawl-delay的规则的延迟时间
      for (const rule of matchingRules) {
        if (rule.crawlDelay !== undefined) {
          return rule.crawlDelay;
        }
      }

      return 0; // 没有设置延迟，返回0
    } catch (error) {
      console.warn(`Error getting crawl delay for ${url}:`, error);
      return 0;
    }
  }

  /**
   * 检查路径是否匹配robots.txt模式
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // 处理空模式
    if (!pattern) {
      return false;
    }

    // 如果模式是根路径，匹配所有
    if (pattern === '/') {
      return true;
    }

    // 转换robots.txt模式为正则表达式
    // * 匹配任意字符序列
    // $ 表示路径结尾
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*'); // * 转换为 .*

    // 如果模式以$结尾，表示精确匹配到路径结尾
    if (regexPattern.endsWith('$')) {
      regexPattern = regexPattern.slice(0, -1) + '$';
    } else {
      // 否则匹配路径前缀
      regexPattern = '^' + regexPattern;
    }

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    } catch (error) {
      console.warn(`Invalid robots.txt pattern: ${pattern}`);
      return false;
    }
  }

  /**
   * 清理过期的缓存
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    for (const domain in this.cache) {
      const cached = this.cache[domain];
      if ((now - cached.timestamp) >= cached.ttl) {
        delete this.cache[domain];
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { domains: number; totalSize: number } {
    const domains = Object.keys(this.cache).length;
    const totalSize = JSON.stringify(this.cache).length;
    return { domains, totalSize };
  }
}

// 导出单例实例
export const robotsService = new RobotsService();