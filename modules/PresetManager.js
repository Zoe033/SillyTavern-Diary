/**
 * 日记预设管理模块
 * 负责智能预设切换、预设发现、缓存等功能
 */

import { delay, isMobileDevice, safeJsonParse, safeJsonStringify } from './utils.js';

export class PresetManager {
  constructor(extensionName) {
    this.extensionName = extensionName;
    this.settings = null;
    this.isPreparingPreset = false;
  }

  /**
   * 获取日记设置
   */
  async getDiarySettings() {
    try {
      if (!this.settings) {
        this.settings = window.SillyTavern.extensionSettings[this.extensionName] || {};
        
        // 初始化默认设置
        if (!this.settings.selectedPreset) {
          this.settings.selectedPreset = '';
        }
        if (!this.settings.discoveredPresets) {
          this.settings.discoveredPresets = [];
        }
        if (!this.settings.lastPresetRefresh) {
          this.settings.lastPresetRefresh = 0;
        }
      }
      
      return this.settings;
    } catch (error) {
      console.error('[预设管理] 获取设置失败:', error);
      return {
        selectedPreset: '',
        lastUsedPreset: '',
        discoveredPresets: [],
        lastPresetRefresh: 0
      };
    }
  }

  /**
   * 保存日记设置
   */
  async saveDiarySettings(settings) {
    try {
      this.settings = { ...this.settings, ...settings };
      window.SillyTavern.extensionSettings[this.extensionName] = this.settings;
      await window.SillyTavern.saveSettingsDebounced();
      console.log('[预设管理] 设置已保存:', this.settings);
    } catch (error) {
      console.error('[预设管理] 保存设置失败:', error);
    }
  }

  /**
   * 获取可用预设列表
   */
  async getAvailablePresets() {
    try {
      const settings = await this.getDiarySettings();
      const currentTime = Date.now();
      
      // 检查是否需要刷新缓存（每5分钟刷新一次）
      const cacheExpiry = 5 * 60 * 1000; // 5分钟
      const shouldRefresh = !settings.lastPresetRefresh || 
                           (currentTime - settings.lastPresetRefresh) > cacheExpiry;

      if (shouldRefresh) {
        console.log('[预设管理] 预设缓存已过期，重新获取');
        return await this.refreshPresetList();
      }

      // 使用缓存的预设列表
      const cachedPresets = settings.discoveredPresets || [];
      const currentPreset = await this.getCurrentPreset();
      
      return this.mergePresetLists(cachedPresets, currentPreset);
    } catch (error) {
      console.error('[预设管理] 获取预设列表失败:', error);
      return await this.getFallbackPresets();
    }
  }

  /**
   * 从 SillyTavern 获取当前可用预设
   */
  async getPresetsFromSillyTavern() {
    try {
      // 尝试通过多种方式获取预设列表
      const presets = [];
      
      // 方法1：通过预设管理器获取
      if (window.SillyTavern?.getPresetManager) {
        const presetManager = window.SillyTavern.getPresetManager();
        if (presetManager && presetManager.presets) {
          presets.push(...Object.keys(presetManager.presets));
        }
      }

      // 方法2：通过全局设置获取
      if (window.preset_settings?.preset_names) {
        presets.push(...window.preset_settings.preset_names);
      }

      // 方法3：尝试通过 slash 命令获取当前预设
      const currentPreset = await this.getCurrentPreset();
      if (currentPreset && !presets.includes(currentPreset)) {
        presets.push(currentPreset);
      }

      return [...new Set(presets)]; // 去重
    } catch (error) {
      console.warn('[预设管理] 从SillyTavern获取预设失败:', error);
      return [];
    }
  }

  /**
   * 获取缓存的预设列表
   */
  async getCachedPresets() {
    const settings = await this.getDiarySettings();
    return settings.discoveredPresets || [];
  }

  /**
   * 合并预设列表（去重并排序）
   */
  mergePresetLists(cachedPresets, currentPreset) {
    const allPresets = new Set();
    
    // 添加缓存的预设
    cachedPresets.forEach(preset => allPresets.add(preset));
    
    // 添加当前预设
    if (currentPreset && currentPreset.trim()) {
      allPresets.add(currentPreset);
    }

    // 转换为数组并排序
    const sortedPresets = Array.from(allPresets)
      .filter(preset => preset && preset.trim())
      .sort();

    return sortedPresets;
  }

  /**
   * 添加发现的预设到缓存
   */
  async addDiscoveredPreset(presetName) {
    try {
      if (!presetName || !presetName.trim()) {
        return;
      }

      const settings = await this.getDiarySettings();
      const discoveredPresets = settings.discoveredPresets || [];
      
      if (!discoveredPresets.includes(presetName)) {
        discoveredPresets.push(presetName);
        await this.saveDiarySettings({
          discoveredPresets: discoveredPresets.sort()
        });
        console.log(`[预设管理] 添加新发现的预设: ${presetName}`);
      }
    } catch (error) {
      console.warn('[预设管理] 添加发现预设失败:', error);
    }
  }

