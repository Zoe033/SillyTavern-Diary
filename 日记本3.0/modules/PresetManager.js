/**
 * 预设管理模块
 * 负责智能预设切换，为日记写作提供专用预设支持
 */

export class PresetManager {
    constructor(extensionName) {
        this.extensionName = extensionName;
        this.cachedPresets = [];
        this.lastRefreshTime = 0;
        this.refreshInterval = 5 * 60 * 1000; // 5分钟缓存
        this.isMobile = this.detectMobile();
    }

    /**
     * 检测移动端设备
     * @returns {boolean} 是否为移动端
     */
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    /**
     * 获取日记设置
     * @returns {Promise<Object>} 日记设置对象
     */
    async getDiarySettings() {
        try {
            const settings = extension_settings[this.extensionName] || {};
            return {
                selectedPreset: settings.selectedPreset || null,
                lastUsedPreset: settings.lastUsedPreset || null,
                discoveredPresets: settings.discoveredPresets || [],
                lastPresetRefresh: settings.lastPresetRefresh || 0
            };
        } catch (error) {
            console.error(`❌ [PresetManager] 获取设置失败:`, error);
            return {
                selectedPreset: null,
                lastUsedPreset: null,
                discoveredPresets: [],
                lastPresetRefresh: 0
            };
        }
    }

