import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

// 获取用户设置
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch settings'
      });
    }

    // 如果没有设置记录，返回默认设置
    const defaultSettings = {
      crawl_settings: {
        includeImages: true,
        maxPages: 1,
        timeout: 30000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      pdf_settings: {
        format: 'A4',
        orientation: 'portrait',
        includeImages: true,
        includeLinks: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      },
      general_settings: {
        autoDownload: false,
        deleteAfterDownload: false,
        maxHistoryItems: 100
      }
    };

    res.json({
      success: true,
      data: settings || defaultSettings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 更新用户设置
router.put('/', async (req: Request, res: Response) => {
  try {
    const { crawl_settings, pdf_settings, general_settings } = req.body;

    // 验证设置数据
    if (!crawl_settings && !pdf_settings && !general_settings) {
      return res.status(400).json({
        success: false,
        error: 'At least one setting category is required'
      });
    }

    const now = new Date().toISOString();
    const settingsData: any = {
      updated_at: now
    };

    if (crawl_settings) {
      settingsData.crawl_settings = JSON.stringify(crawl_settings);
    }
    if (pdf_settings) {
      settingsData.pdf_settings = JSON.stringify(pdf_settings);
    }
    if (general_settings) {
      settingsData.general_settings = JSON.stringify(general_settings);
    }

    // 检查是否已存在设置记录
    const { data: existingSettings } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existingSettings) {
      // 更新现有记录
      result = await supabaseAdmin
        .from('user_settings')
        .update(settingsData)
        .eq('id', existingSettings.id)
        .select()
        .single();
    } else {
      // 创建新记录
      settingsData.created_at = now;
      result = await supabaseAdmin
        .from('user_settings')
        .insert(settingsData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Database error:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update settings'
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 重置设置为默认值
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const defaultSettings = {
      crawl_settings: JSON.stringify({
        includeImages: true,
        maxPages: 1,
        timeout: 30000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }),
      pdf_settings: JSON.stringify({
        format: 'A4',
        orientation: 'portrait',
        includeImages: true,
        includeLinks: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      }),
      general_settings: JSON.stringify({
        autoDownload: false,
        deleteAfterDownload: false,
        maxHistoryItems: 100
      }),
      updated_at: new Date().toISOString()
    };

    // 检查是否已存在设置记录
    const { data: existingSettings } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existingSettings) {
      // 更新现有记录
      result = await supabaseAdmin
        .from('user_settings')
        .update(defaultSettings)
        .eq('id', existingSettings.id)
        .select()
        .single();
    } else {
      // 创建新记录
      (defaultSettings as any).created_at = defaultSettings.updated_at;
      result = await supabaseAdmin
        .from('user_settings')
        .insert(defaultSettings)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Database error:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reset settings'
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Settings reset to default values'
    });

  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;