  /**
   * 缓存发现的预设列表
   */
  async cacheDiscoveredPresets(presets) {
    try {
      const validPresets = presets.filter(preset => preset && preset.trim());
      await this.saveDiarySettings({
        discoveredPresets: validPresets.sort(),
        lastPresetRefresh: Date.now()
      });
      console.log(`[预设管理] 缓存了 ${validPresets.length} 个预设`);
    } catch (error) {
      console.warn('[预设管理] 缓存预设失败:', error);
    }
  }

  /**
   * 获取备用预设列表
   */
  async getFallbackPresets() {
    console.log('[预设管理] 使用备用预设列表');
    return [
      'Default',
      'Creative', 
      'Roleplay',
      'Precise',
      'Simple'
    ];
  }

  /**
   * 刷新预设列表
   */
  async refreshPresetList() {
    try {
      console.log('[预设管理] 开始刷新预设列表...');
      
      const currentPresets = await this.getPresetsFromSillyTavern();
      const currentPreset = await this.getCurrentPreset();
      const allPresets = this.mergePresetLists(currentPresets, currentPreset);
      
      // 缓存预设列表
      await this.cacheDiscoveredPresets(allPresets);
      
      console.log(`[预设管理] 刷新完成，发现 ${allPresets.length} 个预设:`, allPresets);
      return allPresets;
    } catch (error) {
      console.error('[预设管理] 刷新预设列表失败:', error);
      return await this.getFallbackPresets();
    }
  }

  /**
   * 获取当前预设
   */
  async getCurrentPreset() {
    try {
      const result = await window.SillyTavern.executeSlashCommandsWithOptions('/preset', {
        abortController: new AbortController()
      });
      
      const presetName = result?.trim();
      console.log(`[预设管理] 当前预设: ${presetName || '未知'}`);
      return presetName || '';
    } catch (error) {
      console.warn('[预设管理] 获取当前预设失败:', error);
      return '';
    }
  }

  /**
   * 切换到指定预设
   */
  async switchToPreset(presetName) {
    try {
      if (!presetName || !presetName.trim()) {
        console.warn('[预设管理] 预设名称为空，跳过切换');
        return false;
      }

      console.log(`[预设管理] 准备切换到预设: ${presetName}`);

      // 验证预设是否存在
      const isValid = await this.validatePreset(presetName);
      if (!isValid) {
        console.warn(`[预设管理] 预设不存在或无效: ${presetName}`);
        // 仍然尝试切换，可能是新预设
      }

      // 执行预设切换
      await window.SillyTavern.executeSlashCommandsWithOptions(`/preset "${presetName}"`, {
        abortController: new AbortController()
      });

      // 移动端需要额外的等待时间
      if (isMobileDevice()) {
        console.log('[预设管理] 移动端环境，延长等待时间');
        await delay(2000);
      } else {
        await delay(1000);
      }

      // 验证切换是否成功
      const currentPreset = await this.getCurrentPreset();
      const success = currentPreset === presetName;
      
      if (success) {
        console.log(`[预设管理] 预设切换成功: ${presetName}`);
        // 将成功切换的预设添加到发现列表
        await this.addDiscoveredPreset(presetName);
      } else {
        console.warn(`[预设管理] 预设切换可能失败，当前预设: ${currentPreset}，目标预设: ${presetName}`);
      }

      return success;
    } catch (error) {
      console.error(`[预设管理] 切换预设失败 (${presetName}):`, error);
      return false;
    }
  }

  /**
   * 准备日记预设（支持移动端）
   */
  async prepareDiaryPresetWithMobileSupport() {
    try {
      if (this.isPreparingPreset) {
        console.log('[预设管理] 预设准备中，跳过重复操作');
        return { success: false };
      }

      this.isPreparingPreset = true;

      if (isMobileDevice()) {
        console.log('[预设管理] 移动端环境，使用优化流程');
        const result = await this.prepareDiaryPresetMobile();
        this.isPreparingPreset = false;
        return result;
      } else {
        const result = await this.prepareDiaryPreset();
        this.isPreparingPreset = false;
        return result;
      }
    } catch (error) {
      this.isPreparingPreset = false;
      console.error('[预设管理] 准备日记预设失败:', error);
      return { success: false };
    }
  }