    /**
     * 保存日记设置
     * @param {Object} settings 要保存的设置
     */
    async saveDiarySettings(settings) {
        try {
            if (!extension_settings[this.extensionName]) {
                extension_settings[this.extensionName] = {};
            }

            Object.assign(extension_settings[this.extensionName], settings);
            
            // 使用SillyTavern的设置保存函数
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }

            console.log(`✅ [PresetManager] 设置已保存:`, settings);
        } catch (error) {
            console.error(`❌ [PresetManager] 保存设置失败:`, error);
            throw new Error(`保存预设设置失败: ${error.message}`);
        }
    }

    /**
     * 获取可用预设列表
     * @returns {Promise<Array>} 预设名称数组
     */
    async getAvailablePresets() {
        try {
            const now = Date.now();
            const settings = await this.getDiarySettings();

            // 检查缓存是否过期
            if (this.cachedPresets.length > 0 && 
                (now - this.lastRefreshTime) < this.refreshInterval) {
                console.log(`📋 [PresetManager] 使用缓存的预设列表`);
                return this.mergePresetLists(this.cachedPresets, settings.selectedPreset);
            }

            console.log(`📋 [PresetManager] 刷新预设列表...`);
            
            // 尝试从SillyTavern获取预设列表
            const currentPresets = await this.getPresetsFromSillyTavern();
            const cachedPresets = await this.getCachedPresets();
            
            // 合并预设列表
            const allPresets = this.mergePresetLists(currentPresets, settings.selectedPreset);
            
            // 更新缓存
            this.cachedPresets = allPresets;
            this.lastRefreshTime = now;
            
            // 缓存发现的预设
            await this.cacheDiscoveredPresets(allPresets);

            console.log(`✅ [PresetManager] 预设列表刷新完成，共 ${allPresets.length} 个预设`);
            return allPresets;
        } catch (error) {
            console.error(`❌ [PresetManager] 获取预设列表失败:`, error);
            return await this.getFallbackPresets();
        }
    }

    /**
     * 从SillyTavern获取预设列表
     * @returns {Promise<Array>} 预设名称数组
     */
    async getPresetsFromSillyTavern() {
        try {
            // 尝试使用SillyTavern的API获取预设列表
            // 这里需要根据SillyTavern的具体API实现
            
            // 方法1: 通过preset命令获取当前预设（可能可以推断出预设系统）
            const currentPreset = await this.executeSlashCommand('/preset');
            
            if (currentPreset && currentPreset.trim()) {
                console.log(`📋 [PresetManager] 检测到当前预设: ${currentPreset}`);
                return [currentPreset.trim()];
            }

            // 方法2: 如果API允许，尝试其他方式获取预设列表
            // 这里需要根据实际的SillyTavern API来实现
            console.warn(`⚠️ [PresetManager] 暂时无法从SillyTavern获取预设列表`);
            return [];
        } catch (error) {
            console.error(`❌ [PresetManager] 从SillyTavern获取预设失败:`, error);
            return [];
        }
    }

    /**
     * 获取缓存的预设列表
     * @returns {Promise<Array>} 缓存的预设名称数组
     */
    async getCachedPresets() {
        try {
            const settings = await this.getDiarySettings();
            return settings.discoveredPresets || [];
        } catch (error) {
            console.error(`❌ [PresetManager] 获取缓存预设失败:`, error);
            return [];
        }
    }

    /**
     * 合并预设列表，去重并排序
     * @param {Array} cachedPresets 缓存的预设列表
     * @param {string} currentPreset 当前选择的预设
     * @returns {Array} 合并后的预设列表
     */
    mergePresetLists(cachedPresets, currentPreset) {
        const presetSet = new Set(cachedPresets.filter(p => p && p.trim()));
        
        // 确保当前选择的预设在列表中
        if (currentPreset && currentPreset.trim()) {
            presetSet.add(currentPreset.trim());
        }

        // 转换为数组并排序
        return Array.from(presetSet).sort((a, b) => a.localeCompare(b));
    }

    /**
     * 添加新发现的预设
     * @param {string} presetName 预设名称
     */
    async addDiscoveredPreset(presetName) {
        try {
            if (!presetName || !presetName.trim()) {
                return;
            }

            const settings = await this.getDiarySettings();
            const discoveredPresets = settings.discoveredPresets || [];
            
            if (!discoveredPresets.includes(presetName.trim())) {
                discoveredPresets.push(presetName.trim());
                await this.saveDiarySettings({ discoveredPresets });
                
                // 更新缓存
                this.cachedPresets = this.mergePresetLists(discoveredPresets, settings.selectedPreset);
                
                console.log(`✅ [PresetManager] 新预设已添加: ${presetName}`);
            }
        } catch (error) {
            console.error(`❌ [PresetManager] 添加发现预设失败:`, error);
        }
    }

    /**
     * 缓存发现的预设列表
     * @param {Array} presets 预设列表
     */
    async cacheDiscoveredPresets(presets) {
        try {
            await this.saveDiarySettings({
                discoveredPresets: presets,
                lastPresetRefresh: Date.now()
            });
        } catch (error) {
            console.error(`❌ [PresetManager] 缓存预设列表失败:`, error);
        }
    }

    /**
     * 获取备用预设列表（当API调用失败时使用）
     * @returns {Promise<Array>} 备用预设列表
     */
    async getFallbackPresets() {
        const fallbackPresets = [
            'Default',
            'Creative',
            'Precise', 
            'Simple',
            'Complex',
            'Narrative',
            'Dialogue',
            'Description'
        ];
        
        console.warn(`⚠️ [PresetManager] 使用备用预设列表`);
        return fallbackPresets;
    }

    /**
     * 刷新预设列表
     * @returns {Promise<Array>} 刷新后的预设列表
     */
    async refreshPresetList() {
        try {
            console.log(`🔄 [PresetManager] 强制刷新预设列表...`);
            
            // 清除缓存
            this.cachedPresets = [];
            this.lastRefreshTime = 0;
            
            // 重新获取预设列表
            const presets = await this.getAvailablePresets();
            
            console.log(`✅ [PresetManager] 预设列表刷新完成`);
            return presets;
        } catch (error) {
            console.error(`❌ [PresetManager] 刷新预设列表失败:`, error);
            throw error;
        }
    }

    /**
     * 获取当前预设
     * @returns {Promise<string>} 当前预设名称
     */
    async getCurrentPreset() {
        try {
            const result = await this.executeSlashCommand('/preset');
            const presetName = result?.trim() || '';
            
            if (presetName) {
                // 将新发现的预设添加到缓存
                await this.addDiscoveredPreset(presetName);
            }
            
            return presetName;
        } catch (error) {
            console.error(`❌ [PresetManager] 获取当前预设失败:`, error);
            return '';
        }
    }

    /**
     * 切换到指定预设
     * @param {string} presetName 预设名称
     * @returns {Promise<boolean>} 是否切换成功
     */
    async switchToPreset(presetName) {
        try {
            if (!presetName || !presetName.trim()) {
                throw new Error('预设名称不能为空');
            }

            console.log(`🔄 [PresetManager] 切换预设: ${presetName} (移动端: ${this.isMobile})`);

            // 执行预设切换命令
            await this.executeSlashCommand(`/preset ${presetName}`);
            
            // 等待预设切换生效
            const waitTime = this.isMobile ? 2000 : 1000; // 移动端需要更长等待时间
            await this.delay(waitTime);

            // 验证预设是否切换成功
            const currentPreset = await this.getCurrentPreset();
            const success = currentPreset === presetName;

            if (success) {
                console.log(`✅ [PresetManager] 预设切换成功: ${presetName}`);
                await this.addDiscoveredPreset(presetName);
            } else {
                console.warn(`⚠️ [PresetManager] 预设切换验证失败: 期望 "${presetName}", 实际 "${currentPreset}"`);
            }

            return success;
        } catch (error) {
            console.error(`❌ [PresetManager] 切换预设失败:`, error);
            return false;
        }
    }

    /**
     * 延迟函数
     * @param {number} ms 延迟毫秒数
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 准备日记预设：切换到日记预设并保存当前预设
     * @returns {Promise<Object>} 操作结果 {success: boolean, previousPreset?: string}
     */
    async prepareDiaryPreset() {
        try {
            console.log(`📝 [PresetManager] 准备日记预设...`);

            // 获取当前预设
            const currentPreset = await this.getCurrentPreset();
            console.log(`📝 [PresetManager] 当前预设: "${currentPreset}"`);

            // 获取配置的日记预设
            const settings = await this.getDiarySettings();
            const diaryPreset = settings.selectedPreset;

            if (!diaryPreset) {
                console.log(`📝 [PresetManager] 未配置日记专用预设，使用当前预设`);
                return { success: true, previousPreset: currentPreset };
            }

            if (currentPreset === diaryPreset) {
                console.log(`📝 [PresetManager] 当前已是日记预设，无需切换`);
                return { success: true, previousPreset: currentPreset };
            }

            // 保存当前预设
            if (currentPreset) {
                await this.saveDiarySettings({ lastUsedPreset: currentPreset });
                console.log(`📝 [PresetManager] 已保存当前预设: ${currentPreset}`);
            }

            // 切换到日记预设
            const switchSuccess = await this.switchToPreset(diaryPreset);
            
            if (switchSuccess) {
                console.log(`✅ [PresetManager] 日记预设准备完成: ${diaryPreset}`);
                return { success: true, previousPreset: currentPreset };
            } else {
                throw new Error(`切换到日记预设失败: ${diaryPreset}`);
            }
        } catch (error) {
            console.error(`❌ [PresetManager] 准备日记预设失败:`, error);
            return { success: false, error: error.message };
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
                console.log(`📝 [PresetManager] 没有需要恢复的预设`);
                return;
            }

            console.log(`🔄 [PresetManager] 恢复之前的预设: ${previousPreset}`);

            const success = await this.switchToPreset(previousPreset);
            
            if (success) {
                // 清除保存的预设记录
                await this.saveDiarySettings({ lastUsedPreset: null });
                console.log(`✅ [PresetManager] 预设恢复成功: ${previousPreset}`);
            } else {
                console.warn(`⚠️ [PresetManager] 预设恢复失败: ${previousPreset}`);
            }
        } catch (error) {
            console.error(`❌ [PresetManager] 恢复预设失败:`, error);
        }
    }

    /**
     * 设置日记预设
     * @param {string|null} presetName 预设名称，null表示不使用专用预设
     */
    async setDiaryPreset(presetName) {
        try {
            await this.saveDiarySettings({ selectedPreset: presetName });
            
            if (presetName) {
                await this.addDiscoveredPreset(presetName);
                console.log(`✅ [PresetManager] 日记预设已设置: ${presetName}`);
            } else {
                console.log(`✅ [PresetManager] 已清除日记预设配置`);
            }
        } catch (error) {
            console.error(`❌ [PresetManager] 设置日记预设失败:`, error);
            throw error;
        }
    }

    /**
     * 检查是否配置了日记预设
     * @returns {Promise<boolean>} 是否已配置
     */
    async isPresetConfigured() {
        try {
            const settings = await this.getDiarySettings();
            return !!(settings.selectedPreset && settings.selectedPreset.trim());
        } catch (error) {
            console.error(`❌ [PresetManager] 检查预设配置失败:`, error);
            return false;
        }
    }

    /**
     * 获取配置的日记预设
     * @returns {Promise<string|null>} 配置的预设名称
     */
    async getConfiguredPreset() {
        try {
            const settings = await this.getDiarySettings();
            return settings.selectedPreset || null;
        } catch (error) {
            console.error(`❌ [PresetManager] 获取配置预设失败:`, error);
            return null;
        }
    }

    /**
     * 验证预设是否有效
     * @param {string} presetName 预设名称
     * @returns {Promise<boolean>} 是否有效
     */
    async validatePreset(presetName) {
        try {
            if (!presetName || !presetName.trim()) {
                return false;
            }

            // 尝试切换到该预设来验证
            const originalPreset = await this.getCurrentPreset();
            const switchSuccess = await this.switchToPreset(presetName);
            
            if (switchSuccess && originalPreset) {
                // 恢复原预设
                await this.switchToPreset(originalPreset);
            }
            
            return switchSuccess;
        } catch (error) {
            console.error(`❌ [PresetManager] 验证预设失败:`, error);
            return false;
        }
    }

    /**
     * 执行SillyTavern slash命令
     * @param {string} command 要执行的命令
     * @returns {Promise<string>} 命令执行结果
     */
    async executeSlashCommand(command) {
        try {
            // 使用全局的triggerSlash函数
            if (typeof triggerSlash === 'function') {
                const result = await triggerSlash(command);
                return result;
            } else if (window.triggerSlash) {
                const result = await window.triggerSlash(command);
                return result;
            } else {
                throw new Error('triggerSlash函数不可用');
            }
        } catch (error) {
            console.error(`❌ [PresetManager] 命令执行失败: ${command}`, error);
            throw error;
        }
    }

    /**
     * 获取预设管理器状态信息
     * @returns {Promise<Object>} 状态信息
     */
    async getStatus() {
        try {
            const settings = await this.getDiarySettings();
            const currentPreset = await this.getCurrentPreset();
            const availablePresets = await this.getAvailablePresets();
            
            return {
                currentPreset,
                configuredPreset: settings.selectedPreset,
                lastUsedPreset: settings.lastUsedPreset,
                availablePresets: availablePresets.length,
                cacheExpiry: new Date(this.lastRefreshTime + this.refreshInterval),
                isMobile: this.isMobile,
                initialized: true
            };
        } catch (error) {
            console.error(`❌ [PresetManager] 获取状态失败:`, error);
            return {
                error: error.message,
                initialized: false
            };
        }
    }
}
