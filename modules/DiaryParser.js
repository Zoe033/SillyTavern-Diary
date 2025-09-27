/**
 * 日记解析模块
 * 负责监听AI回复、解析日记内容、协调存储和预设管理
 */

// 日记内容识别正则表达式
const DIARY_REGEX = /［日记标题：([^］]+)］[\s\S]*?［日记时间：([^］]+)］[\s\S]*?［日记内容：([\s\S]*?)］/g;

export class DiaryParser {
    constructor(diaryStorage, presetManager, settings) {
        this.diaryStorage = diaryStorage;
        this.presetManager = presetManager;
        this.settings = settings;
        
        // 监听状态管理
        this.isListening = false;
        this.messageListener = null;
        this.timeoutId = null;
        this.listenTimeout = 180000; // 3分钟超时
        
        // 预设管理结果
        this.presetPreparationResult = null;
        
        // 重试和失败状态管理
        this.retryCount = 0;
        this.maxRetries = 3;
        this.hasShownFailureWarning = false;
        this.isTerminallyFailed = false;
        
        // 自定义角色名支持
        this.customCharacterName = null;
        
        // 删除保护和重试定时器管理
        this.hasDeletionExecuted = false;
        this.retryTimerIds = new Set();
        
        // 移动端检测
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
     * 开始监听AI回复（完整版本，包含预设管理）
     * @param {string} characterName 角色名称
     */
    async startListening(characterName) {
        try {
            console.log(`🎯 [DiaryParser] 开始监听 (角色: ${characterName})`);
            
            // 重置状态
            this.resetListenerState();
            this.customCharacterName = characterName;
            
            // 设置监听
            this.setupMessageListener();
            
            // 设置超时处理
            this.setupTimeout();
            
            this.isListening = true;
            console.log(`✅ [DiaryParser] 监听已启动`);
            
        } catch (error) {
            console.error(`❌ [DiaryParser] 启动监听失败:`, error);
            throw error;
        }
    }

    /**
     * 开始监听（不包含预设管理的简化版本）
     */
    async startListeningWithoutPresetManagement() {
        try {
            console.log(`🎯 [DiaryParser] 开始简化监听...`);
            
            this.resetListenerState();
            this.setupMessageListener();
            this.setupTimeout();
            this.isListening = true;
            
            console.log(`✅ [DiaryParser] 简化监听已启动`);
        } catch (error) {
            console.error(`❌ [DiaryParser] 简化监听启动失败:`, error);
            throw error;
        }
    }

    /**
     * 停止监听（不包含预设管理的简化版本）
     */
    async stopListeningWithoutPresetManagement() {
        try {
            if (!this.isListening) return;
            
            console.log(`🛑 [DiaryParser] 停止简化监听...`);
            
            this.isListening = false;
            this.clearMessageListener();
            this.clearTimeout();
            this.clearAllRetryTimers();
            
            console.log(`✅ [DiaryParser] 简化监听已停止`);
        } catch (error) {
            console.error(`❌ [DiaryParser] 停止简化监听失败:`, error);
        }
    }

    /**
     * 开始监听（使用自定义角色名）
     * @param {string} customCharacterName 自定义角色名称
     */
    async startListeningWithCustomCharacter(customCharacterName) {
        try {
            this.customCharacterName = customCharacterName;
            await this.startListening(customCharacterName);
        } catch (error) {
            console.error(`❌ [DiaryParser] 自定义角色监听失败:`, error);
            throw error;
        }
    }

    /**
     * 停止监听（自定义角色版本）
     */
    async stopListeningWithCustomCharacter() {
        try {
            await this.stopListening();
            this.customCharacterName = null;
        } catch (error) {
            console.error(`❌ [DiaryParser] 停止自定义角色监听失败:`, error);
        }
    }

    /**
     * 停止监听（完整版本，包含预设恢复）
     */
    async stopListening() {
        try {
            if (!this.isListening) return;
            
            console.log(`🛑 [DiaryParser] 停止监听...`);
            
            this.isListening = false;
            this.clearMessageListener();
            this.clearTimeout();
            this.clearAllRetryTimers();
            
            // 恢复预设
            if (this.presetManager && this.presetPreparationResult?.success) {
                console.log(`🔄 [DiaryParser] 恢复预设...`);
                await this.presetManager.restorePreviousPreset();
            }
            
            console.log(`✅ [DiaryParser] 监听已停止`);
        } catch (error) {
            console.error(`❌ [DiaryParser] 停止监听失败:`, error);
        }
    }

    /**
     * 重置监听器状态
     */
    resetListenerState() {
        this.retryCount = 0;
        this.hasShownFailureWarning = false;
        this.isTerminallyFailed = false;
        this.resetDeletionState();
    }

    /**
     * 设置消息监听器
     */
    setupMessageListener() {
        this.messageListener = (data) => this.handleMessage(data);
        
        // 使用SillyTavern的事件系统监听消息
        if (window.eventSource && window.event_types) {
            window.eventSource.on(window.event_types.MESSAGE_RECEIVED, this.messageListener);
        }
    }

    /**
     * 清除消息监听器
     */
    clearMessageListener() {
        if (this.messageListener && window.eventSource && window.event_types) {
            window.eventSource.removeListener(window.event_types.MESSAGE_RECEIVED, this.messageListener);
        }
        this.messageListener = null;
    }

    /**
     * 设置超时处理
     */
    setupTimeout() {
        this.timeoutId = setTimeout(() => {
            if (this.isListening) {
                console.warn(`⏰ [DiaryParser] 监听超时`);
                this.stopListening();
                this.showTimeoutWarning();
            }
        }, this.listenTimeout);
    }

    /**
     * 清除超时定时器
     */
    clearTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    /**
     * 显示超时警告
     */
    showTimeoutWarning() {
        const message = this.isMobile 
            ? '日记写作超时，请重新尝试' 
            : '日记写作监听超时（3分钟），请重新尝试写日记';
        
        toastr.warning(message, '超时提醒', {
            timeOut: 5000,
            extendedTimeOut: 2000
        });
    }

    /**
     * 处理收到的消息
     * @param {Object} data 消息数据
     */
    async handleMessage(data) {
        if (!this.isListening || this.isTerminallyFailed) return;
        
        try {
            // 检查是否是AI回复
            if (!this.isAIMessage(data)) return;
            
            const messageText = this.extractMessageText(data);
            if (!messageText) return;
            
            console.log(`📨 [DiaryParser] 处理AI消息: ${messageText.substring(0, 100)}...`);
            
            // 尝试处理日记消息
            const processed = await this.processDiaryMessage(messageText);
            
            if (processed) {
                console.log(`✅ [DiaryParser] 成功处理日记内容，停止监听`);
                await this.stopListening();
                return;
            }
            
        } catch (error) {
            console.error(`❌ [DiaryParser] 处理消息失败:`, error);
            this.handleProcessingError(error);
        }
    }

    /**
     * 检查是否是AI消息
     * @param {Object} data 消息数据
     * @returns {boolean} 是否是AI消息
     */
    isAIMessage(data) {
        // 根据SillyTavern的消息格式判断
        return data && (data.is_system === false) && (data.is_user === false);
    }

    /**
     * 提取消息文本
     * @param {Object} data 消息数据
     * @returns {string|null} 消息文本
     */
    extractMessageText(data) {
        return data?.mes || data?.message || data?.content || null;
    }

    /**
     * 清除所有重试定时器
     */
    clearAllRetryTimers() {
        this.retryTimerIds.forEach(timerId => {
            clearTimeout(timerId);
        });
        this.retryTimerIds.clear();
    }

    /**
     * 重置删除状态
     */
    resetDeletionState() {
        this.hasDeletionExecuted = false;
    }

    /**
     * 重启监听器（用于重试）
     */
    restartListener() {
        const timerId = setTimeout(async () => {
            try {
                if (this.retryCount < this.maxRetries && !this.isTerminallyFailed) {
                    this.retryCount++;
                    console.log(`🔄 [DiaryParser] 重试监听 (${this.retryCount}/${this.maxRetries})`);
                    
                    this.resetListenerState();
                    await this.startListeningWithoutPresetManagement();
                } else {
                    this.isTerminallyFailed = true;
                    console.error(`❌ [DiaryParser] 监听重试次数已达上限`);
                }
            } catch (error) {
                console.error(`❌ [DiaryParser] 重启监听失败:`, error);
            } finally {
                this.retryTimerIds.delete(timerId);
            }
        }, 2000);
        
        this.retryTimerIds.add(timerId);
    }

    /**
     * 处理日记消息
     * @param {string} messageText 消息文本
     * @returns {Promise<boolean>} 是否成功处理
     */
    async processDiaryMessage(messageText) {
        try {
            DIARY_REGEX.lastIndex = 0; // 重置正则表达式的lastIndex
            
            let match;
            let hasValidEntry = false;
            
            while ((match = DIARY_REGEX.exec(messageText)) !== null) {
                const [, title, time, content] = match;
                
                console.log(`📝 [DiaryParser] 解析到的日记:`, { title, time, content });
                
                if (!this.validateDiaryContent(title, time, content)) {
                    console.log(`⚠️ [DiaryParser] 日记内容验证失败，跳过:`, { title, time, content });
                    continue;
                }
                
                // 使用自定义角色名或当前角色名
                const characterName = this.customCharacterName || this.getCurrentCharacterName();
                
                // 保存日记
                const saveSuccess = await this.diaryStorage.createDiaryEntry(
                    title.trim(),
                    time.trim(),
                    content.trim(),
                    characterName,
                    this.customCharacterName
                );
                
                if (saveSuccess) {
                    hasValidEntry = true;
                    console.log(`✅ [DiaryParser] 日记保存成功`);
                    
                    // 显示成功提示
                    this.showSuccessMessage(title);
                    
                    // 删除消息（如果启用）
                    if (this.settings.autoDeleteMessages) {
                        await this.deleteLatestTwoMessages();
                    }
                    
                    break; // 找到并保存了有效日记，停止处理
                } else {
                    console.warn(`⚠️ [DiaryParser] 日记保存失败: ${title}`);
                }
            }
            
            if (!hasValidEntry) {
                console.log(`📝 [DiaryParser] 未找到有效的日记内容`);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error(`❌ [DiaryParser] 处理日记消息失败:`, error);
            throw error;
        }
    }

    /**
     * 获取当前角色名称
     * @returns {string} 当前角色名称
     */
    getCurrentCharacterName() {
        try {
            // 使用SillyTavern的context获取当前角色名
            if (window.getContext) {
                const context = window.getContext();
                return context.name2 || context.characterName || '未知角色';
            }
            
            // 备选方案
            return document.querySelector('#rm_button_selected_ch')?.textContent?.trim() || '未知角色';
        } catch (error) {
            console.error(`❌ [DiaryParser] 获取角色名失败:`, error);
            return '未知角色';
        }
    }

    /**
     * 验证日记内容
     * @param {string} title 标题
     * @param {string} time 时间
     * @param {string} content 内容
     * @returns {boolean} 是否有效
     */
    validateDiaryContent(title, time, content) {
        if (!title || !time || !content) {
            console.log(`❌ [DiaryParser] 日记内容不能为空`);
            return false;
        }
        
        if (title.includes('{{') || time.includes('{{') || content.includes('{{')) {
            console.log(`❌ [DiaryParser] 日记内容包含未替换的模板标记`);
            return false;
        }
        
        if (title.length > 100) {
            console.log(`❌ [DiaryParser] 日记标题过长`);
            return false;
        }
        
        if (content.length > 5000) {
            console.log(`❌ [DiaryParser] 日记内容过长`);
            return false;
        }
        
        return true;
    }

    /**
     * 显示成功消息
     * @param {string} title 日记标题
     */
    showSuccessMessage(title) {
        const message = this.isMobile 
            ? `日记记录成功！` 
            : `日记记录成功！标题：${title}`;
        
        toastr.success(message, '记录成功', {
            timeOut: 3000,
            extendedTimeOut: 1000
        });
    }

    /**
     * 删除最新的两个消息
     */
    async deleteLatestTwoMessages() {
        try {
            if (this.hasDeletionExecuted) {
                console.log(`🛡️ [DiaryParser] 删除操作已执行，跳过重复删除`);
                return;
            }
            
            this.hasDeletionExecuted = true;
            
            console.log(`🗑️ [DiaryParser] 删除最新的两个消息...`);
            
            // 使用SillyTavern的删除命令
            await this.executeSlashCommand('/del 2');
            
            console.log(`✅ [DiaryParser] 消息删除成功`);
        } catch (error) {
            console.error(`❌ [DiaryParser] 删除消息失败:`, error);
            // 删除失败不应该影响主流程
        }
    }

    /**
     * 手动记录最新消息（记录按钮功能）
     */
    async recordLatestMessage() {
        try {
            console.log(`📝 [DiaryParser] 手动记录最新消息...`);
            
            const isMobile = this.isMobile;
            
            if (isMobile) {
                toastr.info('正在解析最新消息...', '处理中', { timeOut: 2000 });
            }
            
            // 获取最新的AI消息
            const latestMessage = this.getLatestAIMessage();
            
            if (!latestMessage) {
                const errorMsg = '未找到AI回复消息，请先与AI对话';
                toastr.error(errorMsg, '记录失败', { timeOut: 5000 });
                return false;
            }
            
            // 解析日记内容
            const processed = await this.processDiaryMessage(latestMessage);
            
            if (!processed) {
                this.showFormatError(isMobile);
                return false;
            }
            
            console.log(`✅ [DiaryParser] 手动记录成功`);
            return true;
            
        } catch (error) {
            console.error(`❌ [DiaryParser] 手动记录失败:`, error);
            toastr.error('记录过程中发生错误，请稍后重试', '记录失败', { timeOut: 5000 });
            return false;
        }
    }

    /**
     * 获取最新的AI消息
     * @returns {string|null} 消息内容
     */
    getLatestAIMessage() {
        try {
            // 尝试从SillyTavern的聊天记录中获取最新的AI消息
            if (window.chat && Array.isArray(window.chat)) {
                // 从最新消息开始往前查找AI消息
                for (let i = window.chat.length - 1; i >= 0; i--) {
                    const message = window.chat[i];
                    if (message && !message.is_user && !message.is_system) {
                        return message.mes || message.message || null;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ [DiaryParser] 获取最新AI消息失败:`, error);
            return null;
        }
    }

    /**
     * 显示格式错误信息
     * @param {boolean} isMobile 是否为移动端
     */
    showFormatError(isMobile) {
        if (isMobile) {
            toastr.error(
                `未找到日记格式<br><br>需要格式：<br>［日记标题：标题］<br>［日记时间：时间］<br>［日记内容：内容］<br><br>注意使用全角方括号 ［ ］`,
                '记录失败',
                {
                    timeOut: 10000,
                    extendedTimeOut: 5000,
                    escapeHtml: false
                }
            );
        } else {
            const formatGuide = `
日记格式要求：
［日记标题：标题内容］
［日记时间：时间内容］ 
［日记内容：正文内容］

请确保使用全角方括号 ［ ］
            `;
            
            toastr.error(`最新AI回复中未找到符合格式的日记内容<br><pre>${formatGuide}</pre>`, '记录失败', {
                timeOut: 8000,
                extendedTimeOut: 4000,
                escapeHtml: false
            });
        }
    }

    /**
     * 处理处理错误
     * @param {Error} error 错误对象
     */
    handleProcessingError(error) {
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
            this.isTerminallyFailed = true;
            console.error(`❌ [DiaryParser] 达到最大重试次数，停止监听`);
            this.stopListening();
            
            if (!this.hasShownFailureWarning) {
                this.hasShownFailureWarning = true;
                toastr.error('日记解析多次失败，请检查AI回复格式', '解析失败', {
                    timeOut: 8000,
                    extendedTimeOut: 4000
                });
            }
        } else {
            console.warn(`⚠️ [DiaryParser] 处理错误，将重试 (${this.retryCount}/${this.maxRetries}):`, error);
            this.restartListener();
        }
    }

    /**
     * 执行SillyTavern slash命令
     * @param {string} command 要执行的命令
     * @returns {Promise<string>} 命令执行结果
     */
    async executeSlashCommand(command) {
        try {
            if (typeof triggerSlash === 'function') {
                return await triggerSlash(command);
            } else if (window.triggerSlash) {
                return await window.triggerSlash(command);
            } else {
                throw new Error('triggerSlash函数不可用');
            }
        } catch (error) {
            console.error(`❌ [DiaryParser] 命令执行失败: ${command}`, error);
            throw error;
        }
    }

    /**
     * 获取解析器状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            isListening: this.isListening,
            customCharacterName: this.customCharacterName,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            isTerminallyFailed: this.isTerminallyFailed,
            hasShownFailureWarning: this.hasShownFailureWarning,
            isMobile: this.isMobile,
            timeoutRemaining: this.timeoutId ? this.listenTimeout : 0
        };
    }
}