  /**
   * 移动端预设准备（简化流程）
   */
  async prepareDiaryPresetMobile() {
    try {
      const settings = await this.getDiarySettings();
      const targetPreset = settings.selectedPreset;
      
      if (!targetPreset) {
        console.log('[预设管理] 移动端：未配置日记预设，跳过切换');
        return { success: true };
      }

      // 获取当前预设但不保存（移动端模式下避免频繁操作）
      const currentPreset = await this.getCurrentPreset();
      if (currentPreset === targetPreset) {
        console.log('[预设管理] 移动端：已经是目标预设，无需切换');
        return { success: true, previousPreset: currentPreset };
      }

      // 执行预设切换
      const switchSuccess = await this.switchToPreset(targetPreset);
      if (switchSuccess) {
        return { success: true, previousPreset: currentPreset };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('[预设管理] 移动端预设准备失败:', error);
      return { success: false };
    }
  }

  /**
   * 准备日记预设（桌面端完整流程）
   */
  async prepareDiaryPreset() {
    try {
      const settings = await this.getDiarySettings();
      const targetPreset = settings.selectedPreset;
      
      if (!targetPreset) {
        console.log('[预设管理] 未配置日记预设，跳过预设切换');
        return { success: true };
      }

      // 获取并保存当前预设
      const currentPreset = await this.getCurrentPreset();
      console.log(`[预设管理] 当前预设: ${currentPreset}, 目标预设: ${targetPreset}`);
      
      if (currentPreset === targetPreset) {
        console.log('[预设管理] 已经是目标预设，无需切换');
        return { success: true, previousPreset: currentPreset };
      }

      // 保存当前预设以供后续恢复
      await this.saveDiarySettings({ lastUsedPreset: currentPreset });

      // 切换到日记预设
      const switchSuccess = await this.switchToPreset(targetPreset);
      if (switchSuccess) {
        console.log('[预设管理] 日记预设准备完成');
        return { success: true, previousPreset: currentPreset };
      } else {
        console.error('[预设管理] 预设切换失败');
        return { success: false };
      }
    } catch (error) {
      console.error('[预设管理] 准备日记预设失败:', error);
      return { success: false };
    }
  }

  /**
   * 恢复之前的预设
   */
  async restorePreviousPreset() {
    try {
      const settings = await this.getDiarySettings();
      const previousPreset = settings.lastUsedPreset;
      
      if (!previousPreset) {
        console.log('[预设管理] 没有需要恢复的预设');
        return;
      }

      console.log(`[预设管理] 恢复到之前的预设: ${previousPreset}`);
      
      const restoreSuccess = await this.switchToPreset(previousPreset);
      if (restoreSuccess) {
        // 清除临时保存的预设
        await this.saveDiarySettings({ lastUsedPreset: '' });
        console.log('[预设管理] 预设恢复完成');
      } else {
        console.warn('[预设管理] 预设恢复失败，但不影响日记功能');
      }
    } catch (error) {
      console.error('[预设管理] 恢复预设失败:', error);
    }
  }

  /**
   * 设置日记预设
   */
  async setDiaryPreset(presetName) {
    try {
      await this.saveDiarySettings({ selectedPreset: presetName || '' });
      console.log(`[预设管理] 日记预设已设置为: ${presetName || '(未设置)'}`);
    } catch (error) {
      console.error('[预设管理] 设置日记预设失败:', error);
    }
  }

  /**
   * 检查是否已配置预设
   */
  async isPresetConfigured() {
    try {
      const settings = await this.getDiarySettings();
      return !!(settings.selectedPreset && settings.selectedPreset.trim());
    } catch (error) {
      console.warn('[预设管理] 检查预设配置失败:', error);
      return false;
    }
  }

  /**
   * 获取配置的预设名称
   */
  async getConfiguredPreset() {
    try {
      const settings = await this.getDiarySettings();
      return settings.selectedPreset || null;
    } catch (error) {
      console.warn('[预设管理] 获取配置预设失败:', error);
      return null;
    }
  }

  /**
   * 验证预设是否存在
   */
  async validatePreset(presetName) {
    try {
      if (!presetName || !presetName.trim()) {
        return false;
      }

      // 尝试获取所有可用预设进行验证
      const availablePresets = await this.getPresetsFromSillyTavern();
      const isValid = availablePresets.includes(presetName);
      
      if (!isValid) {
        console.log(`[预设管理] 预设 "${presetName}" 未在可用列表中找到，可能是新预设`);
      }

      return true; // 总是返回true，让系统尝试切换
    } catch (error) {
      console.warn(`[预设管理] 验证预设失败 (${presetName}):`, error);
      return true; // 验证失败时也返回true，让系统尝试切换
    }
  }

  /**
   * 获取预设状态信息
   */
  async getPresetStatus() {
    try {
      const settings = await this.getDiarySettings();
      const currentPreset = await this.getCurrentPreset();
      const configuredPreset = settings.selectedPreset;
      const availablePresets = await this.getAvailablePresets();

      return {
        current: currentPreset,
        configured: configuredPreset,
        available: availablePresets,
        isConfigured: !!(configuredPreset && configuredPreset.trim()),
        isReady: !configuredPreset || currentPreset === configuredPreset,
        needsSwitch: !!(configuredPreset && currentPreset !== configuredPreset)
      };
    } catch (error) {
      console.error('[预设管理] 获取预设状态失败:', error);
      return {
        current: '',
        configured: '',
        available: [],
        isConfigured: false,
        isReady: true,
        needsSwitch: false
      };
    }
  }
}
